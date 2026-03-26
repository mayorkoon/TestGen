require("dotenv").config({ path: ".env.development" });
console.log("API KEY:", process.env.ANTHROPIC_API_KEY ? "loaded" : "NOT FOUND");
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccount.json");


// ─── Firebase Admin Init ───────────────────────────────────────────────────────
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: "testgen-83c9d",
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
});

const db = admin.firestore();

// ─── Express Setup ─────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

// ─── Jira OAuth Constants ──────────────────────────────────────────────────────
const JIRA_CLIENT_ID = process.env.JIRA_CLIENT_ID 
const JIRA_CLIENT_SECRET = process.env.JIRA_CLIENT_SECRET 
const JIRA_REDIRECT_URI = process.env.JIRA_REDIRECT_URI 
const JIRA_SCOPES = "read:jira-work read:jira-user offline_access";

// ─── Claude API Proxy ──────────────────────────────────────────────────────────
app.post("/api/generate", async (req, res) => {
  try {
    const response = await axios.post(
      "https://api.anthropic.com/v1/messages",
      req.body,
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
      }
    );
    res.json(response.data);
  } catch (err) {
    const errorData = err.response?.data;
    console.error("Anthropic error:", errorData);

    // Return specific error messages
    if (errorData?.error?.type === "authentication_error") {
      return res.status(401).json({ error: "Invalid API key. Please check your Anthropic API key." });
    }

    if (errorData?.error?.message?.includes("credit balance is too low")) {
      return res.status(402).json({ error: "Insufficient credits. Please top up your Anthropic account at console.anthropic.com → Plans & Billing." });
    }

    if (errorData?.error?.type === "rate_limit_error") {
      return res.status(429).json({ error: "Rate limit reached. Please wait a moment and try again." });
    }

    res.status(500).json({ error: errorData?.error?.message || "Failed to generate test cases. Please try again." });
  }
});

// ─── Jira OAuth Step 1: Start ──────────────────────────────────────────────────
app.get("/auth/jira/start", (req, res) => {
  const { uid } = req.query;
  const url = `https://auth.atlassian.com/authorize?audience=api.atlassian.com&client_id=${JIRA_CLIENT_ID}&scope=${encodeURIComponent(JIRA_SCOPES)}&redirect_uri=${encodeURIComponent(JIRA_REDIRECT_URI)}&state=${uid}&response_type=code&prompt=consent`;
  res.redirect(url);
});

// ─── Jira OAuth Step 2: Callback ──────────────────────────────────────────────
app.get("/auth/jira/callback", async (req, res) => {
  const { code, state: uid } = req.query;
  try {
    // Exchange code for tokens
    const tokenRes = await axios.post("https://auth.atlassian.com/oauth/token", {
      grant_type: "authorization_code",
      client_id: JIRA_CLIENT_ID,
      client_secret: JIRA_CLIENT_SECRET,
      code,
      redirect_uri: JIRA_REDIRECT_URI,
    });

    const { access_token, refresh_token, expires_in } = tokenRes.data;

    // Get accessible Jira sites
    const sitesRes = await axios.get(
      "https://api.atlassian.com/oauth/token/accessible-resources",
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          Accept: "application/json",
        },
      }
    );

    const site = sitesRes.data[0];

    // Save tokens to Firestore
    await db.collection("jira_tokens").doc(uid).set({
      access_token,
      refresh_token,
      expires_at: Date.now() + expires_in * 1000,
      cloud_id: site.id,
      site_url: site.url,
      site_name: site.name,
      updatedAt: new Date(),
    });

    // Close popup and notify parent window
    res.send(`
      <html>
        <body style="background:#080c14;color:#e8edf5;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
          <div style="text-align:center">
            <div style="font-size:48px;margin-bottom:16px">⚡</div>
            <h2 style="color:#4f8ef7;margin-bottom:8px">Jira Connected!</h2>
            <p style="color:#7a8fa8">You can close this window and return to TestGen.</p>
            <script>
              window.opener && window.opener.postMessage("jira_connected", "*");
              setTimeout(() => window.close(), 2000);
            </script>
          </div>
        </body>
      </html>
    `);
  } catch (err) {
    console.error("Jira OAuth error:", err.response?.data || err.message);
    res.status(500).send("OAuth failed: " + (err.response?.data?.message || err.message));
  }
});

// ─── Jira Token Helper: Get valid (refresh if expired) ────────────────────────
async function getValidJiraToken(uid) {
  const doc = await db.collection("jira_tokens").doc(uid).get();

  if (!doc.exists) {
    throw new Error("Jira not connected. Please connect Jira first.");
  }

  const data = doc.data();

  // Refresh token if expired (or about to expire in 60s)
  if (Date.now() > data.expires_at - 60000) {
    const refreshRes = await axios.post("https://auth.atlassian.com/oauth/token", {
      grant_type: "refresh_token",
      client_id: JIRA_CLIENT_ID,
      client_secret: JIRA_CLIENT_SECRET,
      refresh_token: data.refresh_token,
    });

    const { access_token, refresh_token, expires_in } = refreshRes.data;

    await db.collection("jira_tokens").doc(uid).update({
      access_token,
      refresh_token,
      expires_at: Date.now() + expires_in * 1000,
      updatedAt: new Date(),
    });

    return { access_token, cloud_id: data.cloud_id };
  }

  return { access_token: data.access_token, cloud_id: data.cloud_id };
}

// ─── Fetch Jira Ticket ─────────────────────────────────────────────────────────
app.post("/api/jira", async (req, res) => {
  const { ticketId, uid } = req.body;
  if (!ticketId || !uid) return res.status(400).json({ error: "Missing ticketId or uid" });

  try {
    const { access_token, cloud_id } = await getValidJiraToken(uid);
    const response = await axios.get(
      `https://api.atlassian.com/ex/jira/${cloud_id}/rest/api/3/issue/${ticketId}`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          Accept: "application/json",
        },
      }
    );

    const data = response.data;
    const summary = data.fields?.summary || "";
    const priority = data.fields?.priority?.name || "Medium";
    const issueType = data.fields?.issuetype?.name || "";
    const status = data.fields?.status?.name || "";

    // Recursively extract all text from Atlassian Document Format
    const extractText = (node) => {
      if (!node) return "";
      if (node.type === "text") return node.text || "";
      if (node.type === "hardBreak") return "\n";
      if (node.content && Array.isArray(node.content)) {
        const text = node.content.map(extractText).join("");
        // Add newlines for block elements
        if (["paragraph", "heading", "bulletList", "orderedList", "listItem", "blockquote"].includes(node.type)) {
          return text + "\n";
        }
        return text;
      }
      return "";
    };

    const description = data.fields?.description
      ? extractText(data.fields.description).trim()
      : "No description provided.";

    const formatted = `
Ticket: ${ticketId}
Type: ${issueType}
Status: ${status}
Priority: ${priority}
Summary: ${summary}

Description:
${description}
    `.trim();

    console.log("Jira formatted content:\n", formatted);

    res.json({
      raw: data,
      summary,
      description,
      formatted,
    });
  } catch (err) {
    console.error("Jira fetch error:", err.response?.data || err.message);
    res.status(500).json({ error: err.message || "Failed to fetch Jira ticket" });
  }
});

// ─── Check Jira Connection Status ─────────────────────────────────────────────
app.get("/auth/jira/status", async (req, res) => {
  const { uid } = req.query;
  try {
    const doc = await db.collection("jira_tokens").doc(uid).get();
    if (doc.exists) {
      res.json({ connected: true, site: doc.data().site_name });
    } else {
      res.json({ connected: false });
    }
  } catch (err) {
    res.json({ connected: false });
  }
});

// ─── Disconnect Jira ───────────────────────────────────────────────────────────
app.delete("/auth/jira/disconnect", async (req, res) => {
  const { uid } = req.body;
  try {
    await db.collection("jira_tokens").doc(uid).delete();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Start Server ──────────────────────────────────────────────────────────────
app.listen(4000, () => console.log("Proxy running on http://localhost:4000"));
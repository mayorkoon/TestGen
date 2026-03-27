import React, { useState, useEffect } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../../firebase";
import TestCaseTable from "./TestCaseTable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import "./TestGen.css";

const INPUT_TYPES = {
  TEXT: "text",
  PDF: "pdf",
  JIRA: "jira",
};

const FORMAT_TYPES = {
  PLAIN: "plain",
  BDD: "bdd",
};

function TestGen({ savedTestCases, setSavedTestCases }) {
  const [inputType, setInputType] = useState(INPUT_TYPES.TEXT);
  const [format, setFormat] = useState(FORMAT_TYPES.PLAIN);
  const [textInput, setTextInput] = useState("");
  const [jiraTicket, setJiraTicket] = useState("");
  const [pdfFile, setPdfFile] = useState(null);
  const [testCases, setTestCases] = useState(savedTestCases || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  // Jira OAuth state
  const [jiraConnected, setJiraConnected] = useState(false);
  const [jiraSite, setJiraSite] = useState("");
  const [jiraConnecting, setJiraConnecting] = useState(false);

  const uid = auth.currentUser?.uid;

  // Check Jira connection status on mount
  useEffect(() => {
    if (uid) checkJiraStatus();
  }, [uid]);

  const checkJiraStatus = async () => {
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/auth/jira/status?uid=${uid}`);
      const data = await res.json();
      setJiraConnected(data.connected);
      if (data.connected) setJiraSite(data.site);
    } catch (err) {
      console.error("Jira status check failed:", err);
    }
  };

  const handleConnectJira = () => {
    setJiraConnecting(true);
    const popup = window.open(
      `${process.env.REACT_APP_API_URL}/auth/jira/start?uid=${uid}`,
      "Connect Jira",
      "width=600,height=700,scrollbars=yes"
    );

    // Listen for success message from popup
    const handler = async (event) => {
      if (event.data === "jira_connected") {
        window.removeEventListener("message", handler);
        await checkJiraStatus();
        setJiraConnecting(false);
        popup?.close();
      }
    };
    window.addEventListener("message", handler);

    // Fallback: poll if popup closed without message
    const pollTimer = setInterval(() => {
      if (popup?.closed) {
        clearInterval(pollTimer);
        window.removeEventListener("message", handler);
        checkJiraStatus();
        setJiraConnecting(false);
      }
    }, 1000);
  };

  const handleDisconnectJira = async () => {
    try {
      await fetch(`${process.env.REACT_APP_API_URL}/auth/jira/disconnect?uid=${uid}`, {
        method: "DELETE",
      });
      setJiraConnected(false);
      setJiraSite("");
    } catch (err) {
      console.error("Disconnect failed:", err);
    }
  };

  const buildPrompt = (requirements) => {
    if (format === FORMAT_TYPES.PLAIN) {
      return `You are a senior QA engineer. Based on the following requirements, generate comprehensive test cases in plain format.

Requirements:
${requirements}

Return ONLY a valid JSON array (no markdown, no explanation) with this structure:
[
  {
    "id": "TC001",
    "title": "Test case title",
    "preconditions": "Any preconditions",
    "steps": ["Step 1", "Step 2", "Step 3"],
    "expectedResult": "Expected outcome",
    "priority": "High|Medium|Low",
    "type": "Positive|Negative|Edge Case"
  }
]

Generate at least 8 test cases covering positive, negative, and edge cases.`;
    } else {
      return `You are a senior QA engineer. Based on the following requirements, generate comprehensive BDD/Gherkin test cases.

Requirements:
${requirements}

Return ONLY a valid JSON array (no markdown, no explanation) with this structure:
[
  {
    "id": "TC001",
    "title": "Feature title",
    "scenario": "Scenario name",
    "given": ["Given condition 1", "And condition 2"],
    "when": ["When action 1"],
    "then": ["Then result 1", "And result 2"],
    "priority": "High|Medium|Low",
    "type": "Positive|Negative|Edge Case"
  }
]

Generate at least 8 test cases covering positive, negative, and edge cases.`;
    }
  };

const callClaudeAPI = async (requirements) => {
  const response = await fetch(`${process.env.REACT_APP_API_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      messages: [{ role: "user", content: buildPrompt(requirements) }],
    }),
  });

  if (!response.ok) {
    const errData = await response.json();
    throw new Error(errData.error || "Failed to generate test cases. Please try again.");
  }

  const data = await response.json();
  const text = data.content.map((c) => c.text || "").join("");

  // Extract JSON array from response more robustly
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("Could not parse test cases from response. Please try again.");

  try {
    return JSON.parse(jsonMatch[0]);
  } catch (parseErr) {
    // Try cleaning the string before parsing
    const clean = jsonMatch[0]
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, " ") // remove control characters
      .replace(/,\s*]/g, "]")                          // remove trailing commas
      .replace(/,\s*}/g, "}");                         // remove trailing commas in objects
    return JSON.parse(clean);
  }
};

  const fetchJiraTicket = async () => {
    if (!jiraTicket.trim()) throw new Error("Please enter a Jira ticket ID.");
    if (!jiraConnected) throw new Error("Please connect your Jira account first.");

    const response = await fetch(`${process.env.REACT_APP_API_URL}/api/jira`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId: jiraTicket, uid }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Failed to fetch Jira ticket.");
    }

    const data = await response.json();
    return data.formatted;
  };

  const extractPdfText = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      resolve(`PDF file: ${file.name}. Please extract and analyze the requirements from this document.`);
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
};

  const handleGenerate = async () => {
    setError("");
    setTestCases([]);
    setSaved(false);
    setLoading(true);

    try {
      let requirements = "";

      if (inputType === INPUT_TYPES.TEXT) {
        if (!textInput.trim()) throw new Error("Please enter requirements.");
        requirements = textInput;
      } else if (inputType === INPUT_TYPES.PDF) {
        if (!pdfFile) throw new Error("Please upload a PDF file.");
        requirements = await extractPdfText(pdfFile);
      } else if (inputType === INPUT_TYPES.JIRA) {
        requirements = await fetchJiraTicket();
      }

      const cases = await callClaudeAPI(requirements);
      setTestCases(cases);
      setSavedTestCases(cases);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    }

    setLoading(false);
  };
  const handleDeleteTestCase = (index) => {
    const updated = testCases.filter((_, i) => i !== index);
    setTestCases(updated);
    setSavedTestCases(updated);
    if (saved) setSaved(false); // reset saved state since list changed
  };

  const handleSave = async () => {
    try {
      await addDoc(collection(db, "testgens"), {
        userId: auth.currentUser.uid,
        inputType,
        format,
        source:
          inputType === INPUT_TYPES.JIRA
            ? jiraTicket
            : inputType === INPUT_TYPES.PDF
            ? pdfFile?.name
            : textInput.substring(0, 100),
        testCases,
        createdAt: serverTimestamp(),
      });
      setSaved(true);
    } catch (err) {
      setError("Failed to save. Please try again.");
    }
  };

const handleExport = () => {
  const rows = testCases.map((tc) => {
    if (format === FORMAT_TYPES.PLAIN) {
      return {
        "Jira Ticket": inputType === INPUT_TYPES.JIRA ? jiraTicket : "",
        "Test Case ID": tc.id,
        "Title": tc.title,
        "Preconditions": tc.preconditions,
        "Test Steps": Array.isArray(tc.steps) ? tc.steps.join("\n") : tc.steps,
        "Expected Result": tc.expectedResult,
        "Priority": tc.priority,
        "Type": tc.type,
      };
    } else {
      return {
        "Jira Ticket": inputType === INPUT_TYPES.JIRA ? jiraTicket : "",
        "Test Case ID": tc.id,
        "Title": tc.title,
        "Scenario": tc.scenario || tc.title,
        "Given": Array.isArray(tc.given) ? tc.given.join("\n") : tc.given,
        "When": Array.isArray(tc.when) ? tc.when.join("\n") : tc.when,
        "Then": Array.isArray(tc.then) ? tc.then.join("\n") : tc.then,
        "Priority": tc.priority,
        "Type": tc.type,
      };
    }
  });

   const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = Object.keys(rows[0] || {}).map(() => ({ wch: 30 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Test Cases");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buf], { type: "application/octet-stream" }), `TestGen_${jiraTicket || "TestCases"}.xlsx`);
};

  return (
    <div className="testgen">
      <div className="testgen__header">
        <h1 className="testgen__title">Generate Test Cases</h1>
        <p className="testgen__subtitle">Paste requirements, upload a PDF, or connect a Jira ticket</p>
      </div>

      {/* Controls */}
      <div className="testgen__controls">
        {/* Input type */}
        <div className="control-group">
          <label className="control-label">Input Source</label>
          <div className="toggle-group">
            {Object.values(INPUT_TYPES).map((type) => (
              <button
                key={type}
                className={`toggle-btn ${inputType === type ? "active" : ""}`}
                onClick={() => setInputType(type)}
              >
                {type === "text" ? "✏️ Plain Text" : type === "pdf" ? "📄 PDF" : "🔗 Jira"}
              </button>
            ))}
          </div>
        </div>

        {/* Format */}
        <div className="control-group">
          <label className="control-label">Output Format</label>
          <div className="toggle-group">
            <button
              className={`toggle-btn ${format === FORMAT_TYPES.PLAIN ? "active" : ""}`}
              onClick={() => setFormat(FORMAT_TYPES.PLAIN)}
            >
              Plain
            </button>
            <button
              className={`toggle-btn ${format === FORMAT_TYPES.BDD ? "active" : ""}`}
              onClick={() => setFormat(FORMAT_TYPES.BDD)}
            >
              BDD / Gherkin
            </button>
          </div>
        </div>
      </div>

      {/* Input area */}
      <div className="testgen__input-area">
        {inputType === INPUT_TYPES.TEXT && (
          <textarea
            className="testgen__textarea"
            placeholder="Paste your requirements here..."
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            rows={8}
          />
        )}

        {inputType === INPUT_TYPES.PDF && (
          <div className="testgen__pdf-upload">
            <input
              type="file"
              accept=".pdf"
              id="pdf-input"
              style={{ display: "none" }}
              onChange={(e) => setPdfFile(e.target.files[0])}
            />
            <label htmlFor="pdf-input" className="testgen__pdf-label">
              <span className="testgen__pdf-icon">📄</span>
              {pdfFile ? pdfFile.name : "Click to upload PDF"}
              <span className="testgen__pdf-hint">Requirements document, PRD, or spec</span>
            </label>
          </div>
        )}

        {inputType === INPUT_TYPES.JIRA && (
          <div className="testgen__jira-fields">
            {/* Jira Connection Status */}
            <div className="jira-connect-bar">
              {jiraConnected ? (
                <div className="jira-connected">
                  <div className="jira-connected__info">
                    <span className="jira-connected__dot"></span>
                    <span className="jira-connected__text">
                      Connected to <strong>{jiraSite}</strong>
                    </span>
                  </div>
                  <button className="jira-disconnect-btn" onClick={handleDisconnectJira}>
                    Disconnect
                  </button>
                </div>
              ) : (
                <div className="jira-not-connected">
                  <div className="jira-not-connected__info">
                    <span className="jira-not-connected__dot"></span>
                    <span>Jira not connected</span>
                  </div>
                  <button
                    className="jira-connect-btn"
                    onClick={handleConnectJira}
                    disabled={jiraConnecting}
                  >
                    {jiraConnecting ? (
                      <>
                        <span className="btn-spinner" style={{ width: 14, height: 14 }}></span>
                        Connecting...
                      </>
                    ) : (
                      "🔗 Connect Jira"
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Ticket ID input */}
            <div className="jira-field">
              <label className="control-label">Ticket ID</label>
              <input
                className="testgen__input"
                type="text"
                placeholder="e.g. PROJ-123"
                value={jiraTicket}
                onChange={(e) => setJiraTicket(e.target.value)}
                disabled={!jiraConnected}
              />
            </div>
          </div>
        )}
      </div>

      {error && <p className="testgen__error">{error}</p>}

      <button
        className="testgen__generate-btn"
        onClick={handleGenerate}
        disabled={loading}
      >
        {loading ? (
          <>
            <span className="btn-spinner"></span>
            Generating...
          </>
        ) : (
          <>✦ Generate Test Cases</>
        )}
      </button>

      {/* Results */}
      {testCases.length > 0 && (
        <div className="testgen__results">
          <div className="testgen__results-header">
            <div>
              <h2 className="testgen__results-title">
                {testCases.length} Test Cases Generated
              </h2>
              <p className="testgen__results-meta">
                Format: {format === FORMAT_TYPES.PLAIN ? "Plain" : "BDD/Gherkin"}
              </p>
            </div>
            <div className="testgen__results-actions">
              <button className="action-btn" onClick={handleExport}>
                ↓ Export Excel
              </button>
              <button
                className={`action-btn ${saved ? "saved" : "primary"}`}
                onClick={handleSave}
                disabled={saved}
              >
                {saved ? "✓ Saved" : "Save"}
              </button>
            </div>
          </div>
          <TestCaseTable testCases={testCases} format={format} onFormatChange={(newFormat) => setFormat(newFormat)} onDelete={handleDeleteTestCase}/>
        </div>
      )}
    </div>
  );
}

export default TestGen;

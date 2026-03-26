# ⚡ TestGen
> AI-Powered Test Case Generator — Built with React + Firebase + Claude API

---

## Overview

TestGen is a React web application that uses the Claude AI API to automatically generate test cases from requirements. It supports plain text input, PDF uploads, and Jira ticket integration. Test cases can be exported to Excel in either Plain or BDD/Gherkin format.

---

## Tech Stack

- React (Create React App)
- Firebase Auth + Firestore
- Firebase Hosting (deployment)
- Claude API — `claude-sonnet-4-5` (AI generation)
- Express.js (backend proxy server)
- SheetJS + FileSaver (Excel export)
- Concurrently (run frontend + backend together)

---

## Project Structure

```
testgen/
├── server.js                   ← Express proxy server (handles Claude API calls)
├── package.json
├── .env.development            ← Local API URL
├── .env.production             ← Production API URL
└── src/
    ├── index.js
    ├── App.js
    ├── App.css
    ├── firebase.js
    └── components/
        ├── Auth/
        │   ├── Login.js
        │   ├── Register.js
        │   └── Auth.css
        ├── Dashboard/
        │   ├── Dashboard.js
        │   └── Dashboard.css
        ├── TestGen/
        │   ├── TestGen.js
        │   ├── TestCaseTable.js
        │   └── TestGen.css
        └── History/
            ├── History.js
            └── History.css
```

---

## Prerequisites

Before resuming, make sure you have:

1. Node.js installed on your machine
2. Firebase project created (`testgen-83c9d`) with Auth and Firestore enabled
3. An Anthropic API account at [console.anthropic.com](https://console.anthropic.com) with credits loaded ($5 minimum)
4. Your Anthropic API key (starts with `sk-ant-...`)

---

## Step 1 — Get Your Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com) and sign in
2. Click **API Keys** in the left sidebar
3. Click **Create Key** and name it `testgen-key`
4. Copy the key — it starts with `sk-ant-...`
5. Go to **Plans & Billing** and load at least **$5** in credits

---

## Step 2 — Add API Key to server.js

Open `server.js` in the root of your `testgen` folder and replace:

```javascript
"x-api-key": "YOUR_ANTHROPIC_API_KEY_HERE"
```

With your actual key:

```javascript
"x-api-key": "sk-ant-your-actual-key-here"
```

> ⚠️ **Important:** Never commit your API key to GitHub. Add it to `.gitignore` or use environment variables.

---

## Step 3 — Set Up Environment Files

Create two files in the root of your `testgen` folder:

**.env.development**
```
REACT_APP_API_URL=http://localhost:4000
```

**.env.production**
```
REACT_APP_API_URL=https://your-deployed-backend-url.com
```

Then make sure the fetch URL in `src/components/TestGen/TestGen.js` is:

```javascript
const response = await fetch(`${process.env.REACT_APP_API_URL}/api/generate`, {
```

---

## Step 4 — Install Dependencies & Run

Navigate to your project folder:

```bash
cd /Users/abiodun/Downloads/TestGen/testgen
```

Install all dependencies (if not already done):

```bash
npm install
```

Run both the React app and the Express proxy in one command:

```bash
npm run dev
```

This starts:
- React app on **http://localhost:3000**
- Express proxy on **http://localhost:4000**

---

## Step 5 — Set Firestore Security Rules

In Firebase Console → Firestore → Rules, paste the following:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /testgens/{docId} {
      allow read, write: if request.auth != null
        && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null;
    }
  }
}
```

---

## Using the App

### Register & Login
1. Open [http://localhost:3000](http://localhost:3000)
2. Click **Register** to create your account
3. Log in with your credentials

### Generating Test Cases
1. Choose your **Input Source**: Plain Text, PDF, or Jira
2. Choose your **Output Format**: Plain or BDD/Gherkin
3. Paste or upload your requirements
4. Click **✦ Generate Test Cases**
5. Review the generated test cases in the expandable cards
6. Click **Export Excel** to download a QMetry-compatible `.xlsx` file
7. Click **Save** to store in your history

### Jira Integration
1. Select **Jira** as your Input Source
2. Enter your Jira Base URL (e.g. `https://yourcompany.atlassian.net`)
3. Enter the Ticket ID (e.g. `PROJ-123`)
4. Enter your Jira API Token (generate from [id.atlassian.com](https://id.atlassian.com) → Security → API Tokens)
5. Click **Generate Test Cases**

---

## Deploying to Production

### Backend (Express) — Render.com (Free)

1. Push your project to a GitHub repository (use environment variables for the API key — never hardcode)
2. Go to [render.com](https://render.com) and create a free account
3. Click **New → Web Service** → connect your GitHub repo
4. Set the start command to: `node server.js`
5. Add environment variable: `ANTHROPIC_API_KEY = your key`
6. Deploy — Render will give you a URL like `https://testgen-api.onrender.com`
7. Update `.env.production` with this URL

### Frontend (React) — Firebase Hosting

1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Initialise: `firebase init` (choose Hosting, select `testgen-83c9d`)
4. Set public directory to: `build`
5. Build the app: `npm run build`
6. Deploy: `firebase deploy`

---

## Key Reference Links

| Resource | Link |
|---|---|
| Firebase Console | [console.firebase.google.com](https://console.firebase.google.com) |
| Anthropic Console (API Keys & Billing) | [console.anthropic.com](https://console.anthropic.com) |
| Render (backend hosting) | [render.com](https://render.com) |
| Jira API Token | id.atlassian.com → Security → API Tokens |
| Firebase Project ID | `testgen-83c9d` |

---

*TestGen — Built by Abiodun | Stack: React + Firebase + Claude API*

import React, { useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../../firebase";
import TestGen from "../TestGen/TestGen";
import History from "../History/History";
import "./Dashboard.css";

function Dashboard() {
  const [activeTab, setActiveTab] = useState("generate");
  const [savedTestCases, setSavedTestCases] = useState([]);
  const user = auth.currentUser;

  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <div className="dashboard">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar__logo">
          <span className="sidebar__logo-icon">⚡</span>
          <span className="sidebar__logo-text">TestGen</span>
        </div>

        <nav className="sidebar__nav">
          <button
            className={`sidebar__nav-item ${activeTab === "generate" ? "active" : ""}`}
            onClick={() => setActiveTab("generate")}
          >
            <span className="sidebar__nav-icon">✦</span>
            Generate
          </button>
          <button
            className={`sidebar__nav-item ${activeTab === "history" ? "active" : ""}`}
            onClick={() => setActiveTab("history")}
          >
            <span className="sidebar__nav-icon">◷</span>
            History
          </button>
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar__user">
            <div className="sidebar__user-avatar">
              {user?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase()}
            </div>
            <div className="sidebar__user-info">
              <span className="sidebar__user-name">{user?.displayName || "User"}</span>
              <span className="sidebar__user-email">{user?.email}</span>
            </div>
          </div>
          <button className="sidebar__logout" onClick={handleLogout} title="Sign out">
            ⎋
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="dashboard__main">
        {activeTab === "generate" && (
          <TestGen
            savedTestCases={savedTestCases}
            setSavedTestCases={setSavedTestCases}
          />
        )}
        {activeTab === "history" && <History />}
      </main>
    </div>
  );
}

export default Dashboard;
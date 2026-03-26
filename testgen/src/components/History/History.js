import React, { useEffect, useState } from "react";
import { collection, query, where, orderBy, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db, auth } from "../../firebase";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import "./History.css";

function History() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [expandedCase, setExpandedCase] = useState(null);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, "testgens"),
        where("userId", "==", auth.currentUser.uid)
      );
      const snap = await getDocs(q);
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // Sort by createdAt descending
      docs.sort((a, b) => {
        const aTime = a.createdAt?.toDate?.() || new Date(0);
        const bTime = b.createdAt?.toDate?.() || new Date(0);
        return bTime - aTime;
      });
      setRecords(docs);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    await deleteDoc(doc(db, "testgens", id));
    setRecords((prev) => prev.filter((r) => r.id !== id));
    if (expanded === id) setExpanded(null);
  };

  const handleExport = (record, e) => {
    e.stopPropagation();
    const format = record.format;
    const rows = record.testCases.map((tc) => {
      if (format === "plain") {
        return {
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
          "Test Case ID": tc.id,
          "Title": tc.title,
          "Scenario": tc.scenario,
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
    saveAs(
      new Blob([buf], { type: "application/octet-stream" }),
      `TestGen_${record.source || "export"}_${record.testCases.length}cases.xlsx`
    );
  };

  const formatDate = (ts) => {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const inputIcon = (type) => {
    if (type === "pdf") return "📄";
    if (type === "jira") return "🔗";
    return "✏️";
  };

  const priorityColor = (p) => {
    if (p === "High") return "priority--high";
    if (p === "Medium") return "priority--medium";
    return "priority--low";
  };

  const typeColor = (t) => {
    if (t === "Positive") return "type--positive";
    if (t === "Negative") return "type--negative";
    return "type--edge";
  };

  if (loading) return (
    <div className="history__loading">
      <div className="app-loading__spinner"></div>
      <span>Loading history...</span>
    </div>
  );

  if (records.length === 0) return (
    <div className="history__empty">
      <span className="history__empty-icon">◷</span>
      <p>No saved test cases yet.</p>
      <span>Generate some test cases and hit Save!</span>
    </div>
  );

  return (
    <div className="history">
      <div className="history__header">
        <h1 className="history__title">History</h1>
        <p className="history__subtitle">
          {records.length} saved generation{records.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="history__list">
        {records.map((r) => (
          <div
            key={r.id}
            className={`history-card ${expanded === r.id ? "expanded" : ""}`}
          >
            {/* Card Header */}
            <div
              className="history-card__header"
              onClick={() => {
                setExpanded(expanded === r.id ? null : r.id);
                setExpandedCase(null);
              }}
            >
              <div className="history-card__left">
                <span className="history-card__icon">{inputIcon(r.inputType)}</span>
                <div>
                  <p className="history-card__source">{r.source || "No description"}</p>
                  <p className="history-card__meta">
                    {r.testCases?.length || 0} test cases · {r.format?.toUpperCase()} · {formatDate(r.createdAt)}
                  </p>
                </div>
              </div>
              <div className="history-card__right">
                <button
                  className="action-btn"
                  onClick={(e) => handleExport(r, e)}
                  title="Export to Excel"
                >
                  ↓ Export
                </button>
                <button
                  className="history-card__delete"
                  onClick={(e) => handleDelete(r.id, e)}
                  title="Delete"
                >
                  ✕
                </button>
                <span className="tc-chevron">{expanded === r.id ? "▲" : "▼"}</span>
              </div>
            </div>

            {/* Expanded Test Cases */}
            {expanded === r.id && r.testCases?.length > 0 && (
              <div className="history-card__body">
                <div className="history-tc-list">
                  {r.testCases.map((tc, j) => (
                    <div
                      key={j}
                      className={`history-tc-card ${expandedCase === `${r.id}-${j}` ? "expanded" : ""}`}
                      onClick={() => setExpandedCase(expandedCase === `${r.id}-${j}` ? null : `${r.id}-${j}`)}
                    >
                      {/* Test Case Header */}
                      <div className="history-tc-card__header">
                        <div className="tc-card__left">
                          <span className="tc-id">{tc.id}</span>
                          <span className="tc-title">{tc.title}</span>
                        </div>
                        <div className="tc-card__right">
                          <span className={`tc-badge ${priorityColor(tc.priority)}`}>{tc.priority}</span>
                          <span className={`tc-badge ${typeColor(tc.type)}`}>{tc.type}</span>
                          <span className="tc-chevron">{expandedCase === `${r.id}-${j}` ? "▲" : "▼"}</span>
                        </div>
                      </div>

                      {/* Test Case Details */}
                      {expandedCase === `${r.id}-${j}` && (
                        <div className="tc-card__body">
                          {r.format === "plain" ? (
                            <>
                              {tc.preconditions && (
                                <div className="tc-section">
                                  <label className="tc-section__label">Preconditions</label>
                                  <p className="tc-section__text">{tc.preconditions}</p>
                                </div>
                              )}
                              <div className="tc-section">
                                <label className="tc-section__label">Test Steps</label>
                                <ol className="tc-steps">
                                  {(Array.isArray(tc.steps) ? tc.steps : [tc.steps]).map((step, idx) => (
                                    <li key={idx}>{step}</li>
                                  ))}
                                </ol>
                              </div>
                              <div className="tc-section">
                                <label className="tc-section__label">Expected Result</label>
                                <p className="tc-section__text tc-expected">{tc.expectedResult}</p>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="tc-section">
                                <label className="tc-section__label">Scenario</label>
                                <p className="tc-section__text">{tc.scenario}</p>
                              </div>
                              <div className="tc-gherkin">
                                <div className="tc-gherkin__block given">
                                  <span className="tc-gherkin__keyword">Given</span>
                                  <ul>
                                    {(Array.isArray(tc.given) ? tc.given : [tc.given]).map((g, i) => (
                                      <li key={i}>{g}</li>
                                    ))}
                                  </ul>
                                </div>
                                <div className="tc-gherkin__block when">
                                  <span className="tc-gherkin__keyword">When</span>
                                  <ul>
                                    {(Array.isArray(tc.when) ? tc.when : [tc.when]).map((w, i) => (
                                      <li key={i}>{w}</li>
                                    ))}
                                  </ul>
                                </div>
                                <div className="tc-gherkin__block then">
                                  <span className="tc-gherkin__keyword">Then</span>
                                  <ul>
                                    {(Array.isArray(tc.then) ? tc.then : [tc.then]).map((t, i) => (
                                      <li key={i}>{t}</li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default History;
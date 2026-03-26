import React, { useEffect, useState } from "react";
import { collection, query, where, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db, auth } from "../../firebase";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import "./History.css";

function History() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [expandedCase, setExpandedCase] = useState(null);
  const [viewFormat, setViewFormat] = useState({});

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, "testgens"),
        where("userId", "==", auth.currentUser.uid)
      );
      const snap = await getDocs(q);
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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

  // ─── Format conversion helpers ───────────────────────────────────────────────
  const toGherkin = (tc) => ({
    scenario: tc.scenario || tc.title,
    given: tc.given || (tc.preconditions ? [tc.preconditions] : ["The system is available and the user is authenticated"]),
    when: tc.when || (Array.isArray(tc.steps) && tc.steps.length > 0 ? [tc.steps[0]] : ["The user performs the action"]),
    then: tc.then || (tc.expectedResult ? [tc.expectedResult] : ["The expected result is met"]),
  });

  const toPlain = (tc) => ({
    preconditions: tc.preconditions || (Array.isArray(tc.given) ? tc.given.join(". ") : tc.given || ""),
    steps: tc.steps || tc.when || [],
    expectedResult: tc.expectedResult || (Array.isArray(tc.then) ? tc.then.join(". ") : tc.then || ""),
  });

  const getActiveFormat = (record) => viewFormat[record.id] || record.format;

  // ─── Export ───────────────────────────────────────────────────────────────────
  const handleExport = (record, e) => {
    e.stopPropagation();
    const activeFormat = getActiveFormat(record);

    const rows = record.testCases.map((tc) => {
      if (activeFormat === "plain") {
        const plain = toPlain(tc);
        return {
          "Test Case ID": tc.id,
          "Title": tc.title,
          "Preconditions": plain.preconditions,
          "Test Steps": Array.isArray(plain.steps) ? plain.steps.join("\n") : plain.steps,
          "Expected Result": plain.expectedResult,
          "Priority": tc.priority,
          "Type": tc.type,
        };
      } else {
        const gherkin = toGherkin(tc);
        return {
          "Test Case ID": tc.id,
          "Title": tc.title,
          "Scenario": gherkin.scenario,
          "Given": Array.isArray(gherkin.given) ? gherkin.given.join("\n") : gherkin.given,
          "When": Array.isArray(gherkin.when) ? gherkin.when.join("\n") : gherkin.when,
          "Then": Array.isArray(gherkin.then) ? gherkin.then.join("\n") : gherkin.then,
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
      `TestGen_${record.source || "export"}_${activeFormat}.xlsx`
    );
  };

  // ─── Delete ───────────────────────────────────────────────────────────────────
  const handleDelete = async (id, e) => {
    e.stopPropagation();
    await deleteDoc(doc(db, "testgens", id));
    setRecords((prev) => prev.filter((r) => r.id !== id));
    if (expanded === id) setExpanded(null);
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────────
  const formatDate = (ts) => {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-NG", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
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

  // ─── Loading / Empty ──────────────────────────────────────────────────────────
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
        {records.map((r) => {
          const activeFormat = getActiveFormat(r);

          return (
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
                      {r.testCases?.length || 0} test cases · {formatDate(r.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="history-card__right">
                  {/* Format Toggle */}
                  <div
                    className="history-format-toggle"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className={`toggle-btn small ${activeFormat === "plain" ? "active" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewFormat((prev) => ({ ...prev, [r.id]: "plain" }));
                      }}
                    >
                      Plain
                    </button>
                    <button
                      className={`toggle-btn small ${activeFormat === "bdd" ? "active" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewFormat((prev) => ({ ...prev, [r.id]: "bdd" }));
                      }}
                    >
                      BDD
                    </button>
                  </div>

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
                    {r.testCases.map((tc, j) => {
                      const caseKey = `${r.id}-${j}`;
                      const isExpanded = expandedCase === caseKey;
                      const plain = toPlain(tc);
                      const gherkin = toGherkin(tc);

                      return (
                        <div
                          key={j}
                          className={`history-tc-card ${isExpanded ? "expanded" : ""}`}
                          onClick={() => setExpandedCase(isExpanded ? null : caseKey)}
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
                              <span className="tc-chevron">{isExpanded ? "▲" : "▼"}</span>
                            </div>
                          </div>

                          {/* Test Case Details */}
                          {isExpanded && (
                            <div className="tc-card__body">
                              {activeFormat === "plain" ? (
                                <>
                                  {plain.preconditions && (
                                    <div className="tc-section">
                                      <label className="tc-section__label">Preconditions</label>
                                      <p className="tc-section__text">{plain.preconditions}</p>
                                    </div>
                                  )}
                                  <div className="tc-section">
                                    <label className="tc-section__label">Test Steps</label>
                                    <ol className="tc-steps">
                                      {(Array.isArray(plain.steps) ? plain.steps : [plain.steps]).map((step, idx) => (
                                        <li key={idx}>{step}</li>
                                      ))}
                                    </ol>
                                  </div>
                                  <div className="tc-section">
                                    <label className="tc-section__label">Expected Result</label>
                                    <p className="tc-section__text tc-expected">{plain.expectedResult}</p>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="tc-section">
                                    <label className="tc-section__label">Scenario</label>
                                    <p className="tc-section__text">{gherkin.scenario}</p>
                                  </div>
                                  <div className="tc-gherkin">
                                    <div className="tc-gherkin__block given">
                                      <span className="tc-gherkin__keyword">Given</span>
                                      <ul>
                                        {(Array.isArray(gherkin.given) ? gherkin.given : [gherkin.given]).map((g, i) => (
                                          <li key={i}>{g}</li>
                                        ))}
                                      </ul>
                                    </div>
                                    <div className="tc-gherkin__block when">
                                      <span className="tc-gherkin__keyword">When</span>
                                      <ul>
                                        {(Array.isArray(gherkin.when) ? gherkin.when : [gherkin.when]).map((w, i) => (
                                          <li key={i}>{w}</li>
                                        ))}
                                      </ul>
                                    </div>
                                    <div className="tc-gherkin__block then">
                                      <span className="tc-gherkin__keyword">Then</span>
                                      <ul>
                                        {(Array.isArray(gherkin.then) ? gherkin.then : [gherkin.then]).map((t, i) => (
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
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default History;
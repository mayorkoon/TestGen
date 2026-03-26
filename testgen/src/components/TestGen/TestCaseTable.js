import React, { useState } from "react";
import "./TestGen.css";

function TestCaseTable({ testCases, format, onFormatChange }) {
  const [expanded, setExpanded] = useState(null);

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

  // ─── Badge helpers ────────────────────────────────────────────────────────────
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

  return (
    <div className="tc-table-wrapper">

      {/* Format toggle */}
      <div className="tc-format-toggle">
        <span className="tc-format-label">View as:</span>
        <div className="toggle-group">
          <button
            className={`toggle-btn ${format === "plain" ? "active" : ""}`}
            onClick={() => onFormatChange("plain")}
          >
            Plain
          </button>
          <button
            className={`toggle-btn ${format === "bdd" ? "active" : ""}`}
            onClick={() => onFormatChange("bdd")}
          >
            BDD / Gherkin
          </button>
        </div>
      </div>

      {/* Test case cards */}
      {testCases.map((tc, i) => {
        const plain = toPlain(tc);
        const gherkin = toGherkin(tc);

        return (
          <div
            key={tc.id || i}
            className={`tc-card ${expanded === i ? "expanded" : ""}`}
            onClick={() => setExpanded(expanded === i ? null : i)}
          >
            <div className="tc-card__header">
              <div className="tc-card__left">
                <span className="tc-id">{tc.id}</span>
                <span className="tc-title">{tc.title}</span>
              </div>
              <div className="tc-card__right">
                <span className={`tc-badge ${priorityColor(tc.priority)}`}>{tc.priority}</span>
                <span className={`tc-badge ${typeColor(tc.type)}`}>{tc.type}</span>
                <span className="tc-chevron">{expanded === i ? "▲" : "▼"}</span>
              </div>
            </div>

            {expanded === i && (
              <div className="tc-card__body">
                {format === "plain" ? (
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
                          {(Array.isArray(gherkin.given) ? gherkin.given : [gherkin.given]).map((g, idx) => (
                            <li key={idx}>{g}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="tc-gherkin__block when">
                        <span className="tc-gherkin__keyword">When</span>
                        <ul>
                          {(Array.isArray(gherkin.when) ? gherkin.when : [gherkin.when]).map((w, idx) => (
                            <li key={idx}>{w}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="tc-gherkin__block then">
                        <span className="tc-gherkin__keyword">Then</span>
                        <ul>
                          {(Array.isArray(gherkin.then) ? gherkin.then : [gherkin.then]).map((t, idx) => (
                            <li key={idx}>{t}</li>
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
  );
}

export default TestCaseTable;
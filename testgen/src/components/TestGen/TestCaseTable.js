import React, { useState } from "react";
import "./TestGen.css";

function TestCaseTable({ testCases, format }) {
  const [expanded, setExpanded] = useState(null);

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
      {testCases.map((tc, i) => (
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
                      <ul>{(Array.isArray(tc.given) ? tc.given : [tc.given]).map((g, i) => <li key={i}>{g}</li>)}</ul>
                    </div>
                    <div className="tc-gherkin__block when">
                      <span className="tc-gherkin__keyword">When</span>
                      <ul>{(Array.isArray(tc.when) ? tc.when : [tc.when]).map((w, i) => <li key={i}>{w}</li>)}</ul>
                    </div>
                    <div className="tc-gherkin__block then">
                      <span className="tc-gherkin__keyword">Then</span>
                      <ul>{(Array.isArray(tc.then) ? tc.then : [tc.then]).map((t, i) => <li key={i}>{t}</li>)}</ul>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default TestCaseTable;

import { useState } from 'react';

/**
 * Runs the Phase 1 database self-test and shows every check with a pass/fail
 * mark and the evidence behind it.
 *
 * This is a developer/verification tool, not a shop screen. It stays available
 * through the build phases and moves into an admin "Diagnostics" page later.
 */
export default function SelfTestPanel() {
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);

  async function runTest() {
    setBusy(true);
    const res = await window.api.db.selfTest();
    setBusy(false);
    setReport(res.ok ? res.data : { ok: false, checks: [], error: res.message });
  }

  return (
    <div className="selftest">
      <button className="btn btn--block" onClick={runTest} disabled={busy}>
        {busy ? 'Running…' : 'Run database self-test'}
      </button>

      {report && (
        <>
          <div className={`callout ${report.ok ? 'callout--ok' : 'callout--error'}`}>
            <strong>
              {report.ok ? 'All checks passed' : 'Some checks failed'} — {report.passed ?? 0}/
              {report.total ?? 0}
            </strong>
            {report.error && <p>{report.error}</p>}
          </div>

          <ul className="checklist">
            {report.checks.map((c) => (
              <li key={c.name} className={c.pass ? 'checklist__item' : 'checklist__item is-fail'}>
                <span className="checklist__mark">{c.pass ? '✓' : '✕'}</span>
                <span className="checklist__body">
                  <span className="checklist__name">{c.name}</span>
                  {c.detail && <span className="checklist__detail">{c.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

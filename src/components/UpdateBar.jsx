import { useEffect, useState } from 'react';

/**
 * Thin bar at the top of the app that shows auto-update progress.
 *
 * Stages:
 *   checking    → silent (no UI)
 *   downloading → blue bar with percentage
 *   ready       → green bar with "Restart now" button
 *   error       → silent (network errors are normal for an offline shop)
 *   up-to-date  → silent
 *
 * The main process may fire status events *before* React has mounted this
 * component. To avoid losing them, we call getStatus() on mount, replay
 * every buffered log line, and only then subscribe to future events.
 */
export default function UpdateBar() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (!window.api?.updater) return;

    // Catch up on anything that fired before we mounted.
    window.api.updater.getStatus?.().then((res) => {
      if (!res) return;
      if (res.logs && res.logs.length) {
        // Replay every line into the DevTools console for on-site debugging.
        res.logs.forEach((line) => console.log(line));
      }
      if (res.status) {
        setStatus(res.status);
      }
    }).catch((err) => console.warn('[updater] getStatus failed:', err));

    // Live status.
    const cleanupStatus = window.api.updater.onStatus((s) => {
      console.log('[updater] status', s);
      setStatus(s);
    });

    // Live raw log lines from the main process.
    const cleanupLog = window.api.updater.onLog
      ? window.api.updater.onLog((line) => console.log(line))
      : () => {};

    return () => {
      cleanupStatus && cleanupStatus();
      cleanupLog && cleanupLog();
    };
  }, []);

  if (!status) return null;

  // Downloading — show progress bar
  if (status.stage === 'downloading') {
    const pct = status.percent || 0;
    return (
      <div className="update-bar update-bar--downloading">
        <span>Downloading update{status.version ? ` v${status.version}` : ''}… {pct}%</span>
        <div className="update-bar__track">
          <div className="update-bar__fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }

  // Ready to install
  if (status.stage === 'ready') {
    return (
      <div className="update-bar update-bar--ready">
        <span>Update v{status.version} is ready.</span>
        <button
          className="btn btn--small btn--primary"
          onClick={() => window.api.updater.install()}
        >
          Restart now
        </button>
      </div>
    );
  }

  // Everything else (checking, up-to-date, error) — no UI
  return null;
}

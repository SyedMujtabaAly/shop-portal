import { useState } from 'react';
import ThetaXBadge from '../components/ThetaXBadge.jsx';

/**
 * First-run screen. Shown until the admin has picked a writable folder on the
 * hard drive for the shop's database and bill screenshots.
 *
 * Also shown later if that folder goes missing (deleted, or an external drive
 * was unplugged) — the `status.reason` decides the wording.
 */

const MESSAGES = {
  NOT_SET: {
    title: 'Welcome — first time setup',
    body: 'Choose a folder on this computer where all shop data will be saved: the database, and every bill or payment screenshot you upload. Pick a folder you will not delete or move.'
  },
  MISSING: {
    title: 'Data folder not found',
    body: 'The folder this software was using no longer exists. If it was moved, choose the new location. If a USB or external drive was used, plug it back in and restart the software.'
  },
  NOT_WRITABLE: {
    title: 'Data folder is read-only',
    body: 'This software cannot save files into the selected folder. Choose a different folder, or ask an administrator to give write permission.'
  }
};

export default function FirstRunSetup({ status, onDone }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const copy = MESSAGES[status.reason] || MESSAGES.NOT_SET;

  async function handleChoose() {
    setBusy(true);
    setError(null);
    const res = await window.api.dataFolder.choose();
    setBusy(false);

    if (!res.ok) {
      setError(res.message || 'Something went wrong. Please try again.');
      return;
    }
    // The IPC layer wraps the service result, so unwrap one more level.
    const inner = res.data;
    if (!inner.ok) {
      if (inner.error === 'CANCELLED') return; // admin closed the picker, no error
      setError(inner.message || 'That folder could not be used.');
      return;
    }
    onDone();
  }

  return (
    <div className="centered-page">
      <div className="card">
        <div className="brand">
          <div className="brand__mark">RT</div>
          <div>
            <div className="brand__name">Shop Manager</div>
            <div className="brand__tag">Shop management</div>
          </div>
        </div>

        <h1 className="card__title">{copy.title}</h1>
        <p className="text-muted">{copy.body}</p>

        {status.folder && (
          <div className="callout callout--warn">
            <strong>Previously used folder</strong>
            <code className="path">{status.folder}</code>
          </div>
        )}

        <div className="callout">
          <strong>What will be created inside the folder you choose</strong>
          <ul className="tree">
            <li><code>shop.db</code> — the shop database (all accounts and stock)</li>
            <li><code>attachments\</code> — bill and payment screenshots</li>
            <li><code>backups\</code> — copies of the database</li>
            <li><code>logs\</code> — error logs</li>
          </ul>
        </div>

        {error && <div className="callout callout--error">{error}</div>}

        <button className="btn btn--primary btn--block" onClick={handleChoose} disabled={busy}>
          {busy ? 'Please wait…' : 'Choose data folder'}
        </button>
      </div>

      <ThetaXBadge className="theta-badge--center" />
    </div>
  );
}

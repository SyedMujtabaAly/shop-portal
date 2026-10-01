import { useState } from 'react';
import Field from './Field.jsx';

/**
 * Lets the signed-in user change their own password.
 *
 * The current password is required even though they are already signed in —
 * otherwise anyone who found the laptop unattended could lock the real owner
 * out of his own shop.
 */
export default function ChangePassword() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setDone(false);

    if (next !== confirm) {
      setError('The two new passwords do not match.');
      return;
    }

    setBusy(true);
    const res = await window.api.auth.changePassword({
      currentPassword: current,
      newPassword: next
    });
    setBusy(false);

    if (!res.ok) {
      setError(res.message);
      return;
    }

    setDone(true);
    setCurrent('');
    setNext('');
    setConfirm('');
  }

  if (!open) {
    return (
      <div className="panel">
        <h2 className="panel__title">Your account</h2>
        <button className="btn" onClick={() => setOpen(true)}>
          Change my password
        </button>
      </div>
    );
  }

  return (
    <form className="panel" onSubmit={submit}>
      <h2 className="panel__title">Change my password</h2>

      <div className="grid-2">
        <Field
          label="Current password"
          type="password"
          value={current}
          onChange={setCurrent}
          autoFocus
          disabled={busy}
        />
        <div />
        <Field
          label="New password"
          type="password"
          value={next}
          onChange={setNext}
          disabled={busy}
          hint="At least 6 characters"
        />
        <Field
          label="Confirm new password"
          type="password"
          value={confirm}
          onChange={setConfirm}
          disabled={busy}
        />
      </div>

      {error && <div className="callout callout--error">{error}</div>}
      {done && <div className="callout callout--ok">Password changed.</div>}

      <div className="btn-row">
        <button className="btn btn--primary" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save new password'}
        </button>
        <button className="btn" type="button" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
    </form>
  );
}

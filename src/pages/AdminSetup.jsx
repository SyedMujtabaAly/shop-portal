import { useState } from 'react';
import Field from '../components/Field.jsx';
import ThetaXBadge from '../components/ThetaXBadge.jsx';

/**
 * Shown exactly once: the shop owner creates his own account.
 *
 * The app refuses to go any further until this exists, so the database can
 * never end up with sales that belong to nobody. The main process only allows
 * this while no admin exists, so it cannot be replayed later to mint a second
 * owner.
 */
export default function AdminSetup({ shopName, onDone }) {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // After the account is created, we show the recovery key once.
  const [recoveryKey, setRecoveryKey] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError(null);

    if (pass !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    setBusy(true);
    const res = await window.api.auth.createFirstAdmin({ username, fullName, password: pass });

    if (!res.ok) {
      setBusy(false);
      setError(res.message || 'Could not create the account.');
      return;
    }

    // Generate the recovery key right after creating the admin account.
    // The admin must write this down — it is the only way to reset a
    // forgotten password on offline software.
    const keyRes = await window.api.auth.setRecoveryKey();
    setBusy(false);

    if (keyRes.ok) {
      setRecoveryKey(keyRes.data);
    } else {
      // Account was created but key failed — continue anyway, the admin
      // can regenerate it from Settings later.
      onDone();
    }
  }

  // After account creation, show the recovery key screen instead of the form.
  if (recoveryKey) {
    return (
      <div className="centered-page">
        <div className="card">
          <h1 className="card__title">Account created</h1>

          <div className="callout callout--warn">
            <strong>Write this recovery key on paper and keep it safe</strong>
            <p>
              If you ever forget your password, you will need this key to reset it. This is the
              only time it will be shown. It cannot be recovered later.
            </p>
          </div>

          <div style={{
            textAlign: 'center', padding: '20px', margin: '16px 0',
            background: 'var(--c-bg-raised, #f5f5f5)', borderRadius: 8,
            border: '2px dashed var(--c-warn-border, #ffe082)',
            fontSize: '2rem', fontFamily: 'monospace', letterSpacing: '0.3em'
          }}>
            {recoveryKey}
          </div>

          <p className="text-muted" style={{ textAlign: 'center' }}>
            You can regenerate this key later from <strong>Settings</strong>, but only while you
            are logged in.
          </p>

          <button className="btn btn--primary btn--block" onClick={onDone}>
            I have written it down — continue
          </button>
        </div>

        <ThetaXBadge className="theta-badge--center" />
      </div>
    );
  }

  return (
    <div className="centered-page">
      <form className="card" onSubmit={submit}>
        <div className="brand">
          <div className="brand__mark">RT</div>
          <div>
            <div className="brand__name">{shopName || 'Shop Manager'}</div>
            <div className="brand__tag">Shop management</div>
          </div>
        </div>

        <h1 className="card__title">Create the owner account</h1>
        <p className="text-muted">
          This is the shop owner's account. It has full control: stock, prices, reports and
          creating accounts for workers. It is created only once.
        </p>

        <Field
          label="Your full name"
          value={fullName}
          onChange={setFullName}
          autoFocus
          disabled={busy}
          placeholder="e.g. Ali Khan"
        />
        <Field
          label="Username"
          value={username}
          onChange={setUsername}
          disabled={busy}
          hint="3–20 characters. Letters, numbers or underscore."
          placeholder="e.g. admin"
        />
        <Field
          label="Password"
          type="password"
          value={pass}
          onChange={setPass}
          disabled={busy}
          hint="At least 6 characters."
        />
        <Field
          label="Confirm password"
          type="password"
          value={confirm}
          onChange={setConfirm}
          disabled={busy}
        />

        {error && <div className="callout callout--error">{error}</div>}

        <div className="callout callout--warn">
          <strong>Write your password down</strong>
          <p>
            The software stores the password in a scrambled form that cannot be reversed. A
            recovery key will be shown on the next screen in case you forget it.
          </p>
        </div>

        <button className="btn btn--primary btn--block" type="submit" disabled={busy}>
          {busy ? 'Creating…' : 'Create owner account'}
        </button>
      </form>

      <ThetaXBadge className="theta-badge--center" />
    </div>
  );
}

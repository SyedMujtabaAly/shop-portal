import { useEffect, useState } from 'react';
import Field from '../components/Field.jsx';
import ThetaXBadge from '../components/ThetaXBadge.jsx';

/**
 * The login screen. Both the owner and workers use it.
 *
 * If a recovery key was set up during first run, users can reset their
 * password from this screen by clicking "Forgot password?" and entering
 * the recovery key.
 */
export default function Login({ shopName, onLoggedIn }) {
  const [username, setUsername] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [mode, setMode] = useState('login');

  // Recovery form state
  const [recoverUser, setRecoverUser] = useState('');
  const [recoverKey, setRecoverKey] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    window.api.auth.hasRecoveryKey().then((r) => {
      if (r.ok) setHasKey(r.data);
    });
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const res = await window.api.auth.login({ username, password: pass });
    setBusy(false);

    if (!res.ok) {
      setError(res.message || 'Could not sign in.');
      setPass('');
      return;
    }
    onLoggedIn();
  }

  async function recover(e) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (newPass !== confirmPass) {
      setError('The two passwords do not match.');
      return;
    }

    setBusy(true);
    const res = await window.api.auth.recoverPassword({
      username: recoverUser,
      recoveryKey: recoverKey,
      newPassword: newPass
    });
    setBusy(false);

    if (!res.ok) {
      setError(res.message || 'Could not reset the password.');
      return;
    }

    setNotice('Password has been reset. You can now sign in with the new password.');
    setMode('login');
    setUsername(recoverUser);
    setPass('');
    setRecoverUser('');
    setRecoverKey('');
    setNewPass('');
    setConfirmPass('');
  }

  // --- Recovery: username + recovery key ---
  if (mode === 'recover') {
    return (
      <div className="centered-page">
        <form className="card card--narrow" onSubmit={recover}>
          <div className="brand">
            <div className="brand__mark">RT</div>
            <div>
              <div className="brand__name">{shopName || 'Shop Manager'}</div>
              <div className="brand__tag">Shop management</div>
            </div>
          </div>

          <h1 className="card__title">Reset password</h1>
          <p className="text-muted">
            Enter your username and the recovery key that was shown when the software was first
            set up. If you do not have it, ask the shop admin.
          </p>

          <Field
            label="Username"
            value={recoverUser}
            onChange={setRecoverUser}
            autoFocus
            disabled={busy}
          />
          <Field
            label="Recovery key"
            value={recoverKey}
            onChange={(v) => setRecoverKey(v.toUpperCase())}
            disabled={busy}
            hint="8-character code, e.g. A3K7M9P2"
            placeholder="XXXXXXXX"
          />
          <Field
            label="New password"
            type="password"
            value={newPass}
            onChange={setNewPass}
            disabled={busy}
            hint="At least 6 characters"
          />
          <Field
            label="Confirm new password"
            type="password"
            value={confirmPass}
            onChange={setConfirmPass}
            disabled={busy}
          />

          {error && <div className="callout callout--error">{error}</div>}

          <button className="btn btn--primary btn--block" type="submit" disabled={busy}>
            {busy ? 'Resetting…' : 'Reset password'}
          </button>

          <button
            className="btn btn--block"
            type="button"
            onClick={() => { setMode('login'); setError(null); }}
            style={{ marginTop: 8 }}
          >
            ← Back to sign in
          </button>
        </form>

        <ThetaXBadge className="theta-badge--center" />
      </div>
    );
  }

  // --- Normal login ---
  return (
    <div className="centered-page">
      <form className="card card--narrow" onSubmit={submit}>
        <div className="brand">
          <div className="brand__mark">RT</div>
          <div>
            <div className="brand__name">{shopName || 'Shop Manager'}</div>
            <div className="brand__tag">Shop management</div>
          </div>
        </div>

        <h1 className="card__title">Sign in</h1>

        {notice && <div className="callout callout--ok">{notice}</div>}

        <Field label="Username" value={username} onChange={setUsername} autoFocus disabled={busy} />
        <Field
          label="Password"
          type="password"
          value={pass}
          onChange={setPass}
          disabled={busy}
          autoComplete="current-password"
        />

        {error && <div className="callout callout--error">{error}</div>}

        <button className="btn btn--primary btn--block" type="submit" disabled={busy}>
          {busy ? 'Checking…' : 'Sign in'}
        </button>

        {hasKey && (
          <button
            className="btn btn--link"
            type="button"
            onClick={() => { setMode('recover'); setError(null); setNotice(null); }}
            style={{ marginTop: 12, display: 'block', width: '100%', textAlign: 'center' }}
          >
            Forgot password?
          </button>
        )}

        <div style={{ marginTop: 24 }}>
          <ThetaXBadge className="theta-badge--center" />
        </div>
      </form>
    </div>
  );
}

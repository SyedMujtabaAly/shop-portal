import { useEffect, useState } from 'react';
import Field from '../components/Field.jsx';
import ConfirmBar from '../components/ConfirmBar.jsx';

/**
 * Admin-only: create workers, disable them, reset forgotten passwords, or
 * delete accounts permanently.
 */
const ROLE_LABELS = { admin: 'Admin', owner: 'Owner', user: 'Worker' };

export default function Users({ me, readOnly = false }) {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [resetFor, setResetFor] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [pass, setPass] = useState('');
  const [role, setRole] = useState('user');
  const [newPass, setNewPass] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await window.api.users.list();
    if (res.ok) setUsers(res.data);
    else setError(res.message);
  }

  useEffect(() => {
    load();
  }, []);

  function resetForm() {
    setFullName('');
    setUsername('');
    setPass('');
    setRole('user');
    setShowForm(false);
  }

  async function createUser(e) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    const res = await window.api.users.create({ username, fullName, password: pass, role });
    setBusy(false);

    if (!res.ok) {
      setError(res.message);
      return;
    }
    setNotice(`Account created for ${res.data.fullName}.`);
    resetForm();
    load();
  }

  async function toggleActive(u) {
    setError(null);
    setNotice(null);
    const res = await window.api.users.setActive({ id: u.id, isActive: !u.isActive });
    if (!res.ok) setError(res.message);
    else load();
  }

  async function doReset(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await window.api.users.resetPassword({ id: resetFor.id, newPassword: newPass });
    setBusy(false);

    if (!res.ok) {
      setError(res.message);
      return;
    }
    setNotice(`Password reset for ${resetFor.username}.`);
    setResetFor(null);
    setNewPass('');
  }

  async function confirmRemove() {
    const u = deleting;
    setError(null);
    setNotice(null);
    setBusy(true);
    const res = await window.api.users.remove({ id: u.id });
    setBusy(false);
    setDeleting(null);

    if (!res.ok) setError(res.message);
    else {
      setNotice(`Deleted account "${u.username}" (${u.fullName}).`);
      load();
    }
  }

  return (
    <div className="page">
      <div className="page__head">
        <h1 className="page__title">Users</h1>
        {!readOnly && (
          <button className="btn btn--primary" onClick={() => setShowForm((s) => !s)}>
            {showForm ? 'Cancel' : 'Add user'}
          </button>
        )}
      </div>

      {error && <div className="callout callout--error">{error}</div>}
      {notice && <div className="callout callout--ok">{notice}</div>}

      {deleting && (
        <ConfirmBar
          title={`Delete account "${deleting.username}"?`}
          message={`${deleting.fullName} will be removed permanently. Their past sales will show "deleted user". This cannot be undone.`}
          busy={busy}
          onConfirm={confirmRemove}
          onCancel={() => setDeleting(null)}
        />
      )}

      {showForm && (
        <form className="panel" onSubmit={createUser}>
          <h2 className="panel__title">New account</h2>
          <div className="grid-2">
            <Field label="Full name" value={fullName} onChange={setFullName} autoFocus disabled={busy} />
            <Field
              label="Username"
              value={username}
              onChange={setUsername}
              disabled={busy}
              hint="3–20 characters, letters/numbers/underscore"
            />
            <Field
              label="Password"
              type="password"
              value={pass}
              onChange={setPass}
              disabled={busy}
              hint="At least 6 characters"
            />
            <label className="field">
              <span className="field__label">Role</span>
              <select
                className="field__input"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                disabled={busy}
              >
                <option value="user">Worker — can record sales and print bills</option>
                <option value="owner">Owner — can view everything but cannot edit</option>
                <option value="admin">Admin — full control over the entire software</option>
              </select>
              <span className="field__hint">
                Workers see only sales. Owners see all tabs but cannot change anything. Admins have full control.
              </span>
            </label>
          </div>
          <button className="btn btn--primary" type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create account'}
          </button>
        </form>
      )}

      {resetFor && (
        <form className="panel" onSubmit={doReset}>
          <h2 className="panel__title">Reset password for {resetFor.username}</h2>
          <Field
            label="New password"
            type="password"
            value={newPass}
            onChange={setNewPass}
            autoFocus
            disabled={busy}
            hint="At least 6 characters. Tell the worker in person."
          />
          <div className="btn-row">
            <button className="btn btn--primary" type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Set new password'}
            </button>
            <button
              className="btn"
              type="button"
              onClick={() => {
                setResetFor(null);
                setNewPass('');
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Username</th>
            <th>Role</th>
            <th>Status</th>
            <th>Last sign in</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className={u.isActive ? '' : 'is-muted'}>
              <td>
                {u.fullName}
                {u.id === me.id && <span className="badge"> you</span>}
              </td>
              <td>
                <code>{u.username}</code>
              </td>
              <td>
                <span className={`role role--${u.role}`}>
                  {ROLE_LABELS[u.role] || u.role}
                </span>
              </td>
              <td>{u.isActive ? 'Active' : 'Disabled'}</td>
              <td className="text-muted">
                {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'never'}
              </td>
              {!readOnly && (
                <td className="table__actions">
                  <button className="btn btn--small" onClick={() => setResetFor(u)}>
                    Reset password
                  </button>
                  <button
                    className="btn btn--small"
                    onClick={() => toggleActive(u)}
                    disabled={u.id === me.id}
                    title={u.id === me.id ? 'You cannot disable your own account' : ''}
                  >
                    {u.isActive ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    className="btn btn--small btn--danger"
                    onClick={() => setDeleting(u)}
                    disabled={u.id === me.id}
                    title={u.id === me.id ? 'You cannot delete your own account' : 'Delete permanently'}
                  >
                    Delete
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

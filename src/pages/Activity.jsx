import { useEffect, useState } from 'react';

/**
 * Admin-only: the audit log.
 *
 * This is the owner's answer to "who did what". Phase 2 records logins, failed
 * logins and user changes; later phases add sales, stock and payments.
 */

const LABELS = {
  admin_created: 'Owner account created',
  login: 'Signed in',
  login_failed: 'Failed sign-in attempt',
  logout: 'Signed out',
  user_created: 'Account created',
  user_enabled: 'Account enabled',
  user_disabled: 'Account disabled',
  password_changed: 'Changed own password',
  password_reset: 'Password reset by owner'
};

export default function Activity() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    window.api.users.auditRecent(100).then((res) => {
      if (res.ok) setRows(res.data);
      else setError(res.message);
    });
  }, []);

  return (
    <div className="page">
      <div className="page__head">
        <h1 className="page__title">Activities</h1>
      </div>

      {error && <div className="callout callout--error">{error}</div>}

      <table className="table">
        <thead>
          <tr>
            <th>When</th>
            <th>Who</th>
            <th>What happened</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="text-muted">
                Nothing recorded yet.
              </td>
            </tr>
          )}
          {rows.map((r) => {
            const details = r.details ? JSON.parse(r.details) : null;
            return (
              <tr key={r.id} className={r.action === 'login_failed' ? 'is-warn' : ''}>
                <td className="text-muted">{new Date(r.created_at).toLocaleString()}</td>
                <td>{r.full_name || r.username || '—'}</td>
                <td>{LABELS[r.action] || r.action}</td>
                <td className="text-muted">
                  {details ? Object.entries(details).map(([k, v]) => `${k}: ${v}`).join(', ') : ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

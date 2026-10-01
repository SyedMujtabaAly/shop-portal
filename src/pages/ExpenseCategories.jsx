import { useEffect, useState } from 'react';
import Field from '../components/Field.jsx';
import ConfirmBar from '../components/ConfirmBar.jsx';
import { formatPaisa } from '../lib/format.js';

/**
 * Expense categories. The client asked for "har trahan ka expense", so the
 * shop defines its own list — seven are seeded and the rest is up to him.
 *
 * Same rule as everywhere else in this project: delete only while unused,
 * switch off once there is history behind it.
 */
export default function ExpenseCategories({ onChanged, readOnly = false }) {
  const [rows, setRows] = useState([]);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await window.api.expenseCategories.list();
    if (res.ok) setRows(res.data);
    else setError(res.message);
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);

    const res = editing
      ? await window.api.expenseCategories.rename({ id: editing.id, name })
      : await window.api.expenseCategories.create({ name });

    setBusy(false);
    if (!res.ok) return setError(res.message);

    setNotice(editing ? `Renamed to "${res.data.name}".` : `Added "${res.data.name}".`);
    setName('');
    setEditing(null);
    load();
    onChanged?.();
  }

  async function toggle(row) {
    const res = await window.api.expenseCategories.setActive({
      id: row.id,
      isActive: !row.isActive
    });
    if (!res.ok) setError(res.message);
    else {
      load();
      onChanged?.();
    }
  }

  async function confirmDelete() {
    setBusy(true);
    const res = await window.api.expenseCategories.remove({ id: deleting.id });
    setBusy(false);
    setDeleting(null);
    if (!res.ok) setError(res.message);
    else {
      setNotice(`Deleted "${deleting.name}".`);
      load();
      onChanged?.();
    }
  }

  return (
    <>
      {error && <div className="callout callout--error">{error}</div>}
      {notice && <div className="callout callout--ok">{notice}</div>}

      {deleting && (
        <ConfirmBar
          title={`Delete "${deleting.name}"?`}
          message="This category has never been used, so nothing will be lost."
          busy={busy}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}

      {!readOnly && (
        <form className="panel" onSubmit={submit}>
          <h2 className="panel__title">{editing ? `Rename ${editing.name}` : 'Add a category'}</h2>
          <div className="grid-2">
            <Field
              label="Category name"
              value={name}
              onChange={setName}
              disabled={busy}
              placeholder="e.g. Chai, Gari kharcha, Bijli, Salary"
            />
          </div>
          <div className="btn-row">
            <button className="btn btn--primary" type="submit" disabled={busy}>
              {busy ? 'Saving…' : editing ? 'Save name' : 'Add category'}
            </button>
            {editing && (
              <button
                className="btn"
                type="button"
                onClick={() => {
                  setEditing(null);
                  setName('');
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>Category</th>
            <th className="num">Times used</th>
            <th className="num">Total spent</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={r.isActive ? '' : 'is-muted'}>
              <td>{r.name}</td>
              <td className="num">{r.useCount}</td>
              <td className="num">{formatPaisa(r.totalPaisa)}</td>
              <td>{r.isActive ? 'Active' : 'Off'}</td>
              {!readOnly && (
                <td className="table__actions">
                  <button
                    className="btn btn--small"
                    onClick={() => {
                      setEditing(r);
                      setName(r.name);
                    }}
                  >
                    Rename
                  </button>
                  <button className="btn btn--small" onClick={() => toggle(r)}>
                    {r.isActive ? 'Switch off' : 'Switch on'}
                  </button>
                  <button
                    className="btn btn--small btn--danger"
                    onClick={() => setDeleting(r)}
                    disabled={r.useCount > 0}
                    title={r.useCount > 0 ? 'Already used — switch it off instead' : 'Delete'}
                  >
                    Delete
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

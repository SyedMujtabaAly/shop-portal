import { useEffect, useState } from 'react';
import Field from '../components/Field.jsx';
import ConfirmBar from '../components/ConfirmBar.jsx';

/**
 * Oil companies / brands. Add, rename, switch on or off.
 *
 * There is no delete button anywhere on this page, by design. A company with
 * history cannot be removed without orphaning old purchases, so it is switched
 * off instead: gone from the pickers, intact in the records.
 */
export default function Companies({ onChanged, readOnly = false }) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(null);

  async function load() {
    const res = await window.api.companies.list();
    if (res.ok) setRows(res.data);
    else setError(res.message);
  }

  useEffect(() => {
    load();
  }, []);

  function clearForm() {
    setName('');
    setNotes('');
    setEditing(null);
  }

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);

    const res = editing
      ? await window.api.companies.update({ id: editing.id, name, notes })
      : await window.api.companies.create({ name, notes });

    setBusy(false);

    if (!res.ok) {
      setError(res.message);
      return;
    }
    setNotice(editing ? `Saved "${res.data.name}".` : `Added "${res.data.name}".`);
    clearForm();
    load();
    onChanged?.();
  }

  async function toggle(row) {
    setError(null);
    const res = await window.api.companies.setActive({ id: row.id, isActive: !row.isActive });
    if (!res.ok) setError(res.message);
    else {
      load();
      onChanged?.();
    }
  }

  async function confirmRemove() {
    const row = deleting;
    setError(null);
    setNotice(null);
    setBusy(true);
    const res = await window.api.companies.remove({ id: row.id });
    setBusy(false);
    setDeleting(null);

    if (!res.ok) setError(res.message);
    else {
      setNotice(`Deleted "${row.name}".`);
      load();
      onChanged?.();
    }
  }

  function startEdit(row) {
    setEditing(row);
    setName(row.name);
    setNotes(row.notes || '');
  }

  return (
    <>
      {error && <div className="callout callout--error">{error}</div>}
      {notice && <div className="callout callout--ok">{notice}</div>}

      {deleting && (
        <ConfirmBar
          title={`Delete "${deleting.name}"?`}
          message={
            deleting.productCount > 0
              ? `This company has ${deleting.productCount} product(s). All products and their stock/sale/purchase records will be removed permanently. This cannot be undone.`
              : 'This company will be removed permanently. This cannot be undone.'
          }
          busy={busy}
          onConfirm={confirmRemove}
          onCancel={() => setDeleting(null)}
        />
      )}

      {!readOnly && (
        <form className="panel" onSubmit={submit}>
          <h2 className="panel__title">{editing ? `Edit ${editing.name}` : 'Add a company'}</h2>
          <div className="grid-2">
            <Field
              label="Company name"
              value={name}
              onChange={setName}
              disabled={busy}
              placeholder="e.g. Dalda, Sufi, Kisan"
            />
            <Field
              label="Notes (optional)"
              value={notes}
              onChange={setNotes}
              disabled={busy}
              placeholder="anything worth remembering"
            />
          </div>
          <div className="btn-row">
            <button className="btn btn--primary" type="submit" disabled={busy}>
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Add company'}
            </button>
            {editing && (
              <button className="btn" type="button" onClick={clearForm}>
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>Company</th>
            <th>Products</th>
            <th>Notes</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="text-muted">
                No companies yet. Add the first one above.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.id} className={r.isActive ? '' : 'is-muted'}>
              <td>{r.name}</td>
              <td>{r.productCount}</td>
              <td className="text-muted">{r.notes || '—'}</td>
              <td>{r.isActive ? 'Active' : 'Off'}</td>
              {!readOnly && (
                <td className="table__actions">
                  <button className="btn btn--small" onClick={() => startEdit(r)}>
                    Edit
                  </button>
                  <button className="btn btn--small" onClick={() => toggle(r)}>
                    {r.isActive ? 'Switch off' : 'Switch on'}
                  </button>
                  <button
                    className="btn btn--small btn--danger"
                    onClick={() => setDeleting(r)}
                    title="Delete permanently"
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

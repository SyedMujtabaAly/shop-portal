import { useEffect, useState } from 'react';
import Field from '../components/Field.jsx';
import ConfirmBar from '../components/ConfirmBar.jsx';
import { formatPaisa, paisaToRupees } from '../lib/format.js';

/**
 * Suppliers and customers.
 *
 * One component serves both because they are mirror images: a supplier balance
 * is what the shop owes, a customer balance is what the shop is owed. The
 * wording flips; the fields do not.
 *
 * The opening balance is the figure carried over from the shop's notebook on
 * day one. It can only be corrected while the contact has no bills yet — after
 * that, a correction belongs in a payment record, not by quietly moving the
 * starting line.
 */

const COPY = {
  customer: {
    title: 'Customers',
    add: 'Add customer',
    balanceLabel: 'Owes us',
    openingLabel: 'Amount they already owe (Rs)',
    openingHint: 'From your notebook, before this software. Leave 0 if none.',
    empty: 'No customers yet. Walk-in cash customers do not need to be added — only udhaar customers.'
  },
  supplier: {
    title: 'Suppliers',
    add: 'Add supplier',
    balanceLabel: 'We owe',
    openingLabel: 'Amount we already owe them (Rs)',
    openingHint: 'From your notebook, before this software. Leave 0 if none.',
    empty: 'No suppliers yet.'
  }
};

const EMPTY = { name: '', phone: '', address: '', notes: '', openingBalanceRupees: '0' };

export default function Contacts({ kind = 'customer', readOnly = false }) {
  const copy = COPY[kind];

  return (
    <div className="page">
      <div className="page__head">
        <h1 className="page__title">{copy.title}</h1>
      </div>

      <PartyList kind={kind} onCount={() => {}} readOnly={readOnly} />
    </div>
  );
}

function PartyList({ kind, onCount, readOnly = false }) {
  const api = kind === 'customer' ? window.api.customers : window.api.suppliers;
  const copy = COPY[kind];

  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(null);

  async function load() {
    const res = await api.list();
    if (res.ok) {
      setRows(res.data);
      onCount(res.data.length);
    } else {
      setError(res.message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function openNew() {
    setEditing(null);
    setForm(EMPTY);
    setShowForm(true);
    setError(null);
  }

  function openEdit(row) {
    setEditing(row);
    setForm({
      name: row.name,
      phone: row.phone || '',
      address: row.address || '',
      notes: row.notes || '',
      openingBalanceRupees: String(paisaToRupees(row.openingBalancePaisa))
    });
    setShowForm(true);
    setError(null);
  }

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);

    const res = editing ? await api.update({ ...form, id: editing.id }) : await api.create(form);

    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }

    setNotice(editing ? `Saved "${res.data.name}".` : `Added "${res.data.name}".`);
    setShowForm(false);
    setEditing(null);
    setForm(EMPTY);
    load();
  }

  async function toggle(row) {
    const res = await api.setActive({ id: row.id, isActive: !row.isActive });
    if (!res.ok) setError(res.message);
    else load();
  }

  async function confirmRemove() {
    const row = deleting;
    setError(null);
    setNotice(null);
    setBusy(true);
    const res = await api.remove({ id: row.id });
    setBusy(false);
    setDeleting(null);

    if (!res.ok) setError(res.message);
    else {
      setNotice(`Deleted "${row.name}".`);
      load();
    }
  }

  return (
    <>
      {error && <div className="callout callout--error">{error}</div>}
      {notice && <div className="callout callout--ok">{notice}</div>}

      {deleting && (
        <ConfirmBar
          title={`Delete "${deleting.name}"?`}
          message={
            deleting.hasHistory
              ? 'This contact has bills or payments recorded. All related payment records will be removed permanently. This cannot be undone.'
              : 'This contact will be removed permanently. This cannot be undone.'
          }
          busy={busy}
          onConfirm={confirmRemove}
          onCancel={() => setDeleting(null)}
        />
      )}

      {!readOnly && (
        <div className="toolbar">
          <button className="btn btn--primary" onClick={showForm ? () => setShowForm(false) : openNew}>
            {showForm ? 'Cancel' : copy.add}
          </button>
        </div>
      )}

      {showForm && !readOnly && (
        <form className="panel" onSubmit={submit}>
          <h2 className="panel__title">{editing ? `Edit ${editing.name}` : copy.add}</h2>

          <div className="grid-2">
            <Field label="Name" value={form.name} onChange={(v) => set('name', v)} disabled={busy} />
            <Field
              label="Phone (optional)"
              value={form.phone}
              onChange={(v) => set('phone', v)}
              disabled={busy}
            />
            <Field
              label="Address (optional)"
              value={form.address}
              onChange={(v) => set('address', v)}
              disabled={busy}
            />
            <Field
              label="Notes (optional)"
              value={form.notes}
              onChange={(v) => set('notes', v)}
              disabled={busy}
            />
            <Field
              label={copy.openingLabel}
              type="number"
              value={form.openingBalanceRupees}
              onChange={(v) => set('openingBalanceRupees', v)}
              disabled={busy || editing?.hasHistory}
              hint={
                editing?.hasHistory
                  ? 'Locked — this contact already has bills. Record a payment instead.'
                  : copy.openingHint
              }
            />
          </div>

          <button className="btn btn--primary" type="submit" disabled={busy}>
            {busy ? 'Saving…' : editing ? 'Save changes' : copy.add}
          </button>
        </form>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Phone</th>
            <th>Address</th>
            <th className="num">{copy.balanceLabel}</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="text-muted">
                {copy.empty}
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.id} className={r.isActive ? '' : 'is-muted'}>
              <td>{r.name}</td>
              <td className="text-muted">{r.phone || '—'}</td>
              <td className="text-muted">{r.address || '—'}</td>
              <td className={`num ${r.balancePaisa > 0 ? 'text-danger' : ''}`}>
                {formatPaisa(r.balancePaisa)}
              </td>
              <td>{r.isActive ? 'Active' : 'Off'}</td>
              {!readOnly && (
                <td className="table__actions">
                  <button className="btn btn--small" onClick={() => openEdit(r)}>
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

import { useCallback, useEffect, useState } from 'react';
import Field from '../components/Field.jsx';
import { todayIso, monthStart } from '../lib/date.js';
import ConfirmBar from '../components/ConfirmBar.jsx';
import AttachmentGallery from '../components/AttachmentGallery.jsx';
import { formatPaisa, formatDate, paisaToRupees } from '../lib/format.js';

/**
 * Expenses — every rupee out of the shop that is not stock.
 *
 * The cash/bank choice is the important field, and it is not obvious why, so
 * the form says it: only cash expenses come out of the till, and that is what
 * makes the closing count match.
 */

const EMPTY = {
  categoryId: '',
  amountRupees: '',
  method: 'cash',
  paymentChannel: '',
  paymentRef: '',
  spentOn: todayIso(),
  description: ''
};

export default function Expenses({ readOnly = false }) {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [categories, setCategories] = useState([]);
  const [channels, setChannels] = useState([]);

  const [filter, setFilter] = useState({ from: monthStart(), to: todayIso(), categoryId: '' });
  const [form, setForm] = useState(EMPTY);
  const [files, setFiles] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [detail, setDetail] = useState(null);

  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const query = {
      from: filter.from || null,
      to: filter.to || null,
      categoryId: filter.categoryId || null
    };
    const [listRes, sumRes] = await Promise.all([
      window.api.expenses.list(query),
      window.api.expenses.summary(query)
    ]);
    if (listRes.ok) setRows(listRes.data);
    else setError(listRes.message);
    if (sumRes.ok) setSummary(sumRes.data);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    window.api.expenseCategories.list().then((r) => r.ok && setCategories(r.data));
    window.api.settings.get().then((r) => r.ok && setChannels(r.data.paymentChannels || []));
  }, []);

  const activeCategories = categories.filter((c) => c.isActive);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function openNew() {
    setEditing(null);
    setForm({ ...EMPTY, categoryId: activeCategories[0]?.id ?? '' });
    setFiles([]);
    setShowForm(true);
    setError(null);
  }

  function openEdit(row) {
    setEditing(row);
    setForm({
      categoryId: row.categoryId,
      amountRupees: String(paisaToRupees(row.amountPaisa)),
      method: row.method,
      paymentChannel: row.paymentChannel || '',
      paymentRef: row.paymentRef || '',
      spentOn: row.spentOn,
      description: row.description || ''
    });
    setFiles([]);
    setShowForm(true);
    setError(null);
  }

  async function pickFiles() {
    const res = await window.api.attachments.pick();
    if (!res.ok) return setError(res.message);
    if (!res.data.ok) return;
    setFiles((f) => [...f, ...res.data.files]);
  }

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);

    const res = editing
      ? await window.api.expenses.update({ ...form, id: editing.id })
      : await window.api.expenses.create({ ...form, files });

    setBusy(false);
    if (!res.ok) return setError(res.message);

    setNotice(
      editing
        ? `Updated — Rs ${formatPaisa(res.data.amountPaisa)} for ${res.data.categoryName}.`
        : `Recorded Rs ${formatPaisa(res.data.amountPaisa)} — ${res.data.categoryName}.`
    );
    setShowForm(false);
    setEditing(null);
    setForm(EMPTY);
    setFiles([]);
    load();
  }

  async function confirmDelete() {
    setBusy(true);
    const res = await window.api.expenses.remove({ id: deleting.id });
    setBusy(false);
    setDeleting(null);
    if (!res.ok) setError(res.message);
    else {
      setNotice('Expense removed.');
      load();
    }
  }

  if (categories.length === 0) {
    return (
      <div className="callout callout--warn">
        <strong>No categories yet</strong>
        <p>
          Open the <strong>Categories</strong> tab and add at least one, e.g. Chai, Transport, Rent.
        </p>
      </div>
    );
  }

  return (
    <>
      {error && <div className="callout callout--error">{error}</div>}
      {notice && <div className="callout callout--ok">{notice}</div>}

      {deleting && (
        <ConfirmBar
          title={`Remove this Rs ${formatPaisa(deleting.amountPaisa)} expense?`}
          message={`${deleting.categoryName} — ${deleting.description}. This cannot be undone.`}
          confirmLabel="Remove expense"
          busy={busy}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}

      <div className="panel filters">
        <label className="field">
          <span className="field__label">From</span>
          <input
            className="field__input"
            type="date"
            value={filter.from}
            onChange={(e) => setFilter((f) => ({ ...f, from: e.target.value }))}
          />
        </label>
        <label className="field">
          <span className="field__label">To</span>
          <input
            className="field__input"
            type="date"
            value={filter.to}
            onChange={(e) => setFilter((f) => ({ ...f, to: e.target.value }))}
          />
        </label>
        <label className="field">
          <span className="field__label">Category</span>
          <select
            className="field__input"
            value={filter.categoryId}
            onChange={(e) => setFilter((f) => ({ ...f, categoryId: e.target.value }))}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {!readOnly && (
          <button className="btn btn--primary" onClick={showForm ? () => setShowForm(false) : openNew}>
            {showForm ? 'Cancel' : '＋ Add expense'}
          </button>
        )}
      </div>

      {summary && (
        <div className="cards">
          <div className="card-stat">
            <span className="card-stat__label">Entries</span>
            <span className="card-stat__value">{summary.count}</span>
          </div>
          <div className="card-stat card-stat--due">
            <span className="card-stat__label">Total spent</span>
            <span className="card-stat__value">Rs {formatPaisa(summary.totalPaisa)}</span>
          </div>
          <div className="card-stat">
            <span className="card-stat__label">From cash</span>
            <span className="card-stat__value">Rs {formatPaisa(summary.cashPaisa)}</span>
          </div>
          <div className="card-stat">
            <span className="card-stat__label">From bank</span>
            <span className="card-stat__value">Rs {formatPaisa(summary.bankPaisa)}</span>
          </div>
        </div>
      )}

      {showForm && !readOnly && (
        <form className="panel" onSubmit={submit}>
          <h2 className="panel__title">{editing ? 'Edit expense' : 'New expense'}</h2>

          <div className="grid-3">
            <label className="field">
              <span className="field__label">Category *</span>
              <select
                className="field__input"
                value={form.categoryId}
                onChange={(e) => set('categoryId', e.target.value)}
                disabled={busy}
              >
                {activeCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <Field
              label="Amount (Rs) *"
              type="number"
              value={form.amountRupees}
              onChange={(v) => set('amountRupees', v)}
              disabled={busy}
            />

            <Field
              label="Date *"
              type="date"
              value={form.spentOn}
              onChange={(v) => set('spentOn', v)}
              disabled={busy}
            />
          </div>

          <div className="grid-3">
            <label className="field">
              <span className="field__label">Paid from *</span>
              <select
                className="field__input"
                value={form.method}
                onChange={(e) => set('method', e.target.value)}
                disabled={busy}
              >
                <option value="cash">Cash — out of the till</option>
                <option value="bank">Bank / JazzCash / EasyPaisa</option>
              </select>
              <span className="field__hint">
                Only cash expenses reduce the money in the box at closing time.
              </span>
            </label>

            {form.method === 'bank' && (
              <>
                <label className="field">
                  <span className="field__label">Paid through</span>
                  <select
                    className="field__input"
                    value={form.paymentChannel}
                    onChange={(e) => set('paymentChannel', e.target.value)}
                    disabled={busy}
                  >
                    <option value="">Choose…</option>
                    {channels.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <Field
                  label="Reference / TID"
                  value={form.paymentRef}
                  onChange={(v) => set('paymentRef', v)}
                  disabled={busy}
                  hint="optional"
                />
              </>
            )}
          </div>

          <Field
            label="What was it for *"
            value={form.description}
            onChange={(v) => set('description', v)}
            disabled={busy}
            placeholder="e.g. chai for staff, gari kharcha for delivery to Bilal store"
          />

          {!editing && (
            <>
              <h3 className="panel__subtitle">Receipt (optional)</h3>
              <div className="filelist">
                {files.map((f, i) => (
                  <div className="filelist__item" key={i}>
                    <span>{f.originalName}</span>
                    <span className="text-muted text-small">
                      {Math.round(f.sizeBytes / 1024)} KB
                    </span>
                    <button
                      className="btn btn--small btn--danger"
                      type="button"
                      onClick={() => setFiles((l) => l.filter((_, j) => j !== i))}
                      disabled={busy}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button className="btn btn--small" type="button" onClick={pickFiles} disabled={busy}>
                ＋ Attach receipt photo
              </button>
            </>
          )}

          <div className="btn-row">
            <button className="btn btn--primary" type="submit" disabled={busy}>
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Save expense'}
            </button>
            <button className="btn" type="button" onClick={() => setShowForm(false)} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {detail && (
        <div className="panel">
          <div className="detail-head">
            <div>
              <h2 className="panel__title">
                {detail.categoryName} — Rs {formatPaisa(detail.amountPaisa)}
              </h2>
              <p className="text-muted">
                {formatDate(detail.spentOn)} · {detail.paymentChannel || detail.method}
                {detail.paymentRef ? ` · Ref ${detail.paymentRef}` : ''} · recorded by{' '}
                {detail.createdBy || '—'}
              </p>
              <p>{detail.description}</p>
            </div>
            <button className="btn btn--small" onClick={() => setDetail(null)}>
              Close
            </button>
          </div>
          <AttachmentGallery attachments={detail.attachments} emptyText="No receipt attached." />
        </div>
      )}

      {summary && summary.byCategory.length > 0 && (
        <div className="panel">
          <h2 className="panel__title">Where it went</h2>
          <table className="table">
            <tbody>
              {summary.byCategory.map((c) => {
                const pct = summary.totalPaisa
                  ? Math.round((c.totalPaisa / summary.totalPaisa) * 100)
                  : 0;
                return (
                  <tr key={c.category}>
                    <td style={{ width: 200 }}>{c.category}</td>
                    <td>
                      <div className="bar">
                        <div className="bar__fill" style={{ width: `${pct}%` }} />
                      </div>
                    </td>
                    <td className="num" style={{ width: 60 }}>
                      {pct}%
                    </td>
                    <td className="num" style={{ width: 120 }}>
                      {formatPaisa(c.totalPaisa)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Category</th>
            <th>What for</th>
            <th>Paid from</th>
            <th className="num">Amount</th>
            <th>Receipt</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="text-muted">
                No expenses in this period.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="text-muted">{formatDate(r.spentOn)}</td>
              <td>{r.categoryName}</td>
              <td>{r.description}</td>
              <td>
                <span className={`chip chip--${r.method === 'cash' ? 'cash' : 'bank'}`}>
                  {r.paymentChannel || (r.method === 'cash' ? 'Cash' : 'Bank')}
                </span>
              </td>
              <td className="num">{formatPaisa(r.amountPaisa)}</td>
              <td className="text-muted">{r.attachmentCount > 0 ? `${r.attachmentCount} 📎` : '—'}</td>
              <td className="table__actions">
                {r.attachmentCount > 0 && (
                  <button
                    className="btn btn--small"
                    onClick={async () => {
                      const res = await window.api.expenses.get(r.id);
                      if (res.ok) setDetail(res.data);
                    }}
                  >
                    View
                  </button>
                )}
                {!readOnly && (
                  <button className="btn btn--small" onClick={() => openEdit(r)}>
                    Edit
                  </button>
                )}
                {!readOnly && (
                  <button className="btn btn--small btn--danger" onClick={() => setDeleting(r)}>
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

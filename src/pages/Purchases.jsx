import { useCallback, useEffect, useState } from 'react';
import PurchaseForm from './PurchaseForm.jsx';
import PurchaseDetail from './PurchaseDetail.jsx';
import ConfirmBar from '../components/ConfirmBar.jsx';
import { formatPaisa, formatDate } from '../lib/format.js';

/**
 * Stock In — the list of everything bought from suppliers.
 *
 * Admin only. The owner said buying, rates and supplier balances are his
 * business alone; the main process enforces that on every channel.
 */

const METHOD_LABELS = {
  cash: 'Cash',
  bank: 'Bank',
  credit: 'Udhaar'
};

export default function Purchases({ readOnly = false }) {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [shopSettings, setShopSettings] = useState({ taxEnabled: false, taxPercent: 0 });
  const [nextNo, setNextNo] = useState(null);

  const [filter, setFilter] = useState({ supplierId: '', from: '', to: '', unpaidOnly: false });
  const [mode, setMode] = useState('list'); // list | new | detail
  const [detailId, setDetailId] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const query = {
      supplierId: filter.supplierId || null,
      from: filter.from || null,
      to: filter.to || null,
      unpaidOnly: filter.unpaidOnly
    };
    const [listRes, sumRes, nextRes] = await Promise.all([
      window.api.purchases.list(query),
      window.api.purchases.summary(query),
      window.api.purchases.nextNo()
    ]);
    if (listRes.ok) setRows(listRes.data);
    else setError(listRes.message);
    if (sumRes.ok) setSummary(sumRes.data);
    if (nextRes.ok) setNextNo(nextRes.data);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  // Loaded once: the supplier list for the filter, and the tax switch so the
  // form knows whether to show a tax field at all.
  useEffect(() => {
    window.api.suppliers.list().then((r) => r.ok && setSuppliers(r.data));
    window.api.settings.get().then((r) => r.ok && setShopSettings(r.data));
  }, []);

  async function confirmDelete() {
    setBusy(true);
    setError(null);
    const res = await window.api.purchases.remove({ id: deleting.id });
    setBusy(false);
    setDeleting(null);

    if (!res.ok) setError(res.message);
    else {
      setNotice(`Deleted ${deleting.purchaseNo}. The stock it added has been removed.`);
      setMode('list');
      load();
    }
  }

  if (mode === 'new') {
    return (
      <div className="page">
        <div className="page__head">
          <h1 className="page__title">Stock In</h1>
        </div>
        <PurchaseForm
          nextNo={nextNo}
          taxEnabled={shopSettings.taxEnabled}
          defaultTaxPercent={shopSettings.taxPercent}
          onCancel={() => setMode('list')}
          onSaved={(purchase) => {
            setMode('list');
            setNotice(
              `Saved ${purchase.purchaseNo} — Rs ${formatPaisa(purchase.totalPaisa)} from ${purchase.supplierName}. Stock updated.`
            );
            load();
          }}
        />
      </div>
    );
  }

  if (mode === 'detail') {
    return (
      <div className="page">
        <div className="page__head">
          <h1 className="page__title">Purchase detail</h1>
          <button className="btn" onClick={() => setMode('list')}>
            ← Back to list
          </button>
        </div>
        <PurchaseDetail
          id={detailId}
          onDelete={(p) => setDeleting(p)}
          deletingBar={
            deleting && (
              <ConfirmBar
                title={`Delete ${deleting.purchaseNo}?`}
                message={`Rs ${formatPaisa(deleting.totalPaisa)} from ${deleting.supplierName}. The stock this bill added will be removed too. This cannot be undone.`}
                busy={busy}
                onConfirm={confirmDelete}
                onCancel={() => setDeleting(null)}
              />
            )
          }
        />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page__head">
        <h1 className="page__title">Stock In</h1>
        {!readOnly && (
          <button className="btn btn--primary" onClick={() => setMode('new')}>
            Record purchase
          </button>
        )}
      </div>

      {error && <div className="callout callout--error">{error}</div>}
      {notice && <div className="callout callout--ok">{notice}</div>}

      {deleting && (
        <ConfirmBar
          title={`Delete ${deleting.purchaseNo}?`}
          message={`Rs ${formatPaisa(deleting.totalPaisa)} from ${deleting.supplierName}. The stock this bill added will be removed too. This cannot be undone.`}
          busy={busy}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}

      {/* --- filters --- */}
      <div className="panel filters">
        <label className="field">
          <span className="field__label">Supplier</span>
          <select
            className="field__input"
            value={filter.supplierId}
            onChange={(e) => setFilter((f) => ({ ...f, supplierId: e.target.value }))}
          >
            <option value="">All suppliers</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

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

        <label className="field checkbox">
          <input
            type="checkbox"
            checked={filter.unpaidOnly}
            onChange={(e) => setFilter((f) => ({ ...f, unpaidOnly: e.target.checked }))}
          />
          <span>Only udhaar still owing</span>
        </label>

        <button
          className="btn btn--small"
          onClick={() => setFilter({ supplierId: '', from: '', to: '', unpaidOnly: false })}
        >
          Clear
        </button>
      </div>

      {/* --- summary --- */}
      {summary && (
        <div className="cards">
          <div className="card-stat">
            <span className="card-stat__label">Purchases</span>
            <span className="card-stat__value">{summary.count}</span>
          </div>
          <div className="card-stat">
            <span className="card-stat__label">Total bought</span>
            <span className="card-stat__value">Rs {formatPaisa(summary.totalPaisa)}</span>
          </div>
          <div className="card-stat">
            <span className="card-stat__label">Paid</span>
            <span className="card-stat__value">Rs {formatPaisa(summary.paidPaisa)}</span>
          </div>
          <div className={`card-stat ${summary.outstandingPaisa > 0 ? 'card-stat--due' : ''}`}>
            <span className="card-stat__label">We still owe</span>
            <span className="card-stat__value">Rs {formatPaisa(summary.outstandingPaisa)}</span>
          </div>
        </div>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>Bill no</th>
            <th>Date</th>
            <th>Supplier</th>
            <th>Paid by</th>
            <th className="num">Total</th>
            <th className="num">Still owing</th>
            <th>Due</th>
            <th>Photo</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={9} className="text-muted">
                No purchases recorded yet. Click <strong>Record purchase</strong> to enter the first
                supplier bill.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <code>{r.purchaseNo}</code>
              </td>
              <td className="text-muted">{formatDate(r.purchaseDate)}</td>
              <td>{r.supplierName}</td>
              <td>
                <span className={`chip chip--${r.paymentMethod}`}>
                  {METHOD_LABELS[r.paymentMethod]}
                </span>
              </td>
              <td className="num">{formatPaisa(r.totalPaisa)}</td>
              <td className={`num ${r.outstandingPaisa > 0 ? 'text-danger' : ''}`}>
                {r.outstandingPaisa > 0 ? formatPaisa(r.outstandingPaisa) : '—'}
              </td>
              <td className="text-muted">{r.dueDate ? formatDate(r.dueDate) : '—'}</td>
              <td className="text-muted">{r.attachmentCount > 0 ? `${r.attachmentCount} 📎` : '—'}</td>
              <td className="table__actions">
                <button
                  className="btn btn--small"
                  onClick={() => {
                    setDetailId(r.id);
                    setMode('detail');
                  }}
                >
                  View
                </button>
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
    </div>
  );
}

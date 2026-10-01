import { useCallback, useEffect, useState } from 'react';
import NewSale from './NewSale.jsx';
import SaleDetail from './SaleDetail.jsx';
import ConfirmBar from '../components/ConfirmBar.jsx';
import { formatPaisa, formatDate } from '../lib/format.js';

/**
 * The sales page. Serves both roles from one component:
 *
 *   worker — sees only his own bills, no cost and no profit columns
 *   owner  — sees everything, and is the only one who can cancel a bill
 *
 * The role is not decided here. The main process filters the rows and strips
 * the money columns before they are sent; this component just doesn't draw a
 * column when the data has no field for it.
 */

const METHOD_LABELS = { cash: 'Cash', bank: 'Bank', credit: 'Udhaar' };

export default function Sales({ user, readOnly = false }) {
  const isAdmin = user.role === 'admin' || user.role === 'owner';

  const [mode, setMode] = useState('list'); // list | new | detail
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [detailId, setDetailId] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const [filter, setFilter] = useState({ from: '', to: '', customerId: '', unpaidOnly: false });
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const query = {
      from: filter.from || null,
      to: filter.to || null,
      customerId: filter.customerId || null,
      unpaidOnly: filter.unpaidOnly
    };
    const [listRes, sumRes] = await Promise.all([
      window.api.sales.list(query),
      window.api.sales.summary(query)
    ]);
    if (listRes.ok) setRows(listRes.data);
    else setError(listRes.message);
    if (sumRes.ok) setSummary(sumRes.data);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    window.api.customers.list().then((r) => r.ok && setCustomers(r.data));
  }, []);

  async function reprint(sale) {
    setError(null);
    setNotice(null);
    const res = await window.api.sales.print({ id: sale.id });
    if (!res.ok) setError(res.message);
    else if (res.data.printed) setNotice(`${sale.invoiceNo} sent to the printer.`);
  }

  async function confirmDelete() {
    setBusy(true);
    setError(null);
    const res = await window.api.sales.remove({ id: deleting.id });
    setBusy(false);
    setDeleting(null);

    if (!res.ok) setError(res.message);
    else {
      setNotice(`Cancelled ${deleting.invoiceNo}. The stock has been put back.`);
      setMode('list');
      load();
    }
  }

  if (mode === 'new') {
    return (
      <div className="page page--wide">
        <div className="page__head">
          <h1 className="page__title">New sale</h1>
          <button className="btn" onClick={() => setMode('list')}>
            ← Back to bills
          </button>
        </div>
        <NewSale
          user={user}
          onSaved={(sale) => {
            setNotice(`Saved ${sale.invoiceNo} — Rs ${formatPaisa(sale.totalPaisa)}.`);
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
          <h1 className="page__title">Bill detail</h1>
          <button className="btn" onClick={() => setMode('list')}>
            ← Back to bills
          </button>
        </div>
        {deleting && (
          <ConfirmBar
            title={`Cancel ${deleting.invoiceNo}?`}
            message={`Rs ${formatPaisa(deleting.totalPaisa)}. The stock on this bill will be put back into the shop. This cannot be undone.`}
            confirmLabel="Cancel this bill"
            busy={busy}
            onConfirm={confirmDelete}
            onCancel={() => setDeleting(null)}
          />
        )}
        <SaleDetail
          id={detailId}
          isAdmin={isAdmin}
          onDelete={(s) => setDeleting(s)}
          onPrint={reprint}
        />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page__head">
        <h1 className="page__title">{isAdmin ? 'Sales' : 'My bills'}</h1>
        {!readOnly && (
          <button className="btn btn--primary btn--big" onClick={() => setMode('new')}>
            ＋ New sale
          </button>
        )}
      </div>

      {error && <div className="callout callout--error">{error}</div>}
      {notice && <div className="callout callout--ok">{notice}</div>}

      {deleting && (
        <ConfirmBar
          title={`Cancel ${deleting.invoiceNo}?`}
          message={`Rs ${formatPaisa(deleting.totalPaisa)}. The stock on this bill will be put back into the shop. This cannot be undone.`}
          confirmLabel="Cancel this bill"
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
          <span className="field__label">Customer</span>
          <select
            className="field__input"
            value={filter.customerId}
            onChange={(e) => setFilter((f) => ({ ...f, customerId: e.target.value }))}
          >
            <option value="">All customers</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
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
          onClick={() => setFilter({ from: '', to: '', customerId: '', unpaidOnly: false })}
        >
          Clear
        </button>
      </div>

      {summary && (
        <div className="cards">
          <div className="card-stat">
            <span className="card-stat__label">Bills</span>
            <span className="card-stat__value">{summary.count}</span>
          </div>
          <div className="card-stat card-stat--good">
            <span className="card-stat__label">Total sales</span>
            <span className="card-stat__value">Rs {formatPaisa(summary.totalPaisa)}</span>
          </div>
          {isAdmin ? (
            <div className="card-stat card-stat--good">
              <span className="card-stat__label">Profit</span>
              <span className="card-stat__value">Rs {formatPaisa(summary.profitPaisa || 0)}</span>
            </div>
          ) : (
            <div className="card-stat">
              <span className="card-stat__label">Received</span>
              <span className="card-stat__value">Rs {formatPaisa(summary.paidPaisa)}</span>
            </div>
          )}
          <div className={`card-stat ${summary.outstandingPaisa > 0 ? 'card-stat--due' : ''}`}>
            <span className="card-stat__label">On udhaar</span>
            <span className="card-stat__value">Rs {formatPaisa(summary.outstandingPaisa)}</span>
          </div>
        </div>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>Bill</th>
            <th>Date</th>
            <th>Customer</th>
            <th>Paid by</th>
            <th className="num">Total</th>
            {isAdmin && <th className="num">Profit</th>}
            <th className="num">Owing</th>
            <th>Due</th>
            {isAdmin && <th>By</th>}
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={isAdmin ? 10 : 8} className="text-muted">
                No bills yet. Click <strong>New sale</strong> to make the first one.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <code>{r.invoiceNo}</code>
              </td>
              <td className="text-muted">{formatDate(r.saleDate)}</td>
              <td>{r.customerName || <span className="text-muted">Walk-in</span>}</td>
              <td>
                <span className={`chip chip--${r.paymentMethod}`}>
                  {METHOD_LABELS[r.paymentMethod]}
                </span>
              </td>
              <td className="num">{formatPaisa(r.totalPaisa)}</td>
              {isAdmin && (
                <td className={`num ${r.profitPaisa < 0 ? 'text-danger' : 'text-ok'}`}>
                  {formatPaisa(r.profitPaisa || 0)}
                </td>
              )}
              <td className={`num ${r.outstandingPaisa > 0 ? 'text-danger' : ''}`}>
                {r.outstandingPaisa > 0 ? formatPaisa(r.outstandingPaisa) : '—'}
              </td>
              <td className="text-muted">{r.dueDate ? formatDate(r.dueDate) : '—'}</td>
              {isAdmin && <td className="text-muted">{r.createdBy || '—'}</td>}
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
                <button className="btn btn--small" onClick={() => reprint(r)}>
                  Print
                </button>
                {isAdmin && !readOnly && (
                  <button className="btn btn--small btn--danger" onClick={() => setDeleting(r)}>
                    Cancel
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

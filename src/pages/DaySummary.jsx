import { useCallback, useEffect, useState } from 'react';
import Field from '../components/Field.jsx';
import { todayIso, addDays } from '../lib/date.js';
import { formatPaisa, formatDate, formatDateTime } from '../lib/format.js';

/**
 * END OF DAY.
 *
 * Reads top to bottom the way the owner thinks at closing time:
 *
 *   1. what came in and what it cost
 *   2. where the money went
 *   3. how much cash should be in the box — and does it match
 *
 * The cash count at the bottom is the only place in this software where the
 * shopkeeper tells the computer something it cannot work out for itself.
 */

export default function DaySummary({ readOnly = false }) {
  const [date, setDate] = useState(todayIso());
  const [data, setData] = useState(null);
  const [counted, setCounted] = useState('');
  const [note, setNote] = useState('');
  const [history, setHistory] = useState([]);
  const [openingRupees, setOpeningRupees] = useState('');
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [dayRes, histRes, setRes] = await Promise.all([
      window.api.day.summary(date),
      window.api.day.closings(14),
      window.api.settings.get()
    ]);
    if (setRes.ok) setOpeningRupees(String((setRes.data.cashOpeningPaisa || 0) / 100));
    if (dayRes.ok) {
      setData(dayRes.data);
      setCounted(
        dayRes.data.closing ? String(dayRes.data.closing.countedCashPaisa / 100) : ''
      );
      setNote(dayRes.data.closing?.note || '');
    } else {
      setError(dayRes.message);
    }
    if (histRes.ok) setHistory(histRes.data);
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  async function closeDay(e) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);

    const res = await window.api.day.close({ date, countedRupees: counted, note });
    setBusy(false);

    if (!res.ok) return setError(res.message);

    const diff = res.data.differencePaisa;
    setNotice(
      diff === 0
        ? 'Day closed. The cash matches exactly.'
        : diff > 0
          ? `Day closed. There is Rs ${formatPaisa(diff)} MORE in the box than expected.`
          : `Day closed. The box is Rs ${formatPaisa(Math.abs(diff))} SHORT.`
    );
    load();
  }

  /**
   * The float in the box on day one. Needed before the reconciliation means
   * anything, so it is offered right here rather than buried in a settings
   * screen the owner has not been shown yet. It disappears once a day has been
   * closed, because from then on the count carries itself forward.
   */
  async function saveOpening(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await window.api.settings.set({
      cash_opening_paisa: String(Math.round(Number(openingRupees || 0) * 100))
    });
    setBusy(false);
    if (!res.ok) return setError(res.message);
    setNotice('Opening cash saved.');
    load();
  }

  /** The day's page as a PDF, for filing or for showing an accountant. */
  async function exportPdf() {
    setError(null);
    setNotice(null);
    setBusy(true);
    const res = await window.api.exports.dayPdf(date);
    setBusy(false);
    if (!res.ok) return setError(res.message);
    if (res.data.saved) setNotice(`Saved to ${res.data.filePath}`);
  }

  if (!data) return <div className="panel text-muted">Loading…</div>;

  const { sales, purchases, payments, expenses, cash } = data;
  const countedPaisa = Math.round(Number(counted || 0) * 100);
  const liveDifference = counted === '' ? null : countedPaisa - cash.expectedPaisa;

  function shiftDay(days) {
    setDate(addDays(date, days));
  }

  return (
    <>
      {error && <div className="callout callout--error">{error}</div>}
      {notice && <div className="callout callout--ok">{notice}</div>}

      <div className="panel filters">
        <button className="btn btn--small" onClick={() => shiftDay(-1)}>
          ← Previous day
        </button>
        <label className="field">
          <span className="field__label">Date</span>
          <input
            className="field__input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <button className="btn btn--small" onClick={() => shiftDay(1)} disabled={date >= todayIso()}>
          Next day →
        </button>
        <button className="btn btn--small" onClick={() => setDate(todayIso())}>
          Today
        </button>
        {data.closing && <span className="chip chip--cash">Day closed</span>}
        <button className="btn btn--small" onClick={exportPdf} disabled={busy}>
          Save as PDF
        </button>
      </div>

      {/* --- headline --- */}
      <div className="cards">
        <div className="card-stat card-stat--good">
          <span className="card-stat__label">Sales ({sales.count} bills)</span>
          <span className="card-stat__value">Rs {formatPaisa(sales.totalPaisa)}</span>
        </div>
        <div className="card-stat">
          <span className="card-stat__label">Cost of goods sold</span>
          <span className="card-stat__value">Rs {formatPaisa(sales.costPaisa)}</span>
        </div>
        <div className="card-stat">
          <span className="card-stat__label">Expenses</span>
          <span className="card-stat__value">Rs {formatPaisa(expenses.totalPaisa)}</span>
        </div>
        <div
          className={`card-stat ${data.netProfitPaisa >= 0 ? 'card-stat--good' : 'card-stat--overdue'}`}
        >
          <span className="card-stat__label">Net profit</span>
          <span className="card-stat__value">Rs {formatPaisa(data.netProfitPaisa)}</span>
        </div>
      </div>

      {/* --- money movement --- */}
      <div className="panel">
        <h2 className="panel__title">Money movement</h2>
        <table className="table">
          <tbody>
            <tr>
              <td>Cash taken on sales</td>
              <td className="num text-ok">+ {formatPaisa(sales.cashPaisa)}</td>
            </tr>
            <tr>
              <td>Bank / JazzCash received on sales</td>
              <td className="num text-ok">+ {formatPaisa(sales.bankPaisa)}</td>
            </tr>
            <tr>
              <td>Old udhaar recovered from customers</td>
              <td className="num text-ok">+ {formatPaisa(payments.recoveredPaisa)}</td>
            </tr>
            <tr className="row--soon">
              <td>Udhaar given out today (not received)</td>
              <td className="num text-danger">{formatPaisa(sales.udhaarGivenPaisa)}</td>
            </tr>
            <tr>
              <td>Paid to suppliers for stock</td>
              <td className="num text-danger">− {formatPaisa(purchases.paidPaisa)}</td>
            </tr>
            <tr>
              <td>Paid to suppliers against old bills</td>
              <td className="num text-danger">− {formatPaisa(payments.paidOutPaisa)}</td>
            </tr>
            <tr>
              <td>Expenses</td>
              <td className="num text-danger">− {formatPaisa(expenses.totalPaisa)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th>Cash box moved today</th>
              <th className={`num ${data.cashMovementPaisa < 0 ? 'text-danger' : 'text-ok'}`}>
                {data.cashMovementPaisa >= 0 ? '+ ' : '− '}
                Rs {formatPaisa(Math.abs(data.cashMovementPaisa))}
              </th>
            </tr>
          </tfoot>
        </table>
        <p className="text-muted text-small">
          Only cash movements change the box. Bank and JazzCash amounts are shown above but never
          touch it.
        </p>
      </div>

      {/* --- what sold --- */}
      {data.products.length > 0 && (
        <div className="panel">
          <h2 className="panel__title">What sold today</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th className="num">Quantity</th>
                <th className="num">Sold for</th>
                <th className="num">Profit</th>
              </tr>
            </thead>
            <tbody>
              {data.products.map((p, i) => (
                <tr key={i}>
                  <td>
                    {p.companyName} — {p.productName}
                  </td>
                  <td className="num">{p.quantityText}</td>
                  <td className="num">{formatPaisa(p.amountPaisa)}</td>
                  <td className={`num ${p.profitPaisa < 0 ? 'text-danger' : 'text-ok'}`}>
                    {formatPaisa(p.profitPaisa)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan={2}>Total</th>
                <th className="num">{formatPaisa(sales.subtotalPaisa)}</th>
                <th className="num">{formatPaisa(sales.grossProfitPaisa)}</th>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* --- expenses breakdown --- */}
      {expenses.byCategory.length > 0 && (
        <div className="panel">
          <h2 className="panel__title">Expenses today</h2>
          <table className="table">
            <tbody>
              {expenses.byCategory.map((c) => (
                <tr key={c.category}>
                  <td>{c.category}</td>
                  <td className="num">{formatPaisa(c.totalPaisa)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th>Total</th>
                <th className="num">{formatPaisa(expenses.totalPaisa)}</th>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* --- the cash count --- */}
      {/*
        Before the first close there is nothing to carry forward, so the float
        is the only starting point — and if it is zero the whole reconciliation
        is meaningless. Ask for it here, once.
      */}
      {!cash.startedFrom && !readOnly && (
        <form className="panel" onSubmit={saveOpening}>
          <h2 className="panel__title">Cash the shop started with</h2>
          <p className="text-muted">
            How much cash was in the box on the day you started using this software? Everything
            below is counted from that figure, until you close your first day — after that it
            carries forward from whatever you count.
          </p>
          <div className="grid-2">
            <Field
              label="Opening cash (Rs)"
              type="number"
              value={openingRupees}
              onChange={setOpeningRupees}
              disabled={busy}
              hint="Set this once. Leave 0 only if the box was genuinely empty."
            />
          </div>
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save opening cash'}
          </button>
        </form>
      )}

      <form className="panel" onSubmit={closeDay}>
        <h2 className="panel__title">Cash in hand</h2>

        {cash.expectedPaisa < 0 && (
          <div className="callout callout--warn">
            <strong>This says the box holds less than nothing — something is not recorded</strong>
            <p>
              A cash box cannot go negative, so one of these is true:
            </p>
            <ul className="tree">
              <li>
                <strong>The opening cash is not set.</strong> If the shop already had money in the
                box, enter it above.
              </li>
              <li>
                <strong>A purchase marked "cash" was actually paid by bank or JazzCash.</strong>{' '}
                Open <strong>Stock In</strong>, check the bill, and re-enter it if needed.
              </li>
              <li>
                <strong>Money was put into the till from outside</strong> — the owner's own pocket,
                for example. Record tonight's real count and the software will carry on from there.
              </li>
            </ul>
          </div>
        )}

        <table className="table">
          <tbody>
            <tr>
              <td>
                {cash.startLabel}
                {cash.startedFrom && (
                  <div className="text-muted text-small">
                    Counting starts again from the last time you counted the box
                  </div>
                )}
              </td>
              <td className="num">{formatPaisa(cash.startPaisa)}</td>
            </tr>
            <tr>
              <td>Cash taken on sales since then</td>
              <td className="num text-ok">+ {formatPaisa(cash.salesCashPaisa)}</td>
            </tr>
            <tr>
              <td>Cash received from customers since then</td>
              <td className="num text-ok">+ {formatPaisa(cash.paymentsInCashPaisa)}</td>
            </tr>
            <tr>
              <td>Cash paid for stock since then</td>
              <td className="num text-danger">− {formatPaisa(cash.purchasesCashPaisa)}</td>
            </tr>
            <tr>
              <td>Cash paid to suppliers since then</td>
              <td className="num text-danger">− {formatPaisa(cash.paymentsOutCashPaisa)}</td>
            </tr>
            <tr>
              <td>Cash expenses since then</td>
              <td className="num text-danger">− {formatPaisa(cash.expensesCashPaisa)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th>Cash that should be in the box</th>
              <th className="num">Rs {formatPaisa(cash.expectedPaisa)}</th>
            </tr>
          </tfoot>
        </table>

        <div className="grid-2" style={{ marginTop: 16 }}>
          <Field
            label="Cash you actually counted (Rs)"
            type="number"
            value={counted}
            onChange={setCounted}
            disabled={busy}
            hint="Count the box and type the figure"
          />
          <Field
            label="Note (optional)"
            value={note}
            onChange={setNote}
            disabled={busy}
            placeholder="e.g. Rs 500 given to Akram as advance, will adjust"
          />
        </div>

        {liveDifference !== null && (
          <div
            className={`callout ${
              liveDifference === 0
                ? 'callout--ok'
                : Math.abs(liveDifference) < 10000
                  ? 'callout--warn'
                  : 'callout--error'
            }`}
          >
            <strong>
              {liveDifference === 0
                ? 'Exactly right — the box matches the software.'
                : liveDifference > 0
                  ? `Rs ${formatPaisa(liveDifference)} MORE in the box than expected`
                  : `Rs ${formatPaisa(Math.abs(liveDifference))} SHORT`}
            </strong>
            {liveDifference !== 0 && (
              <p>
                Usually an expense not entered yet, or a sale recorded as cash that was actually a
                transfer. Write what you think it is in the note — the difference is saved either
                way, and tomorrow starts fresh from the amount you count tonight.
              </p>
            )}
          </div>
        )}

        {!readOnly && (
          <button className="btn btn--primary" type="submit" disabled={busy || counted === ''}>
            {busy ? 'Saving…' : data.closing ? 'Update the count' : 'Close the day'}
          </button>
        )}

        {data.closing && (
          <p className="text-muted text-small" style={{ marginTop: 10 }}>
            Closed by {data.closing.closedBy || '—'} on {formatDateTime(data.closing.closedAt)}.
            Counted Rs {formatPaisa(data.closing.countedCashPaisa)} against an expected Rs{' '}
            {formatPaisa(data.closing.expectedCashPaisa)}.
          </p>
        )}
      </form>

      {/* --- history --- */}
      {history.length > 0 && (
        <div className="panel">
          <h2 className="panel__title">Recent closings</h2>
          <p className="text-muted text-small">
            A one-off difference is normal. The same shortfall every day is worth looking into.
          </p>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th className="num">Expected</th>
                <th className="num">Counted</th>
                <th className="num">Difference</th>
                <th>Note</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.date} className={h.differencePaisa === 0 ? '' : 'row--soon'}>
                  <td className="text-muted">{formatDate(h.date)}</td>
                  <td className="num">{formatPaisa(h.expectedCashPaisa)}</td>
                  <td className="num">{formatPaisa(h.countedCashPaisa)}</td>
                  <td
                    className={`num ${h.differencePaisa === 0 ? 'text-ok' : 'text-danger'}`}
                  >
                    {h.differencePaisa === 0
                      ? '—'
                      : `${h.differencePaisa > 0 ? '+' : '−'} ${formatPaisa(Math.abs(h.differencePaisa))}`}
                  </td>
                  <td className="text-muted">{h.note || ''}</td>
                  <td className="text-muted">{h.closedBy || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

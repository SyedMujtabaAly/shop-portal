import { useEffect, useMemo, useState } from 'react';
import Field from './Field.jsx';
import { todayIso } from '../lib/date.js';
import { formatPaisa, formatDate, paisaToRupees } from '../lib/format.js';

/**
 * Receive money from a customer, or pay a supplier. One form, mirrored.
 *
 * The important part is the middle: BEFORE saving, it shows exactly which bills
 * the money will settle, oldest first. A shopkeeper handing over Rs 10,000
 * should see that it clears INV-000198 in full and part of INV-000201 — not
 * just watch a balance drop by a number.
 *
 * The same allocation runs again in the main process when saving. This preview
 * never decides anything; it just makes the decision visible.
 */

export default function PaymentForm({ direction, party, onSaved, onCancel }) {
  const isIn = direction === 'in';

  const [bills, setBills] = useState([]);
  const [channels, setChannels] = useState([]);
  const [amountRupees, setAmountRupees] = useState('');
  const [method, setMethod] = useState('cash');
  const [paymentChannel, setPaymentChannel] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [paidOn, setPaidOn] = useState(todayIso());
  const [note, setNote] = useState('');
  const [allowAdvance, setAllowAdvance] = useState(false);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    window.api.payments
      .openBills({ direction, partyId: party.id })
      .then((r) => r.ok && setBills(r.data));
    window.api.settings.get().then((r) => r.ok && setChannels(r.data.paymentChannels || []));
  }, [direction, party.id]);

  const amountPaisa = Math.round(Number(amountRupees || 0) * 100);
  const owed = party.balancePaisa;

  /**
   * Mirror of the main process's allocation, for display only.
   *
   * The split at the end matters. Money that lands on no bill is not
   * automatically an advance: the party may owe an OPENING BALANCE carried over
   * from the shopkeeper's notebook, which is a real debt with no bill row
   * behind it. Only money beyond the whole balance is an advance.
   */
  const plan = useMemo(() => {
    let remaining = amountPaisa;
    const rows = [];
    for (const bill of bills) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, bill.outstanding_paisa);
      rows.push({ ...bill, take, clears: take >= bill.outstanding_paisa });
      remaining -= take;
    }

    const advance = Math.max(0, amountPaisa - owed);
    return {
      rows,
      advance,
      openingBalance: Math.max(0, remaining - advance)
    };
  }, [bills, amountPaisa, owed]);

  async function pickFiles() {
    setError(null);
    const res = await window.api.attachments.pick();
    if (!res.ok) return setError(res.message);
    if (!res.data.ok) return;
    setFiles((f) => [...f, ...res.data.files]);
  }

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const res = await window.api.payments.create({
      direction,
      partyId: party.id,
      amountRupees,
      method,
      paymentChannel,
      paymentRef,
      paidOn,
      note,
      allowAdvance,
      files
    });

    setBusy(false);
    if (!res.ok) return setError(res.message);
    onSaved(res.data);
  }

  return (
    <form className="panel" onSubmit={submit}>
      <h2 className="panel__title">
        {isIn ? 'Receive payment from' : 'Pay'} {party.name}
      </h2>

      <div className={`callout ${owed > 0 ? 'callout--warn' : ''}`}>
        <strong>
          {isIn ? 'Currently owes' : 'We currently owe'} Rs {formatPaisa(owed)}
        </strong>
        <p>
          {bills.length} unpaid bill{bills.length === 1 ? '' : 's'}
          {party.phone ? ` · ${party.phone}` : ''}
        </p>
      </div>

      <div className="grid-3">
        <Field
          label="Amount (Rs) *"
          type="number"
          value={amountRupees}
          onChange={setAmountRupees}
          autoFocus
          disabled={busy}
          hint={owed > 0 ? `Full amount is ${formatPaisa(owed)}` : ''}
        />

        <label className="field">
          <span className="field__label">How *</span>
          <select
            className="field__input"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            disabled={busy}
          >
            <option value="cash">Cash</option>
            <option value="bank">Bank / JazzCash / EasyPaisa</option>
          </select>
        </label>

        <Field label="Date *" type="date" value={paidOn} onChange={setPaidOn} disabled={busy} />
      </div>

      {/* Which service the money came through — only for non-cash. */}
      {method === 'bank' && (
        <div className="grid-2">
          <label className="field">
            <span className="field__label">Received through</span>
            <select
              className="field__input"
              value={paymentChannel}
              onChange={(e) => setPaymentChannel(e.target.value)}
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
            value={paymentRef}
            onChange={setPaymentRef}
            disabled={busy}
            hint="optional"
          />
        </div>
      )}

      {/*
        Proof is offered for EVERY payment, not just bank transfers. A cash
        payment can have a signed receipt or a photo of the parchi, and the
        owner may well want that on record for a large amount.
      */}
      <h3 className="panel__subtitle">Proof of payment (optional)</h3>
      <p className="text-muted text-small">
        {method === 'bank'
          ? 'Attach the JazzCash / EasyPaisa / bank transfer screenshot.'
          : 'Attach a photo of the receipt or signed parchi, if there is one.'}
      </p>

      <div className="filelist">
        {files.map((f, i) => (
          <div className="filelist__item" key={i}>
            <span>{f.originalName}</span>
            <span className="text-muted text-small">{Math.round(f.sizeBytes / 1024)} KB</span>
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
        ＋ Attach photo or screenshot
      </button>

      {/* --- what this money will settle --- */}
      {amountPaisa > 0 && (
        <>
          <h3 className="panel__subtitle">This payment will settle</h3>
          {plan.rows.length === 0 && plan.openingBalance === 0 ? (
            <p className="text-muted">
              There are no unpaid bills and nothing outstanding.
            </p>
          ) : plan.rows.length === 0 ? null : (
            <table className="table">
              <thead>
                <tr>
                  <th>Bill</th>
                  <th>Date</th>
                  <th>Due</th>
                  <th className="num">Outstanding</th>
                  <th className="num">Paying now</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {plan.rows.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <code>{b.bill_no}</code>
                    </td>
                    <td className="text-muted">{formatDate(b.bill_date)}</td>
                    <td className="text-muted">{b.due_date ? formatDate(b.due_date) : '—'}</td>
                    <td className="num">{formatPaisa(b.outstanding_paisa)}</td>
                    <td className="num">{formatPaisa(b.take)}</td>
                    <td>
                      {b.clears ? (
                        <span className="chip chip--cash">Fully paid</span>
                      ) : (
                        <span className="chip chip--credit">
                          {formatPaisa(b.outstanding_paisa - b.take)} left
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/*
            The opening balance case. Perfectly normal — and it must NOT be
            confused with an advance, or the owner is asked to confirm something
            that is simply him being paid what he is owed.
          */}
          {plan.openingBalance > 0 && (
            <div className="callout">
              <strong>
                Rs {formatPaisa(plan.openingBalance)} goes against the opening balance
              </strong>
              <p className="text-muted">
                This is the amount {party.name} already owed before the software was set up. It has
                no bill behind it, so it is not tied to an invoice.
              </p>
            </div>
          )}

          {plan.advance > 0 && (
            <div className="callout callout--warn">
              <strong>Rs {formatPaisa(plan.advance)} more than is owed</strong>
              <p>
                This will be kept as an advance and used against the next bill. If that is not
                what you meant, check the amount.
              </p>
              <label className="checkbox" style={{ marginTop: 8 }}>
                <input
                  type="checkbox"
                  checked={allowAdvance}
                  onChange={(e) => setAllowAdvance(e.target.checked)}
                  disabled={busy}
                />
                <span>Yes, this is an advance — record it</span>
              </label>
            </div>
          )}

          <div className="totals">
            <div className="totals__row">
              <span>{isIn ? 'Owed before' : 'We owed before'}</span>
              <span className="num">{formatPaisa(owed)}</span>
            </div>
            <div className="totals__row">
              <span>{isIn ? 'Receiving now' : 'Paying now'}</span>
              <span className="num">− {formatPaisa(amountPaisa)}</span>
            </div>
            <div className="totals__row totals__row--grand">
              <span>{isIn ? 'Will still owe' : 'We will still owe'}</span>
              <span className="num">Rs {formatPaisa(Math.max(0, owed - amountPaisa))}</span>
            </div>
          </div>
        </>
      )}

      <Field
        label="Note (optional)"
        value={note}
        onChange={setNote}
        disabled={busy}
        placeholder="e.g. paid in person, rest promised next week"
      />

      {error && <div className="callout callout--error">{error}</div>}

      <div className="btn-row">
        <button className="btn btn--primary" type="submit" disabled={busy || amountPaisa <= 0}>
          {busy ? 'Saving…' : isIn ? 'Save payment received' : 'Save payment made'}
        </button>
        <button className="btn" type="button" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}

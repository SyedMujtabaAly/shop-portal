import { useCallback, useEffect, useState } from 'react';
import SubTabs from '../components/SubTabs.jsx';
import PaymentForm from '../components/PaymentForm.jsx';
import ConfirmBar from '../components/ConfirmBar.jsx';
import AttachmentGallery from '../components/AttachmentGallery.jsx';
import Statement from './Statement.jsx';
import { formatPaisa, formatDate } from '../lib/format.js';

/**
 * The udhaar page — three views behind one tab:
 *
 *   Customers owe us   who to chase, sorted by the most urgent due date
 *   We owe suppliers   the same, mirrored
 *   Payment history    everything received and paid, with the proof
 *
 * Admin only. The worker records sales; money coming in and out is the owner's.
 */

const SIDE_COPY = {
  customer: {
    title: 'Customers owe us',
    amount: 'Owes us',
    action: 'Receive payment',
    direction: 'in',
    empty: 'No customer owes anything right now.'
  },
  supplier: {
    title: 'We owe suppliers',
    amount: 'We owe',
    action: 'Pay supplier',
    direction: 'out',
    empty: 'The shop owes nothing to suppliers right now.'
  }
};

const TONE = { overdue: 'row--overdue', today: 'row--today', soon: 'row--soon' };

export default function Udhaar({ initialParty, readOnly = false }) {
  const [view, setView] = useState(initialParty?.side || 'customer'); // customer | supplier | history
  const [paying, setPaying] = useState(null); // { side, party }
  const [statementFor, setStatementFor] = useState(null);
  const [notice, setNotice] = useState(null);

  // Opening the page from a dashboard alert jumps straight to that person's
  // payment form — the owner clicked because he wants to act, not to browse.
  useEffect(() => {
    if (initialParty?.id) {
      setPaying({
        side: initialParty.side,
        party: {
          id: initialParty.id,
          name: initialParty.name,
          phone: initialParty.phone,
          balancePaisa: initialParty.balancePaisa
        }
      });
    }
  }, [initialParty]);

  if (paying) {
    return (
      <div className="page">
        <div className="page__head">
          <h1 className="page__title">Udhaar</h1>
        </div>
        <PaymentForm
          direction={paying.side === 'customer' ? 'in' : 'out'}
          party={paying.party}
          onCancel={() => setPaying(null)}
          onSaved={(payment) => {
            const settled = payment.allocations.map((a) => a.billNo).join(', ');
            setNotice(
              `Rs ${formatPaisa(payment.amountPaisa)} recorded for ${payment.partyName}.` +
                (settled ? ` Settled ${settled}.` : '') +
                (payment.openingBalancePaidPaisa > 0
                  ? ` Rs ${formatPaisa(payment.openingBalancePaidPaisa)} against the opening balance.`
                  : '') +
                (payment.advancePaisa > 0
                  ? ` Rs ${formatPaisa(payment.advancePaisa)} kept as advance.`
                  : '')
            );
            setPaying(null);
            setStatementFor(null);
          }}
        />
      </div>
    );
  }

  if (statementFor) {
    return (
      <div className="page">
        <div className="page__head">
          <h1 className="page__title">Account statement</h1>
        </div>
        {notice && <div className="callout callout--ok">{notice}</div>}
        <Statement
          side={statementFor.side}
          partyId={statementFor.id}
          onBack={() => setStatementFor(null)}
          onPay={(party) => setPaying({ side: statementFor.side, party })}
        />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page__head">
        <h1 className="page__title">Udhaar</h1>
      </div>

      {notice && <div className="callout callout--ok">{notice}</div>}

      <SubTabs
        tabs={[
          { id: 'customer', label: 'Customers owe us' },
          { id: 'supplier', label: 'We owe suppliers' },
          { id: 'history', label: 'Payment history' }
        ]}
        value={view}
        onChange={setView}
      />

      {view === 'history' ? (
        <PaymentHistory onNotice={setNotice} readOnly={readOnly} />
      ) : (
        <OwingList
          key={view}
          side={view}
          onPay={readOnly ? null : (party) => setPaying({ side: view, party })}
          onStatement={(party) => setStatementFor({ side: view, id: party.id })}
        />
      )}
    </div>
  );
}

function OwingList({ side, onPay, onStatement }) {
  const copy = SIDE_COPY[side];
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    window.api.udhaar.owing({ side }).then((r) => {
      if (r.ok) setRows(r.data);
      else setError(r.message);
    });
  }, [side]);

  const total = rows.reduce((t, r) => t + r.balancePaisa, 0);
  const overdue = rows.filter((r) => r.dueStatus === 'overdue');

  return (
    <>
      {error && <div className="callout callout--error">{error}</div>}

      <div className="cards cards--3">
        <div className="card-stat">
          <span className="card-stat__label">{copy.amount}</span>
          <span className="card-stat__value">Rs {formatPaisa(total)}</span>
        </div>
        <div className={`card-stat ${overdue.length ? 'card-stat--overdue' : ''}`}>
          <span className="card-stat__label">Overdue</span>
          <span className="card-stat__value">
            Rs {formatPaisa(overdue.reduce((t, r) => t + r.balancePaisa, 0))}
          </span>
        </div>
        <div className="card-stat">
          <span className="card-stat__label">Accounts open</span>
          <span className="card-stat__value">{rows.length}</span>
        </div>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Phone</th>
            <th className="num">{copy.amount}</th>
            <th>Unpaid bills</th>
            <th>Oldest due</th>
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
            <tr key={r.id} className={TONE[r.dueStatus] || ''}>
              <td>
                <strong>{r.name}</strong>
              </td>
              <td className="text-muted">{r.phone || '—'}</td>
              <td className="num text-danger">{formatPaisa(r.balancePaisa)}</td>
              <td>{r.openBills}</td>
              <td className={r.dueStatus === 'overdue' ? 'text-danger' : ''}>
                {r.dueLabel}
                {r.earliestDue && (
                  <div className="text-muted text-small">{formatDate(r.earliestDue)}</div>
                )}
              </td>
              <td className="table__actions">
                {onPay && (
                  <button className="btn btn--small btn--primary" onClick={() => onPay(r)}>
                    {copy.action}
                  </button>
                )}
                <button className="btn btn--small" onClick={() => onStatement(r)}>
                  Statement
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function PaymentHistory({ onNotice, readOnly = false }) {
  const [rows, setRows] = useState([]);
  const [detail, setDetail] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    window.api.payments.list({}).then((r) => (r.ok ? setRows(r.data) : setError(r.message)));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function openDetail(id) {
    const r = await window.api.payments.get(id);
    if (r.ok) setDetail(r.data);
  }

  async function confirmDelete() {
    setBusy(true);
    const res = await window.api.payments.remove({ id: deleting.id });
    setBusy(false);
    setDeleting(null);
    if (!res.ok) setError(res.message);
    else {
      onNotice(
        `Removed the Rs ${formatPaisa(deleting.amountPaisa)} payment. The bills it settled are unpaid again.`
      );
      setDetail(null);
      load();
    }
  }

  return (
    <>
      {error && <div className="callout callout--error">{error}</div>}

      {deleting && (
        <ConfirmBar
          title={`Remove this Rs ${formatPaisa(deleting.amountPaisa)} payment?`}
          message={`${deleting.partyName}, ${formatDate(deleting.paidOn)}. Every bill it settled will go back to unpaid. This cannot be undone.`}
          confirmLabel="Remove payment"
          busy={busy}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}

      {detail && (
        <div className="panel">
          <div className="detail-head">
            <div>
              <h2 className="panel__title">
                {detail.direction === 'in' ? 'Received from' : 'Paid to'} {detail.partyName} — Rs{' '}
                {formatPaisa(detail.amountPaisa)}
              </h2>
              <p className="text-muted">
                {formatDate(detail.paidOn)} · {detail.paymentChannel || detail.method}
                {detail.paymentRef ? ` · Ref ${detail.paymentRef}` : ''} · recorded by{' '}
                {detail.createdBy || '—'}
              </p>
            </div>
            <button className="btn btn--small" onClick={() => setDetail(null)}>
              Close
            </button>
          </div>

          <h3 className="panel__subtitle">Bills settled</h3>
          {detail.allocations.length === 0 ? (
            <p className="text-muted">
              This payment was not tied to any bill — it went against the opening balance, or was
              taken in advance.
            </p>
          ) : (
            <table className="table">
              <tbody>
                {detail.allocations.map((a, i) => (
                  <tr key={i}>
                    <td>
                      <code>{a.billNo}</code>
                    </td>
                    <td className="num">{formatPaisa(a.amountPaisa)}</td>
                  </tr>
                ))}
              </tbody>
              {detail.unallocatedPaisa > 0 && (
                <tfoot>
                  <tr>
                    <th>Not tied to a bill</th>
                    <th className="num">{formatPaisa(detail.unallocatedPaisa)}</th>
                  </tr>
                </tfoot>
              )}
            </table>
          )}

          {detail.attachments.length > 0 && (
            <>
              <h3 className="panel__subtitle">Proof</h3>
              <AttachmentGallery attachments={detail.attachments} />
            </>
          )}

          {detail.note && (
            <div className="callout">
              <strong>Note</strong>
              <p>{detail.note}</p>
            </div>
          )}
        </div>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Direction</th>
            <th>Who</th>
            <th>How</th>
            <th className="num">Amount</th>
            <th>Proof</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="text-muted">
                No payments recorded yet.
              </td>
            </tr>
          )}
          {rows.map((p) => (
            <tr key={p.id}>
              <td className="text-muted">{formatDate(p.paidOn)}</td>
              <td>
                <span className={`chip chip--${p.direction === 'in' ? 'cash' : 'bank'}`}>
                  {p.direction === 'in' ? 'Received' : 'Paid out'}
                </span>
              </td>
              <td>{p.partyName}</td>
              <td className="text-muted">
                {p.paymentChannel || (p.method === 'cash' ? 'Cash' : 'Bank')}
                {p.paymentRef ? ` · ${p.paymentRef}` : ''}
              </td>
              <td className="num">{formatPaisa(p.amountPaisa)}</td>
              <td className="text-muted">{p.attachmentCount > 0 ? `${p.attachmentCount} 📎` : '—'}</td>
              <td className="table__actions">
                <button className="btn btn--small" onClick={() => openDetail(p.id)}>
                  View
                </button>
                {!readOnly && (
                  <button className="btn btn--small btn--danger" onClick={() => setDeleting(p)}>
                    Remove
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

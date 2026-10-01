import { useEffect, useState } from 'react';
import { formatPaisa, formatDate } from '../lib/format.js';

/**
 * A party's full account: every bill and every payment in date order, with a
 * running balance.
 *
 * This is the software version of the page in the shopkeeper's notebook, and
 * it is what he shows a customer who disagrees about what is owed. That is why
 * it starts from the opening balance and shows every movement since — an
 * account you cannot walk through line by line is an account nobody trusts.
 */
export default function Statement({ side, partyId, onBack, onPay }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  /**
   * The statement as a PDF. This is the sheet the owner hands to a customer who
   * disagrees about his balance, so it has to leave the software as a document.
   */
  async function exportPdf() {
    setError(null);
    setNotice(null);
    setBusy(true);
    const res = await window.api.exports.statementPdf({ side, partyId });
    setBusy(false);
    if (!res.ok) return setError(res.message);
    if (res.data.saved) setNotice(`Saved to ${res.data.filePath}`);
  }

  useEffect(() => {
    window.api.udhaar.statement({ side, partyId }).then((r) => {
      if (r.ok) setData(r.data);
      else setError(r.message);
    });
  }, [side, partyId]);

  if (error) return <div className="callout callout--error">{error}</div>;
  if (!data) return <div className="panel text-muted">Loading…</div>;

  const isCustomer = side === 'customer';

  return (
    <div className="panel">
      {notice && <div className="callout callout--ok">{notice}</div>}
      <div className="detail-head">
        <div>
          <h2 className="panel__title">{data.party.name}</h2>
          <p className="text-muted">
            {data.party.phone || 'no phone'}
            {data.party.address ? ` · ${data.party.address}` : ''} · {data.openBills} unpaid bill
            {data.openBills === 1 ? '' : 's'}
          </p>
        </div>
        <div className="btn-row" style={{ margin: 0 }}>
          {data.balancePaisa > 0 && (
            <button className="btn btn--primary btn--small" onClick={() => onPay(data.party)}>
              {isCustomer ? 'Receive payment' : 'Pay supplier'}
            </button>
          )}
          <button className="btn btn--small" onClick={exportPdf} disabled={busy}>
            Save as PDF
          </button>
          <button className="btn btn--small" onClick={onBack}>
            ← Back
          </button>
        </div>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Ref</th>
            <th>What</th>
            <th>Due</th>
            <th className="num">Amount</th>
            <th className="num">Balance</th>
          </tr>
        </thead>
        <tbody>
          {data.timeline.map((e, i) => (
            <tr
              key={i}
              className={
                e.kind === 'payment' ? 'row--paid' : e.dueStatus === 'overdue' ? 'row--overdue' : ''
              }
            >
              <td className="text-muted">{e.date ? formatDate(e.date) : '—'}</td>
              <td>{e.ref ? <code>{e.ref}</code> : ''}</td>
              <td>
                {e.description}
                {e.note && <div className="text-muted text-small">{e.note}</div>}
                {e.paymentRef && <div className="text-muted text-small">Ref {e.paymentRef}</div>}
                {e.kind === 'bill' && e.paidAtCounterPaisa > 0 && (
                  <div className="text-muted text-small">
                    Rs {formatPaisa(e.totalPaisa)} total, Rs {formatPaisa(e.paidAtCounterPaisa)} paid
                    at the counter
                  </div>
                )}
              </td>
              <td className={e.dueStatus === 'overdue' ? 'text-danger' : 'text-muted'}>
                {e.kind === 'bill' ? e.dueLabel : ''}
              </td>
              <td className={`num ${e.changePaisa < 0 ? 'text-ok' : ''}`}>
                {e.changePaisa < 0 ? '− ' : e.changePaisa > 0 ? '+ ' : ''}
                {formatPaisa(Math.abs(e.changePaisa))}
              </td>
              <td className="num">{formatPaisa(e.balancePaisa)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th colSpan={5}>{isCustomer ? 'Total owed to us' : 'Total we owe'}</th>
            <th className="num">Rs {formatPaisa(data.balancePaisa)}</th>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

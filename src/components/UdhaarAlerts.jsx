import { useEffect, useState } from 'react';
import { formatPaisa, formatDate } from '../lib/format.js';

/**
 * THE DAILY UDHAAR REMINDER — the client's "date to date notification".
 *
 * Shown on the owner's dashboard every time he signs in. It answers one
 * question: is anyone's money due today, and has anything gone past its date?
 *
 * Both directions, because the shop lends AND borrows:
 *   red    — overdue
 *   yellow — due today or within the warning window
 *
 * Nothing here is stored. "Overdue" is worked out from the due date and today's
 * date each time it is asked, so it can never go stale or need refreshing.
 */

const TONE = { overdue: 'row--overdue', today: 'row--today', soon: 'row--soon' };

export default function UdhaarAlerts({ onOpen }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    window.api.udhaar.alerts().then((r) => r.ok && setData(r.data));
  }, []);

  if (!data) return null;

  const nothing = data.needsAttention === 0;

  return (
    <div className={`panel alerts ${nothing ? '' : 'alerts--active'}`}>
      <div className="detail-head">
        <h2 className="panel__title">
          {nothing ? 'Udhaar — nothing due' : `Udhaar — ${data.needsAttention} need attention`}
        </h2>
        <button className="btn btn--small" onClick={() => onOpen?.()}>
          Open udhaar
        </button>
      </div>

      <div className="cards cards--3">
        <div className={`card-stat ${data.customers.total > 0 ? 'card-stat--due' : ''}`}>
          <span className="card-stat__label">Customers owe us</span>
          <span className="card-stat__value">Rs {formatPaisa(data.customers.total)}</span>
          <span className="text-muted text-small">{data.customers.count} customer(s)</span>
        </div>
        <div className={`card-stat ${data.customers.overdueTotal > 0 ? 'card-stat--overdue' : ''}`}>
          <span className="card-stat__label">Overdue from customers</span>
          <span className="card-stat__value">Rs {formatPaisa(data.customers.overdueTotal)}</span>
          <span className="text-muted text-small">{data.customers.overdueCount} past due date</span>
        </div>
        <div className={`card-stat ${data.suppliers.total > 0 ? 'card-stat--due' : ''}`}>
          <span className="card-stat__label">We owe suppliers</span>
          <span className="card-stat__value">Rs {formatPaisa(data.suppliers.total)}</span>
          <span className="text-muted text-small">{data.suppliers.count} supplier(s)</span>
        </div>
      </div>

      {nothing ? (
        <p className="text-muted">
          No udhaar is due in the next {data.dueSoonDays} days. Anything owed has a later date.
        </p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Who</th>
              <th>Phone</th>
              <th>Direction</th>
              <th className="num">Amount</th>
              <th>Due</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {[...data.customers.urgent, ...data.suppliers.urgent]
              .sort((a, b) => (a.earliestDue || '9999') .localeCompare(b.earliestDue || '9999'))
              .map((r) => (
                <tr key={`${r.side}-${r.id}`} className={TONE[r.dueStatus] || ''}>
                  <td>
                    <strong>{r.name}</strong>
                    <div className="text-muted text-small">
                      {r.openBills} unpaid bill{r.openBills === 1 ? '' : 's'}
                    </div>
                  </td>
                  <td className="text-muted">{r.phone || '—'}</td>
                  <td>
                    <span className={`chip chip--${r.side === 'customer' ? 'credit' : 'bank'}`}>
                      {r.side === 'customer' ? 'They owe us' : 'We owe them'}
                    </span>
                  </td>
                  <td className="num">{formatPaisa(r.balancePaisa)}</td>
                  <td className={r.dueStatus === 'overdue' ? 'text-danger' : ''}>
                    <strong>{r.dueLabel}</strong>
                    {r.earliestDue && (
                      <div className="text-muted text-small">{formatDate(r.earliestDue)}</div>
                    )}
                  </td>
                  <td className="table__actions">
                    <button className="btn btn--small" onClick={() => onOpen?.(r)}>
                      {r.side === 'customer' ? 'Receive payment' : 'Pay supplier'}
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

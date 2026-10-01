import { useEffect, useState } from 'react';
import AttachmentGallery from '../components/AttachmentGallery.jsx';
import { formatPaisa, formatStock, formatDate, formatDateTime } from '../lib/format.js';

/**
 * One purchase, in full: the lines, the money, and the supplier's bill photo
 * shown alongside what was typed in.
 *
 * That side-by-side is the point of the whole attachment feature — months later
 * the owner can check the entry against the original parchi without digging
 * through a shoebox.
 */

const METHOD_LABELS = { cash: 'Cash', bank: 'Bank transfer', credit: 'Udhaar' };

export default function PurchaseDetail({ id, onDelete, deletingBar }) {
  const [purchase, setPurchase] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    window.api.purchases.get(id).then((r) => {
      if (r.ok) setPurchase(r.data);
      else setError(r.message);
    });
  }, [id]);

  if (error) return <div className="callout callout--error">{error}</div>;
  if (!purchase) return <div className="panel text-muted">Loading…</div>;

  return (
    <>
      {deletingBar}

      <div className="panel">
        <div className="detail-head">
          <div>
            <h2 className="panel__title">
              <code>{purchase.purchaseNo}</code> — {purchase.supplierName}
            </h2>
            <p className="text-muted">
              {formatDate(purchase.purchaseDate)} · {METHOD_LABELS[purchase.paymentMethod]} ·
              recorded by {purchase.createdBy || '—'} on {formatDateTime(purchase.createdAt)}
            </p>
          </div>
          <button className="btn btn--small btn--danger" onClick={() => onDelete(purchase)}>
            Delete this bill
          </button>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Entered as</th>
              <th className="num">Stock added</th>
              <th className="num">Damaged</th>
              <th className="num">Rate</th>
              <th className="num">Line total</th>
            </tr>
          </thead>
          <tbody>
            {purchase.items.map((i) => {
              const goodMl = i.quantityMl - (i.damageMl || 0);
              return (
                <tr key={i.id}>
                  <td>
                    {i.companyName} — {i.productName}
                    <div className="text-muted text-small">
                      {i.unitLitres} {i.sizeUnit || 'L'} × {i.unitsPerCarton}/carton
                    </div>
                  </td>
                  <td>
                    {i.entryQty} {i.entryMode}
                    {i.entryQty > 1 ? 's' : ''}
                  </td>
                  <td className="num text-ok">+ {formatStock(goodMl, i.unitType)}</td>
                  <td className="num" style={i.damageQty > 0 ? { color: '#c0392b', fontWeight: 600 } : {}}>
                    {i.damageQty > 0
                      ? `${i.damageQty} ${i.entryMode}${i.damageQty > 1 ? 's' : ''}`
                      : '—'}
                  </td>
                  <td className="num">
                    {formatPaisa(i.ratePaisa)}
                    <div className="text-muted text-small">per {i.entryMode}</div>
                  </td>
                  <td className="num">{formatPaisa(i.lineTotalPaisa)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="totals">
          <div className="totals__row">
            <span>Subtotal</span>
            <span className="num">{formatPaisa(purchase.subtotalPaisa)}</span>
          </div>
          {purchase.discountPaisa > 0 && (
            <div className="totals__row">
              <span>Discount</span>
              <span className="num">− {formatPaisa(purchase.discountPaisa)}</span>
            </div>
          )}
          {purchase.taxPaisa > 0 && (
            <div className="totals__row">
              <span>Tax</span>
              <span className="num">+ {formatPaisa(purchase.taxPaisa)}</span>
            </div>
          )}
          <div className="totals__row totals__row--grand">
            <span>Bill total</span>
            <span className="num">Rs {formatPaisa(purchase.totalPaisa)}</span>
          </div>
          <div className="totals__row">
            <span>Paid</span>
            <span className="num">{formatPaisa(purchase.paidPaisa)}</span>
          </div>
          {purchase.outstandingPaisa > 0 && (
            <div className="totals__row totals__row--due">
              <span>Still owing{purchase.dueDate ? ` — due ${formatDate(purchase.dueDate)}` : ''}</span>
              <span className="num">Rs {formatPaisa(purchase.outstandingPaisa)}</span>
            </div>
          )}
        </div>

        {purchase.notes && (
          <div className="callout">
            <strong>Notes</strong>
            <p>{purchase.notes}</p>
          </div>
        )}
      </div>

      <div className="panel">
        <h2 className="panel__title">Supplier's bill ({purchase.attachments.length})</h2>
        <AttachmentGallery
          attachments={purchase.attachments}
          emptyText="No photo was attached to this purchase."
        />
      </div>
    </>
  );
}

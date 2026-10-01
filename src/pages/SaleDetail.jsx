import { useEffect, useState } from 'react';
import AttachmentGallery from '../components/AttachmentGallery.jsx';
import { formatPaisa, formatStock, formatDate, formatDateTime } from '../lib/format.js';

/**
 * One bill in full, plus a preview of exactly what the printer will produce.
 *
 * The preview is not a re-drawing of the invoice in React — it is the SAME HTML
 * the printer receives, built in the main process and shown here in a sandboxed
 * iframe. If it were drawn twice, the screen and the paper would eventually
 * drift apart, and the paper is the shop's record.
 */

const METHOD_LABELS = { cash: 'Cash', bank: 'Bank transfer', credit: 'Udhaar' };

export default function SaleDetail({ id, isAdmin, onDelete, onPrint }) {
  const [sale, setSale] = useState(null);
  const [html, setHtml] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    window.api.sales.get(id).then((r) => (r.ok ? setSale(r.data) : setError(r.message)));
  }, [id]);

  async function openPreview() {
    setShowPreview(true);
    if (html) return;
    const res = await window.api.sales.preview(id);
    if (res.ok) setHtml(res.data);
    else setError(res.message);
  }

  async function savePdf() {
    setError(null);
    setNotice(null);
    const res = await window.api.sales.savePdf(id);
    if (!res.ok) setError(res.message);
    else if (res.data.saved) setNotice(`Saved to ${res.data.filePath}`);
  }

  if (error) return <div className="callout callout--error">{error}</div>;
  if (!sale) return <div className="panel text-muted">Loading…</div>;

  return (
    <>
      {notice && <div className="callout callout--ok">{notice}</div>}

      <div className="panel">
        <div className="detail-head">
          <div>
            <h2 className="panel__title">
              <code>{sale.invoiceNo}</code> — {sale.customerName || 'Walk-in customer'}
            </h2>
            <p className="text-muted">
              {formatDate(sale.saleDate)} · {METHOD_LABELS[sale.paymentMethod]}
              {sale.paymentChannel ? ` (${sale.paymentChannel})` : ''}
              {sale.paymentRef ? ` · Ref ${sale.paymentRef}` : ''} · sold by{' '}
              {sale.createdBy || '—'} on {formatDateTime(sale.createdAt)}
            </p>
            {sale.customerPhone && (
              <p className="text-muted text-small">Phone: {sale.customerPhone}</p>
            )}
          </div>
          <div className="btn-row" style={{ margin: 0 }}>
            <button className="btn btn--small" onClick={() => onPrint(sale)}>
              Print
            </button>
            <button className="btn btn--small" onClick={openPreview}>
              Preview
            </button>
            <button className="btn btn--small" onClick={savePdf}>
              Save PDF
            </button>
            {isAdmin && (
              <button className="btn btn--small btn--danger" onClick={() => onDelete(sale)}>
                Cancel bill
              </button>
            )}
          </div>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Sold as</th>
              <th className="num">Stock out</th>
              <th className="num">Rate</th>
              <th className="num">Amount</th>
              {isAdmin && <th className="num">Cost</th>}
              {isAdmin && <th className="num">Profit</th>}
            </tr>
          </thead>
          <tbody>
            {sale.items.map((i) => (
              <tr key={i.id}>
                <td>
                  {i.companyName} — {i.productName}
                  <div className="text-muted text-small">
                    {i.unitLitres} {i.sizeUnit || 'L'} × {i.unitsPerCarton}/carton
                  </div>
                </td>
                <td>
                  {i.entryQty} {i.entryMode}
                  {i.entryQty === 1 ? '' : 's'}
                </td>
                <td className="num text-danger">− {formatStock(i.quantityMl, i.unitType)}</td>
                <td className="num">{formatPaisa(i.ratePaisa)}</td>
                <td className="num">{formatPaisa(i.lineTotalPaisa)}</td>
                {isAdmin && <td className="num text-muted">{formatPaisa(i.costPaisa)}</td>}
                {isAdmin && (
                  <td className={`num ${i.profitPaisa < 0 ? 'text-danger' : 'text-ok'}`}>
                    {formatPaisa(i.profitPaisa)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="totals">
          <div className="totals__row">
            <span>Subtotal</span>
            <span className="num">{formatPaisa(sale.subtotalPaisa)}</span>
          </div>
          {sale.discountPaisa > 0 && (
            <div className="totals__row">
              <span>Discount</span>
              <span className="num">− {formatPaisa(sale.discountPaisa)}</span>
            </div>
          )}
          {sale.taxPaisa > 0 && (
            <div className="totals__row">
              <span>Tax</span>
              <span className="num">+ {formatPaisa(sale.taxPaisa)}</span>
            </div>
          )}
          <div className="totals__row totals__row--grand">
            <span>Bill total</span>
            <span className="num">Rs {formatPaisa(sale.totalPaisa)}</span>
          </div>
          <div className="totals__row">
            <span>Paid</span>
            <span className="num">{formatPaisa(sale.paidPaisa)}</span>
          </div>
          {sale.outstandingPaisa > 0 && (
            <div className="totals__row totals__row--due">
              <span>Udhaar{sale.dueDate ? ` — due ${formatDate(sale.dueDate)}` : ''}</span>
              <span className="num">Rs {formatPaisa(sale.outstandingPaisa)}</span>
            </div>
          )}
          {isAdmin && (
            <div className="totals__row totals__row--muted">
              <span>Profit on this bill</span>
              <span className="num">Rs {formatPaisa(sale.profitPaisa || 0)}</span>
            </div>
          )}
        </div>

        {sale.customerId && sale.previousBalancePaisa > 0 && (
          <div className="callout callout--warn">
            <strong>
              {sale.customerName} owed Rs {formatPaisa(sale.previousBalancePaisa)} before this bill
            </strong>
            <p>Total outstanding now: Rs {formatPaisa(sale.customerBalancePaisa)}</p>
          </div>
        )}

        {sale.notes && (
          <div className="callout">
            <strong>Note</strong>
            <p>{sale.notes}</p>
          </div>
        )}
      </div>

      {sale.attachments && sale.attachments.length > 0 && (
        <div className="panel">
          <h2 className="panel__title">
            Payment proof ({sale.attachments.length})
            {sale.paymentChannel ? ` — ${sale.paymentChannel}` : ''}
          </h2>
          <AttachmentGallery attachments={sale.attachments} />
        </div>
      )}

      {showPreview && (
        <div className="panel">
          <div className="detail-head">
            <h2 className="panel__title">What will print</h2>
            <button className="btn btn--small" onClick={() => setShowPreview(false)}>
              Hide
            </button>
          </div>
          {html ? (
            /* sandbox="" blocks scripts entirely — this is display-only paper. */
            <iframe className="printpreview" title="Bill preview" srcDoc={html} sandbox="" />
          ) : (
            <p className="text-muted">Loading preview…</p>
          )}
        </div>
      )}
    </>
  );
}

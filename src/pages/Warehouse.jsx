import { useEffect, useState } from 'react';
import { formatPaisa } from '../lib/format.js';

/**
 * Warehouse — the complete inventory picture.
 *
 * Shows every active product with:
 *   - total stock received (all purchases)
 *   - total damaged
 *   - total sold
 *   - current stock on hand
 *   - supplier
 *   - cost and sale value of current stock
 *
 * Grand totals at the bottom.
 */
export default function Warehouse() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    window.api.reports.warehouse().then((r) => {
      if (r.ok) setData(r.data);
      else setError(r.message);
    });
  }, []);

  if (error) return <div className="callout callout--error">{error}</div>;
  if (!data) return <div className="panel text-muted">Loading warehouse…</div>;

  const needle = search.toLowerCase();
  const filtered = needle
    ? data.items.filter(
        (r) =>
          r.productName.toLowerCase().includes(needle) ||
          r.companyName.toLowerCase().includes(needle) ||
          r.supplierName.toLowerCase().includes(needle)
      )
    : data.items;

  const t = data.totals;

  return (
    <div className="page">
      <div className="page__head">
        <h1 className="page__title">Warehouse</h1>
        <input
          className="field__input"
          style={{ maxWidth: 280 }}
          type="text"
          placeholder="Search product, company, supplier…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* --- summary cards --- */}
      <div className="cards">
        <div className="card-stat card-stat--good">
          <span className="card-stat__label">Total stock on hand</span>
          <span className="card-stat__value">Rs {formatPaisa(t.grandCostPaisa)}</span>
        </div>
        <div className="card-stat">
          <span className="card-stat__label">Sale value</span>
          <span className="card-stat__value">Rs {formatPaisa(t.grandSaleValuePaisa)}</span>
        </div>
        <div className="card-stat" style={t.grandDamageMl > 0 ? { borderLeftColor: '#c0392b' } : {}}>
          <span className="card-stat__label">Total damaged (all time)</span>
          <span className="card-stat__value" style={t.grandDamageMl > 0 ? { color: '#c0392b' } : {}}>
            {t.grandDamageMl > 0 ? 'Yes' : 'None'}
          </span>
        </div>
        <div className="card-stat">
          <span className="card-stat__label">Products tracked</span>
          <span className="card-stat__value">{data.items.length}</span>
        </div>
      </div>

      {/* --- main table --- */}
      <table className="table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Supplier</th>
            <th className="num">Total received</th>
            <th className="num">Damaged</th>
            <th className="num">Total sold</th>
            <th className="num">In stock now</th>
            <th className="num">Cost value</th>
            <th className="num">Sale value</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => (
            <tr key={r.id} className={r.stockMl <= 0 ? 'is-muted' : ''}>
              <td>
                <strong>{r.companyName}</strong> — {r.productName}
              </td>
              <td>{r.supplierName}</td>
              <td className="num">{r.totalInText}</td>
              <td
                className="num"
                style={r.totalDamageMl > 0 ? { color: '#c0392b', fontWeight: 600 } : {}}
              >
                {r.totalDamageMl > 0 ? r.totalDamageText : '—'}
              </td>
              <td className="num">{r.totalSoldText}</td>
              <td className="num" style={{ fontWeight: 600 }}>
                {r.stockText}
              </td>
              <td className="num">{formatPaisa(r.costValuePaisa)}</td>
              <td className="num">{formatPaisa(r.saleValuePaisa)}</td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={8} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>
                {search ? 'No products match your search.' : 'No active products found.'}
              </td>
            </tr>
          )}
        </tbody>
        {filtered.length > 0 && (
          <tfoot>
            <tr style={{ fontWeight: 700, borderTop: '2px solid #000' }}>
              <td colSpan={5} style={{ textAlign: 'right' }}>
                Totals ({filtered.length} products)
              </td>
              <td className="num">
                {/* Filtered totals */}
              </td>
              <td className="num">
                Rs {formatPaisa(filtered.reduce((s, r) => s + r.costValuePaisa, 0))}
              </td>
              <td className="num">
                Rs {formatPaisa(filtered.reduce((s, r) => s + r.saleValuePaisa, 0))}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import Field from '../components/Field.jsx';
import { todayIso } from '../lib/date.js';
import { formatPaisa, formatStock, paisaToRupees } from '../lib/format.js';

/**
 * Record a purchase from a supplier — the "stock in" form.
 *
 * The layout follows the paper parchi the shopkeeper is holding: who it came
 * from, the date, the lines, the discount, what was paid, and a photo of the
 * bill itself.
 *
 * IMPORTANT ABOUT THE TOTALS SHOWN HERE
 * They are a PREVIEW so the owner can check the figures against the parchi
 * before saving. The numbers that get stored are recalculated from scratch by
 * `purchaseService.calculateTotals()` in the main process. If the two ever
 * disagreed, the main process wins — the UI is never trusted with arithmetic
 * that lands in the database.
 */

const EMPTY_ITEM = { productId: '', mode: 'carton', qty: '', rateRupees: '', damageQty: '' };

export default function PurchaseForm({ nextNo, taxEnabled, defaultTaxPercent, onSaved, onCancel }) {
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);

  const [supplierId, setSupplierId] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(todayIso());
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [dueDate, setDueDate] = useState('');
  const [paidRupees, setPaidRupees] = useState('0');
  const [discountRupees, setDiscountRupees] = useState('0');
  const [taxPercent, setTaxPercent] = useState(String(defaultTaxPercent || 0));
  const [notes, setNotes] = useState('');
  const [updateCostPrice, setUpdateCostPrice] = useState(false);
  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);
  const [files, setFiles] = useState([]);

  // IDs of products previously bought from the selected supplier.
  const [supplierProductIds, setSupplierProductIds] = useState(new Set());

  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    window.api.suppliers.list({ activeOnly: true }).then((r) => r.ok && setSuppliers(r.data));
    window.api.products.list({ activeOnly: true }).then((r) => r.ok && setProducts(r.data));
  }, []);

  // When the supplier changes, fetch which products were bought from them before.
  useEffect(() => {
    if (!supplierId) { setSupplierProductIds(new Set()); return; }
    window.api.products.forSupplier(supplierId).then((r) => {
      if (r.ok) setSupplierProductIds(new Set(r.data));
    });
  }, [supplierId]);

  const productById = useMemo(
    () => Object.fromEntries(products.map((p) => [String(p.id), p])),
    [products]
  );

  // Split products into two groups: supplier's products first, then the rest.
  const groupedProducts = useMemo(() => {
    if (!supplierId || supplierProductIds.size === 0) return [{ label: null, items: products }];
    const fromSupplier = products.filter((p) => supplierProductIds.has(p.id));
    const other = products.filter((p) => !supplierProductIds.has(p.id));
    const groups = [];
    if (fromSupplier.length) groups.push({ label: 'From this supplier', items: fromSupplier });
    if (other.length) groups.push({ label: 'Other products', items: other });
    return groups;
  }, [products, supplierId, supplierProductIds]);

  // --- item rows ----------------------------------------------------------

  function setItem(index, patch) {
    setItems((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  /**
   * When a product is chosen, pre-fill the rate from its saved cost price,
   * scaled to the chosen unit. The owner can overwrite it — the supplier's
   * actual rate on the day always wins.
   */
  function chooseProduct(index, productId) {
    const product = productById[String(productId)];
    const mode = items[index].mode;
    setItem(index, {
      productId,
      rateRupees: product ? String(rateForMode(product, mode)) : ''
    });
  }

  function chooseMode(index, mode) {
    const product = productById[String(items[index].productId)];
    setItem(index, {
      mode,
      rateRupees: product ? String(rateForMode(product, mode)) : items[index].rateRupees
    });
  }

  function rateForMode(product, mode) {
    const perPack = paisaToRupees(product.purchasePricePaisa);
    if (mode === 'carton') return perPack * product.unitsPerCarton;
    if (mode === 'pack') return perPack;
    // Loose unit: price per litre / ml / kg / g derived from the stored integer
    if (mode === 'litre') return Number((perPack * 1000 / product.unitMl).toFixed(2));
    if (mode === 'ml')    return Number((perPack / product.unitMl).toFixed(4));
    if (mode === 'kg')    return Number((perPack * 1000000 / product.unitMl).toFixed(2));
    if (mode === 'g')     return Number((perPack * 1000 / product.unitMl).toFixed(4));
    return perPack;
  }

  function addRow() {
    setItems((rows) => [...rows, { ...EMPTY_ITEM }]);
  }

  function removeRow(index) {
    setItems((rows) => (rows.length === 1 ? rows : rows.filter((_, i) => i !== index)));
  }

  // --- preview totals -----------------------------------------------------

  const preview = useMemo(() => {
    const lines = items.map((row) => {
      const product = productById[String(row.productId)];
      const qty = Number(row.qty);
      const rate = Number(row.rateRupees);
      if (!product || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(rate)) {
        return { ml: 0, damageMl: 0, totalPaisa: 0, valid: false };
      }

      const toMl = (q) =>
        row.mode === 'carton' ? q * product.unitMl * product.unitsPerCarton
        : row.mode === 'pack' ? q * product.unitMl
        : row.mode === 'kg'  ? q * 1000000
        : row.mode === 'g'   ? q * 1000
        : row.mode === 'ml'  ? q
        : q * 1000;

      const ml = toMl(qty);
      const dmg = Math.max(0, Math.min(Number(row.damageQty || 0), qty));
      const damageMl = dmg > 0 ? toMl(dmg) : 0;
      const goodQty = qty - dmg;
      const isWeight = product.unitType === 'weight';
      return {
        ml,
        damageMl,
        totalPaisa: Math.round(Math.round(rate * 100) * goodQty),
        valid: true,
        isWeight,
        damageQty: dmg
      };
    });

    const subtotal = lines.reduce((s, l) => s + l.totalPaisa, 0);
    const discount = Math.round(Number(discountRupees || 0) * 100);
    const taxable = Math.max(0, subtotal - discount);
    const pct = taxEnabled ? Number(taxPercent || 0) : 0;
    const tax = pct > 0 ? Math.round((taxable * pct) / 100) : 0;
    const total = taxable + tax;
    const paid = paymentMethod === 'credit' ? Math.round(Number(paidRupees || 0) * 100) : total;

    const totalVolumeMl = lines.filter((l) => !l.isWeight).reduce((s, l) => s + (l.ml - l.damageMl), 0);
    const totalWeightMg = lines.filter((l) => l.isWeight).reduce((s, l) => s + (l.ml - l.damageMl), 0);
    const totalDamageMl = lines.reduce((s, l) => s + l.damageMl, 0);

    return {
      lines,
      subtotal,
      discount,
      tax,
      total,
      paid,
      outstanding: total - paid,
      totalMl: totalVolumeMl + totalWeightMg,
      totalVolumeMl,
      totalWeightMg,
      totalDamageMl
    };
  }, [items, productById, discountRupees, taxPercent, taxEnabled, paymentMethod, paidRupees]);

  // --- attachments --------------------------------------------------------

  async function pickFiles() {
    setError(null);
    const res = await window.api.attachments.pick();
    if (!res.ok) {
      setError(res.message);
      return;
    }
    const inner = res.data;
    if (!inner.ok) return; // cancelled
    setFiles((f) => [...f, ...inner.files]);
    if (inner.rejected?.length) {
      setError(
        `Skipped: ${inner.rejected.map((r) => `${r.name} (${r.reason})`).join(', ')}`
      );
    }
  }

  // --- save ---------------------------------------------------------------

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const res = await window.api.purchases.create({
      supplierId,
      purchaseDate,
      paymentMethod,
      dueDate: dueDate || null,
      paidRupees,
      discountRupees,
      taxPercent,
      notes,
      updateCostPrice,
      items: items.filter((r) => r.productId && r.qty),
      files
    });

    setBusy(false);

    if (!res.ok) {
      setError(res.message);
      return;
    }
    onSaved(res.data);
  }

  if (suppliers.length === 0) {
    return (
      <div className="callout callout--warn">
        <strong>Add a supplier first</strong>
        <p>
          Every purchase has to belong to a supplier. Open the <strong>Suppliers</strong> tab
          and add one, then come back.
        </p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="callout callout--warn">
        <strong>Add a product first</strong>
        <p>
          Open <strong>Stock &amp; prices</strong> → <strong>Products</strong> and add what you buy.
        </p>
      </div>
    );
  }

  const isCredit = paymentMethod === 'credit';

  return (
    <form className="panel" onSubmit={submit}>
      <h2 className="panel__title">
        New purchase {nextNo && <span className="text-muted">— will be {nextNo}</span>}
      </h2>

      {/* --- who and when --- */}
      <div className="grid-3">
        <label className="field">
          <span className="field__label">Supplier *</span>
          <select
            className="field__input"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            disabled={busy}
          >
            <option value="">Choose supplier…</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.balancePaisa > 0 ? ` — we owe ${formatPaisa(s.balancePaisa)}` : ''}
              </option>
            ))}
          </select>
        </label>

        <Field
          label="Purchase date *"
          type="date"
          value={purchaseDate}
          onChange={setPurchaseDate}
          disabled={busy}
        />

        <label className="field">
          <span className="field__label">How was it paid *</span>
          <select
            className="field__input"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            disabled={busy}
          >
            <option value="cash">Cash — paid in full</option>
            <option value="bank">Bank transfer — paid in full</option>
            <option value="credit">Udhaar — pay later</option>
          </select>
        </label>
      </div>

      {/* --- lines --- */}
      <h3 className="panel__subtitle">What came in</h3>

      <table className="table table--form">
        <thead>
          <tr>
            <th>Product</th>
            <th style={{ width: 210 }}>Quantity</th>
            <th style={{ width: 100 }}>Damaged</th>
            <th style={{ width: 150 }}>Rate (Rs)</th>
            <th style={{ width: 130 }} className="num">
              Line total
            </th>
            <th style={{ width: 40 }} />
          </tr>
        </thead>
        <tbody>
          {items.map((row, index) => {
            const product = productById[String(row.productId)];
            const line = preview.lines[index];
            return (
              <tr key={index}>
                <td>
                  <select
                    className="field__input"
                    value={row.productId}
                    onChange={(e) => chooseProduct(index, e.target.value)}
                    disabled={busy}
                  >
                    <option value="">Choose product…</option>
                    {groupedProducts.map((group, gi) => {
                      const opts = group.items.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.companyName} — {p.name} ({p.unitLitres} {p.sizeUnit} × {p.unitsPerCarton})
                        </option>
                      ));
                      return group.label
                        ? <optgroup key={gi} label={group.label}>{opts}</optgroup>
                        : opts;
                    })}
                  </select>
                  {product && line?.valid && (
                    <div className="text-muted text-small">= {formatStock(line.ml, product.unitType)}</div>
                  )}
                </td>
                <td>
                  <div className="qty">
                    <input
                      className="field__input qty__number"
                      type="number"
                      min="0"
                      step="any"
                      value={row.qty}
                      onChange={(e) => setItem(index, { qty: e.target.value })}
                      disabled={busy}
                      placeholder="0"
                    />
                    <select
                      className="field__input qty__unit"
                      value={row.mode}
                      onChange={(e) => chooseMode(index, e.target.value)}
                      disabled={busy}
                    >
                      <option value="carton">cartons</option>
                      <option value="pack">packs</option>
                      {product?.unitType === 'weight' ? (
                        <>
                          <option value="kg">kg</option>
                          <option value="g">g</option>
                        </>
                      ) : (
                        <>
                          <option value="litre">litres</option>
                          <option value="ml">ml</option>
                        </>
                      )}
                    </select>
                  </div>
                </td>
                <td>
                  <input
                    className="field__input"
                    type="number"
                    min="0"
                    step="any"
                    max={row.qty || undefined}
                    value={row.damageQty}
                    onChange={(e) => setItem(index, { damageQty: e.target.value })}
                    disabled={busy}
                    placeholder="0"
                  />
                  <div className="text-muted text-small">{row.mode}{line?.damageQty > 0 ? 's damaged' : ''}</div>
                </td>
                <td>
                  <input
                    className="field__input"
                    type="number"
                    min="0"
                    step="any"
                    value={row.rateRupees}
                    onChange={(e) => setItem(index, { rateRupees: e.target.value })}
                    disabled={busy}
                    placeholder="0"
                  />
                  <div className="text-muted text-small">per {row.mode}</div>
                </td>
                <td className="num">{formatPaisa(line?.totalPaisa || 0)}</td>
                <td>
                  <button
                    className="btn btn--small btn--danger"
                    type="button"
                    onClick={() => removeRow(index)}
                    disabled={busy || items.length === 1}
                    title="Remove this line"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <button className="btn btn--small" type="button" onClick={addRow} disabled={busy}>
        + Add another product
      </button>

      {/* --- money --- */}
      <h3 className="panel__subtitle">Bill amount</h3>

      <div className="grid-3">
        <Field
          label="Discount (Rs)"
          type="number"
          value={discountRupees}
          onChange={setDiscountRupees}
          disabled={busy}
          hint="Leave 0 if none"
        />

        {taxEnabled && (
          <Field
            label="Tax %"
            type="number"
            value={taxPercent}
            onChange={setTaxPercent}
            disabled={busy}
          />
        )}

        {isCredit && (
          <Field
            label="Paid now (Rs)"
            type="number"
            value={paidRupees}
            onChange={setPaidRupees}
            disabled={busy}
            hint="0 if nothing paid yet"
          />
        )}

        {isCredit && preview.outstanding > 0 && (
          <Field
            label="Payment due date *"
            type="date"
            value={dueDate}
            onChange={setDueDate}
            disabled={busy}
            hint="Required — you will be reminded on this date"
          />
        )}
      </div>

      <div className="totals">
        <div className="totals__row">
          <span>Subtotal</span>
          <span className="num">{formatPaisa(preview.subtotal)}</span>
        </div>
        {preview.discount > 0 && (
          <div className="totals__row">
            <span>Discount</span>
            <span className="num">− {formatPaisa(preview.discount)}</span>
          </div>
        )}
        {preview.tax > 0 && (
          <div className="totals__row">
            <span>Tax</span>
            <span className="num">+ {formatPaisa(preview.tax)}</span>
          </div>
        )}
        <div className="totals__row totals__row--grand">
          <span>Bill total</span>
          <span className="num">Rs {formatPaisa(preview.total)}</span>
        </div>
        <div className="totals__row">
          <span>Paid now</span>
          <span className="num">{formatPaisa(preview.paid)}</span>
        </div>
        {preview.outstanding > 0 && (
          <div className="totals__row totals__row--due">
            <span>Udhaar remaining</span>
            <span className="num">Rs {formatPaisa(preview.outstanding)}</span>
          </div>
        )}
        <div className="totals__row totals__row--muted">
          <span>Good stock coming in</span>
          <span className="num">
            {preview.totalVolumeMl > 0 && formatStock(preview.totalVolumeMl, 'volume')}
            {preview.totalVolumeMl > 0 && preview.totalWeightMg > 0 && ' + '}
            {preview.totalWeightMg > 0 && formatStock(preview.totalWeightMg, 'weight')}
            {preview.totalVolumeMl === 0 && preview.totalWeightMg === 0 && '0'}
          </span>
        </div>
        {preview.totalDamageMl > 0 && (
          <div className="totals__row totals__row--muted" style={{ color: '#c0392b' }}>
            <span>Damaged (excluded)</span>
            <span className="num">
              {preview.lines.some((l) => l.isWeight && l.damageMl > 0)
                ? formatStock(preview.lines.filter((l) => l.isWeight).reduce((s, l) => s + l.damageMl, 0), 'weight')
                : formatStock(preview.totalDamageMl, 'volume')}
            </span>
          </div>
        )}
      </div>

      {/* --- bill photo --- */}
      <h3 className="panel__subtitle">Supplier's bill photo</h3>
      <p className="text-muted text-small">
        Attach a photo of the parchi, or a screenshot of the bank transfer. The file is copied into
        your data folder, so it stays even if you delete the original.
      </p>

      <div className="filelist">
        {files.map((f, i) => (
          <div className="filelist__item" key={i}>
            <span>{f.originalName}</span>
            <span className="text-muted text-small">{Math.round(f.sizeBytes / 1024)} KB</span>
            <button
              className="btn btn--small btn--danger"
              type="button"
              onClick={() => setFiles((list) => list.filter((_, j) => j !== i))}
              disabled={busy}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <button className="btn btn--small" type="button" onClick={pickFiles} disabled={busy}>
        + Attach photo or PDF
      </button>

      {/* --- extras --- */}
      <div className="grid-2" style={{ marginTop: 20 }}>
        <Field
          label="Notes (optional)"
          value={notes}
          onChange={setNotes}
          disabled={busy}
          placeholder="e.g. delivered by Akram, 2 cartons dented"
        />
        <label className="field checkbox">
          <input
            type="checkbox"
            checked={updateCostPrice}
            onChange={(e) => setUpdateCostPrice(e.target.checked)}
            disabled={busy}
          />
          <span>
            Update each product's cost price to this rate
            <span className="field__hint">
              Leave off for a one-off deal, or the shop's normal cost basis will change.
            </span>
          </span>
        </label>
      </div>

      {error && <div className="callout callout--error">{error}</div>}

      <div className="btn-row">
        <button className="btn btn--primary" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save purchase & add stock'}
        </button>
        <button className="btn" type="button" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}

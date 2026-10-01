import { useEffect, useMemo, useState } from 'react';
import Field from '../components/Field.jsx';
import QuantityInput from '../components/QuantityInput.jsx';
import ConfirmBar from '../components/ConfirmBar.jsx';
import { formatPaisa, formatStock, formatDate, paisaToRupees } from '../lib/format.js';

const EMPTY = {
  companyId: '',
  defaultSupplierId: '',
  name: '',
  packLabel: '',
  unitLitres: '',
  sizeUnit: 'L',
  unitsPerCarton: '1',
  purchasePriceRupees: '',
  salePriceRupees: '',
  lowStock: { mode: 'carton', qty: '' },
  openingStock: { mode: 'carton', qty: '' }
};

/**
 * Products: the shop's price list and stock levels.
 *
 * The form asks for the pack in the shopkeeper's own words — "5 litre bottle,
 * 12 per carton" — and shows what one carton works out to, so a typo in
 * packs-per-carton is visible before saving rather than after a month of wrong
 * stock counts.
 *
 * Opening stock is optional, as agreed: fill it in if the shop already has that
 * oil on the shelf, leave it blank otherwise.
 */
export default function Products({ readOnly = false }) {
  const [rows, setRows] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [adjustFor, setAdjustFor] = useState(null);
  const [historyFor, setHistoryFor] = useState(null);
  const [deleting, setDeleting] = useState(null);

  async function load() {
    const [p, c, s] = await Promise.all([
      window.api.products.list(),
      window.api.companies.list(),
      window.api.suppliers.list({ activeOnly: false })
    ]);
    if (p.ok) setRows(p.data);
    else setError(p.message);
    if (c.ok) setCompanies(c.data);
    if (s.ok) setSuppliers(s.data);
  }

  useEffect(() => {
    load();
  }, []);

  const activeCompanies = companies.filter((c) => c.isActive);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Live preview so a wrong pack size is obvious before saving.
  const cartonPreview = useMemo(() => {
    const size = Number(form.unitLitres);
    const per = Number(form.unitsPerCarton);
    const u = form.sizeUnit || 'L';
    if (!Number.isFinite(size) || !Number.isFinite(per) || size <= 0 || per <= 0) return null;
    return `1 carton = ${per} × ${size} ${u} = ${(size * per).toLocaleString('en-PK')} ${u}`;
  }, [form.unitLitres, form.unitsPerCarton, form.sizeUnit]);

  // Show exactly how many litres a carton/pack entry works out to, BEFORE
  // saving. This is what makes "5 cartons" unambiguous — 5 cartons of a 1 L × 24
  // product is 120 L, of a 5 L × 12 product it is 300 L, and the owner should
  // never have to work that out in his head or discover it afterwards.
  const isWeight = (form.sizeUnit === 'kg' || form.sizeUnit === 'g');

  function quantityPreview(q, prefix) {
    const size = Number(form.unitLitres);
    const per = Number(form.unitsPerCarton);
    const qty = Number(q?.qty);
    if (!qty || !Number.isFinite(size) || !Number.isFinite(per) || size <= 0 || per <= 0) {
      return null;
    }
    const baseUnit = isWeight ? 'kg' : 'L';
    // For carton/pack modes, multiply out to the base unit.
    // For loose modes (litre/ml/kg/g), show what the user typed in the unit they chose.
    const LOOSE_LABELS = { litre: 'L', ml: 'ml', kg: 'kg', g: 'g' };
    let total, unit;
    if (q.mode === 'carton') { total = qty * size * per; unit = baseUnit; }
    else if (q.mode === 'pack') { total = qty * size; unit = baseUnit; }
    else { total = qty; unit = LOOSE_LABELS[q.mode] || baseUnit; }
    return `${prefix} ${total.toLocaleString('en-PK', { maximumFractionDigits: 3 })} ${unit}`;
  }

  const marginPreview = useMemo(() => {
    const buy = Number(form.purchasePriceRupees);
    const sell = Number(form.salePriceRupees);
    if (!Number.isFinite(buy) || !Number.isFinite(sell) || (!buy && !sell)) return null;
    const margin = sell - buy;
    const pct = buy > 0 ? ((margin / buy) * 100).toFixed(1) : null;
    return `Profit per pack: Rs ${margin.toLocaleString('en-PK')}${pct ? ` (${pct}%)` : ''}`;
  }, [form.purchasePriceRupees, form.salePriceRupees]);

  function openNew() {
    setEditing(null);
    setForm({ ...EMPTY, companyId: activeCompanies[0]?.id ?? '' });
    setShowForm(true);
    setError(null);
  }

  function openEdit(row) {
    setEditing(row);
    const su = row.sizeUnit || 'L';
    setForm({
      companyId: row.companyId,
      defaultSupplierId: row.defaultSupplierId || '',
      name: row.name,
      packLabel: row.packLabel || '',
      unitLitres: String(row.unitLitres),
      sizeUnit: su,
      unitsPerCarton: String(row.unitsPerCarton),
      purchasePriceRupees: String(paisaToRupees(row.purchasePricePaisa)),
      salePriceRupees: String(paisaToRupees(row.salePricePaisa)),
      lowStock: { mode: row.unitType === 'weight' ? 'kg' : 'litre', qty: row.lowStockMl ? String(row.unitType === 'weight' ? row.lowStockMl / 1000000 : row.lowStockMl / 1000) : '' },
      openingStock: { mode: 'carton', qty: '' }
    });
    setShowForm(true);
    setError(null);
  }

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);

    const payload = { ...form };
    if (editing) delete payload.openingStock;

    const res = editing
      ? await window.api.products.update({ ...payload, id: editing.id })
      : await window.api.products.create(payload);

    setBusy(false);

    if (!res.ok) {
      setError(res.message);
      return;
    }

    setNotice(editing ? `Saved "${res.data.name}".` : `Added "${res.data.name}".`);
    setShowForm(false);
    setEditing(null);
    setForm(EMPTY);
    load();
  }

  async function toggle(row) {
    const res = await window.api.products.setActive({ id: row.id, isActive: !row.isActive });
    if (!res.ok) setError(res.message);
    else load();
  }

  async function confirmRemove() {
    const row = deleting;
    const label = `${row.companyName} ${row.name} (${row.unitLitres} ${row.sizeUnit} × ${row.unitsPerCarton}/carton)`;

    setError(null);
    setNotice(null);
    setBusy(true);
    const res = await window.api.products.remove({ id: row.id });
    setBusy(false);
    setDeleting(null);

    if (!res.ok) setError(res.message);
    else {
      setNotice(`Deleted ${label}.`);
      load();
    }
  }

  if (companies.length === 0) {
    return (
      <div className="callout callout--warn">
        <strong>Add a company first</strong>
        <p>
          Every product belongs to a company. Open the <strong>Companies</strong> tab and add one,
          then come back here.
        </p>
      </div>
    );
  }

  return (
    <>
      {error && <div className="callout callout--error">{error}</div>}
      {notice && <div className="callout callout--ok">{notice}</div>}

      {deleting && (
        <ConfirmBar
          title={`Delete ${deleting.companyName} ${deleting.name}?`}
          message={
            deleting.hasMovements
              ? `This product has stock history and bill records. All related stock movements, sale items and purchase items will be removed permanently. This cannot be undone.`
              : `${deleting.unitLitres} ${deleting.sizeUnit} × ${deleting.unitsPerCarton}/carton. This cannot be undone.`
          }
          busy={busy}
          onConfirm={confirmRemove}
          onCancel={() => setDeleting(null)}
        />
      )}

      {!readOnly && (
        <div className="toolbar">
          <button className="btn btn--primary" onClick={showForm ? () => setShowForm(false) : openNew}>
            {showForm ? 'Cancel' : 'Add product'}
          </button>
        </div>
      )}

      {showForm && !readOnly && (
        <form className="panel" onSubmit={submit}>
          <h2 className="panel__title">{editing ? `Edit ${editing.name}` : 'New product'}</h2>

          <div className="grid-2">
            <label className="field">
              <span className="field__label">Company</span>
              <select
                className="field__input"
                value={form.companyId}
                onChange={(e) => set('companyId', e.target.value)}
                disabled={busy || !!editing}
              >
                {activeCompanies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {editing && <span className="field__hint">Company cannot be changed after creation.</span>}
            </label>

            <Field
              label="Product name"
              value={form.name}
              onChange={(v) => set('name', v)}
              disabled={busy}
              placeholder="e.g. Cooking Oil, Banaspati"
            />

            <label className="field">
              <span className="field__label">Default supplier (optional)</span>
              <select
                className="field__input"
                value={form.defaultSupplierId}
                onChange={(e) => set('defaultSupplierId', e.target.value)}
                disabled={busy}
              >
                <option value="">— none —</option>
                {suppliers.filter((s) => s.isActive).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <span className="field__hint">Who do you usually buy this product from?</span>
            </label>

            <div className="field">
              <span className="field__label">Pack size *</span>
              <div className="qty">
                <input
                  className="field__input qty__number"
                  type="number"
                  min="0"
                  step="any"
                  value={form.unitLitres}
                  onChange={(e) => set('unitLitres', e.target.value)}
                  disabled={busy || editing?.hasMovements}
                  placeholder="e.g. 5"
                />
                <select
                  className="field__input qty__unit"
                  value={form.sizeUnit}
                  onChange={(e) => set('sizeUnit', e.target.value)}
                  disabled={busy || editing?.hasMovements}
                >
                  <option value="L">Litres (L)</option>
                  <option value="ml">Millilitres (ml)</option>
                  <option value="kg">Kilograms (kg)</option>
                  <option value="g">Grams (g)</option>
                </select>
              </div>
              <span className="field__hint">
                {editing?.hasMovements ? 'Locked — this product already has stock movements.' : 'One bottle / tin / pouch'}
              </span>
            </div>

            <Field
              label="Packs per carton"
              type="number"
              value={form.unitsPerCarton}
              onChange={(v) => set('unitsPerCarton', v)}
              disabled={busy || editing?.hasMovements}
              hint={cartonPreview || 'Use 1 if it is not sold by carton'}
            />

            <Field
              label="Pack label (optional)"
              value={form.packLabel}
              onChange={(v) => set('packLabel', v)}
              disabled={busy}
              placeholder="e.g. 5 Litre Bottle"
            />

            <div />

            <Field
              label="Purchase price per pack (Rs) *"
              type="number"
              value={form.purchasePriceRupees}
              onChange={(v) => set('purchasePriceRupees', v)}
              disabled={busy}
              hint="Required — what you pay the company"
            />

            <Field
              label="Sale price per pack (Rs) *"
              type="number"
              value={form.salePriceRupees}
              onChange={(v) => set('salePriceRupees', v)}
              disabled={busy}
              hint={marginPreview || 'Required — what the customer pays'}
            />

            <QuantityInput
              label="Warn me when stock falls below (optional)"
              value={form.lowStock}
              onChange={(v) => set('lowStock', v)}
              disabled={busy}
              hint="Leave blank for no warning"
              preview={quantityPreview(form.lowStock, 'Warn below')}
              unitType={isWeight ? 'weight' : 'volume'}
            />

            {!editing && (
              <QuantityInput
                label="Stock already in shop (optional)"
                value={form.openingStock}
                onChange={(v) => set('openingStock', v)}
                disabled={busy}
                hint="Leave blank if none. Recorded as opening stock."
                preview={quantityPreview(form.openingStock, 'Will record')}
                unitType={isWeight ? 'weight' : 'volume'}
              />
            )}
          </div>

          <button className="btn btn--primary" type="submit" disabled={busy}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Add product'}
          </button>
        </form>
      )}

      {adjustFor && (
        <AdjustStock
          product={adjustFor}
          onClose={() => setAdjustFor(null)}
          onDone={() => {
            setAdjustFor(null);
            load();
          }}
        />
      )}

      {historyFor && <StockHistory product={historyFor} onClose={() => setHistoryFor(null)} />}

      <table className="table">
        <thead>
          <tr>
            <th>Company</th>
            <th>Product</th>
            <th>Supplier</th>
            <th>Pack</th>
            <th className="num">Buy</th>
            <th className="num">Sell</th>
            <th className="num">Profit</th>
            <th className="num">In stock</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={9} className="text-muted">
                No products yet.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.id} className={r.isActive ? '' : 'is-muted'}>
              <td>{r.companyName}</td>
              <td>
                {r.name}
                {!r.isActive && <span className="badge"> off</span>}
              </td>
              <td className="text-muted">{r.defaultSupplierName || '—'}</td>
              <td className="text-muted">
                {r.unitLitres} {r.sizeUnit} × {r.unitsPerCarton}/carton
              </td>
              <td className={`num ${r.purchasePricePaisa === 0 ? 'text-danger' : ''}`}>
                {formatPaisa(r.purchasePricePaisa)}
              </td>
              <td className={`num ${r.salePricePaisa === 0 ? 'text-danger' : ''}`}>
                {formatPaisa(r.salePricePaisa)}
                {r.salePricePaisa === 0 && <span className="badge badge--warn"> set price</span>}
              </td>
              <td className={`num ${r.marginPaisa < 0 ? 'text-danger' : ''}`}>
                {formatPaisa(r.marginPaisa)}
              </td>
              <td className={`num ${r.isLowStock ? 'text-danger' : ''}`}>
                {formatStock(r.stockMl, r.unitType)}
                {r.isLowStock && <span className="badge badge--warn"> low</span>}
                {r.stockMl > 0 && <div className="text-muted text-small">{r.stockText}</div>}
              </td>
              <td className="table__actions">
                {!readOnly && (
                  <button className="btn btn--small" onClick={() => openEdit(r)}>
                    Edit
                  </button>
                )}
                {!readOnly && (
                  <button className="btn btn--small" onClick={() => setAdjustFor(r)}>
                    Adjust
                  </button>
                )}
                <button className="btn btn--small" onClick={() => setHistoryFor(r)}>
                  History
                </button>
                {!readOnly && (
                  <button className="btn btn--small" onClick={() => toggle(r)}>
                    {r.isActive ? 'Off' : 'On'}
                  </button>
                )}
                {!readOnly && (
                  <button
                    className="btn btn--small btn--danger"
                    onClick={() => setDeleting(r)}
                    title="Delete permanently"
                  >
                    Delete
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

/**
 * Manual stock correction. Requires a written reason, because a stock change
 * with no explanation is exactly the thing the ledger exists to prevent.
 */
function AdjustStock({ product, onClose, onDone }) {
  const [direction, setDirection] = useState('out');
  const [quantity, setQuantity] = useState({ mode: 'pack', qty: '' });
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await window.api.products.adjustStock({
      id: product.id,
      direction,
      quantity,
      note
    });
    setBusy(false);
    if (!res.ok) setError(res.message);
    else onDone();
  }

  return (
    <form className="panel" onSubmit={submit}>
      <h2 className="panel__title">Correct stock — {product.name}</h2>
      <p className="text-muted">
        Currently {formatStock(product.stockMl, product.unitType)} in stock. This adds a correction to the stock history;
        it does not erase anything.
      </p>

      <div className="grid-2">
        <label className="field">
          <span className="field__label">What happened</span>
          <select
            className="field__input"
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
            disabled={busy}
          >
            <option value="out">Remove — damaged, spilled, miscounted</option>
            <option value="in">Add — found extra stock, miscounted</option>
          </select>
        </label>

        <QuantityInput label="How much" value={quantity} onChange={setQuantity} disabled={busy} unitType={product.unitType} />
      </div>

      <Field
        label="Reason"
        value={note}
        onChange={setNote}
        disabled={busy}
        placeholder="e.g. 2 bottles leaked in storage"
        hint="Required — this is written into the stock history"
      />

      {error && <div className="callout callout--error">{error}</div>}

      <div className="btn-row">
        <button className="btn btn--primary" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Record correction'}
        </button>
        <button className="btn" type="button" onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}

const REF_LABELS = {
  opening: 'Opening stock',
  purchase: 'Purchase',
  sale: 'Sale',
  adjustment: 'Correction'
};

function StockHistory({ product, onClose }) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    window.api.products.stockHistory(product.id).then((r) => r.ok && setRows(r.data));
  }, [product.id]);

  const runningTotal = rows.reduce((sum, r) => sum + r.change_ml, 0);

  return (
    <div className="panel">
      {/*
        The title MUST identify the exact product, not just its name. Two
        products can share a name and differ only by pack size — and because
        "5 cartons" means 300 L for one and 120 L for the other, a history
        panel that only said "Cooking Oil" made correct numbers look wrong.
      */}
      <h2 className="panel__title">
        Stock history — {product.companyName} {product.name}{' '}
        <span className="text-muted">
          ({product.unitLitres} {product.sizeUnit} × {product.unitsPerCarton}/carton)
        </span>
      </h2>
      <p className="text-muted">
        1 carton of this product = {product.unitsPerCarton} × {product.unitLitres} {product.sizeUnit} ={' '}
        <strong>{formatStock(product.cartonMl, product.unitType)}</strong>. Current stock:{' '}
        <strong>{formatStock(product.stockMl, product.unitType)}</strong>.
      </p>

      <table className="table">
        <thead>
          <tr>
            <th>Date</th>
            <th>What</th>
            <th className="num">Change</th>
            <th>Reason</th>
            <th>By</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="text-muted">
                No movements yet.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="text-muted">{formatDate(r.occurred_on)}</td>
              <td>{REF_LABELS[r.ref_type] || r.ref_type}</td>
              <td className={`num ${r.change_ml < 0 ? 'text-danger' : 'text-ok'}`}>
                {r.change_ml > 0 ? '+' : ''}
                {formatStock(r.change_ml, product.unitType)}
              </td>
              <td className="text-muted">{r.note || '—'}</td>
              <td className="text-muted">{r.by_name || '—'}</td>
            </tr>
          ))}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr>
              <th colSpan={2}>Total</th>
              <th className="num">{formatStock(runningTotal, product.unitType)}</th>
              <th colSpan={2} />
            </tr>
          </tfoot>
        )}
      </table>

      <button className="btn" onClick={onClose}>
        Close
      </button>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import Field from '../components/Field.jsx';
import { todayIso } from '../lib/date.js';
import { formatPaisa, formatStock, paisaToRupees } from '../lib/format.js';

/**
 * THE SALE SCREEN — used dozens of times a day, often with a customer waiting.
 *
 * Design rules that follow from that:
 *   - products are big tap targets, not a dropdown
 *   - one keystroke search, always focused
 *   - the running total is always visible
 *   - stock left is shown on every product, so nothing is sold that isn't there
 *   - it saves and prints in one action, then clears itself for the next customer
 *
 * Cost price and profit never appear here. For a worker they are not even sent
 * to the screen; `products.listForSale` strips them in the main process.
 */

export default function NewSale({ user, onSaved }) {
  const isWorker = user?.role === 'user';
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [shop, setShop] = useState({ taxEnabled: false, taxPercent: 0 });
  const [nextNo, setNextNo] = useState(null);

  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]); // { productId, name, companyName, unitMl, unitsPerCarton, salePricePaisa, stockMl, mode, qty, rateRupees }
  const [customerId, setCustomerId] = useState('');
  const [walkinName, setWalkinName] = useState('');
  const [walkinPhone, setWalkinPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentChannel, setPaymentChannel] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [files, setFiles] = useState([]);
  const [paidRupees, setPaidRupees] = useState('0');
  const [discountRupees, setDiscountRupees] = useState('0');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');

  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const searchRef = useRef(null);

  async function loadProducts() {
    const r = await window.api.products.listForSale();
    if (r.ok) setProducts(r.data);
  }

  useEffect(() => {
    loadProducts();
    window.api.customers.list({ activeOnly: true }).then((r) => r.ok && setCustomers(r.data));
    window.api.settings.get().then((r) => r.ok && setShop(r.data));
    window.api.sales.nextNo().then((r) => r.ok && setNextNo(r.data));
    searchRef.current?.focus();
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      `${p.companyName} ${p.name} ${p.packLabel || ''}`.toLowerCase().includes(q)
    );
  }, [products, search]);

  // --- cart ---------------------------------------------------------------

  function addToCart(product) {
    setError(null);
    setCart((rows) => {
      const existing = rows.findIndex((r) => r.productId === product.id && r.mode === 'pack');
      if (existing >= 0) {
        return rows.map((r, i) => (i === existing ? { ...r, qty: String(Number(r.qty) + 1) } : r));
      }
      return [
        ...rows,
        {
          productId: product.id,
          name: product.name,
          companyName: product.companyName,
          unitMl: product.unitMl,
          unitLitres: product.unitLitres,
          unitsPerCarton: product.unitsPerCarton,
          unitType: product.unitType || 'volume',
          sizeUnit: product.sizeUnit || 'L',
          salePricePaisa: product.salePricePaisa,
          stockMl: product.stockMl,
          mode: 'pack',
          qty: '1',
          rateRupees: String(paisaToRupees(product.salePricePaisa))
        }
      ];
    });
    setSearch('');
    searchRef.current?.focus();
  }

  function setLine(index, patch) {
    setCart((rows) =>
      rows.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row, ...patch };
        // Changing the unit re-prices the line from the shop's sale price,
        // unless the worker has typed his own rate.
        if (patch.mode && patch.mode !== row.mode) {
          const perPack = paisaToRupees(row.salePricePaisa);
          if (patch.mode === 'carton')     next.rateRupees = String(perPack * row.unitsPerCarton);
          else if (patch.mode === 'pack')  next.rateRupees = String(perPack);
          else if (patch.mode === 'litre') next.rateRupees = String(Number((perPack * 1000 / row.unitMl).toFixed(2)));
          else if (patch.mode === 'ml')    next.rateRupees = String(Number((perPack / row.unitMl).toFixed(4)));
          else if (patch.mode === 'kg')    next.rateRupees = String(Number((perPack * 1000000 / row.unitMl).toFixed(2)));
          else if (patch.mode === 'g')     next.rateRupees = String(Number((perPack * 1000 / row.unitMl).toFixed(4)));
        }
        return next;
      })
    );
  }

  function removeLine(index) {
    setCart((rows) => rows.filter((_, i) => i !== index));
  }

  function clearAll() {
    setCart([]);
    setCustomerId('');
    setWalkinName('');
    setWalkinPhone('');
    setPaymentMethod('cash');
    setPaymentChannel('');
    setPaymentRef('');
    setFiles([]);
    setPaidRupees('0');
    setDiscountRupees('0');
    setDueDate('');
    setNotes('');
    setError(null);
    setSearch('');
    searchRef.current?.focus();
  }

  // --- live totals (preview only; the main process recalculates on save) ---

  const totals = useMemo(() => {
    const lines = cart.map((row) => {
      const qty = Number(row.qty);
      const rate = Number(row.rateRupees);
      if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(rate)) {
        return { ml: 0, totalPaisa: 0 };
      }
      const ml =
        row.mode === 'carton'
          ? qty * row.unitMl * row.unitsPerCarton
          : row.mode === 'pack'
            ? qty * row.unitMl
            : row.mode === 'kg'
              ? qty * 1000000
              : row.mode === 'g'
                ? qty * 1000
                : row.mode === 'ml'
                  ? qty
                  : qty * 1000;
      const isWeight = row.unitType === 'weight';
      return { ml, totalPaisa: Math.round(Math.round(rate * 100) * qty), isWeight };
    });

    const subtotal = lines.reduce((s, l) => s + l.totalPaisa, 0);
    const discount = Math.round(Number(discountRupees || 0) * 100);
    const taxable = Math.max(0, subtotal - discount);
    const pct = shop.taxEnabled ? Number(shop.taxPercent || 0) : 0;
    const tax = pct > 0 ? Math.round((taxable * pct) / 100) : 0;
    const total = taxable + tax;
    const paid = paymentMethod === 'credit' ? Math.round(Number(paidRupees || 0) * 100) : total;

    const totalVolumeMl = lines.filter((l) => !l.isWeight).reduce((s, l) => s + l.ml, 0);
    const totalWeightMg = lines.filter((l) => l.isWeight).reduce((s, l) => s + l.ml, 0);

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
      totalWeightMg
    };
  }, [cart, discountRupees, paidRupees, paymentMethod, shop]);

  // Warn before saving, not after: sum per product, because the same oil can
  // appear on two lines of one bill.
  const stockProblem = useMemo(() => {
    const wanted = new Map();
    cart.forEach((row, i) => {
      const ml = totals.lines[i]?.ml || 0;
      wanted.set(row.productId, (wanted.get(row.productId) || 0) + ml);
    });
    for (const row of cart) {
      const need = wanted.get(row.productId) || 0;
      if (need > row.stockMl) {
        const fmt = (v) => formatStock(v, row.unitType);
        return `Not enough "${row.name}" — you have ${fmt(row.stockMl)}, this bill needs ${fmt(need)}.`;
      }
    }
    return null;
  }, [cart, totals]);

  const isCredit = paymentMethod === 'credit';
  const isDigital = paymentMethod === 'bank';
  const selectedCustomer = customers.find((c) => String(c.id) === String(customerId));

  /**
   * Attach the payment proof — a JazzCash / EasyPaisa / bank screenshot.
   * Nothing is copied to disk until the bill is saved, so abandoning a
   * half-typed sale leaves no stray files behind.
   */
  async function pickFiles() {
    setError(null);
    const res = await window.api.attachments.pick();
    if (!res.ok) {
      setError(res.message);
      return;
    }
    if (!res.data.ok) return; // cancelled
    setFiles((f) => [...f, ...res.data.files]);
    if (res.data.rejected?.length) {
      setError(`Skipped: ${res.data.rejected.map((r) => `${r.name} (${r.reason})`).join(', ')}`);
    }
  }

  // --- save ---------------------------------------------------------------

  async function save({ print }) {
    setError(null);

    if (cart.length === 0) {
      setError('Add at least one product to the bill.');
      return;
    }
    if (stockProblem) {
      setError(stockProblem);
      return;
    }

    setBusy(true);

    const res = await window.api.sales.create({
      customerId: customerId || null,
      walkinName,
      walkinPhone,
      saleDate: todayIso(),
      paymentMethod,
      paymentChannel,
      paymentRef,
      files,
      paidRupees,
      discountRupees,
      dueDate: dueDate || null,
      notes,
      items: cart.map((r) => ({
        productId: r.productId,
        mode: r.mode,
        qty: r.qty,
        rateRupees: r.rateRupees
      }))
    });

    if (!res.ok) {
      setBusy(false);
      setError(res.message);
      return;
    }

    const sale = res.data;

    if (print) {
      // A failed or cancelled print must never lose the sale — it is already
      // saved. The worker can print again from the list.
      const printed = await window.api.sales.print({ id: sale.id });
      if (!printed.ok) {
        setError(`Bill ${sale.invoiceNo} was saved, but printing failed: ${printed.message}`);
      }
    }

    setBusy(false);
    clearAll();
    loadProducts(); // stock has changed
    window.api.sales.nextNo().then((r) => r.ok && setNextNo(r.data));
    onSaved?.(sale);
  }

  if (products.length === 0) {
    return (
      <div className="callout callout--warn">
        <strong>No products to sell</strong>
        <p>Ask the shop owner to add products under Stock &amp; prices first.</p>
      </div>
    );
  }

  return (
    <div className="pos">
      {/* ---------------- product picker ---------------- */}
      <div>
        <input
          ref={searchRef}
          className="field__input pos__search"
          placeholder="Search product…  (type to filter)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="pickgrid">
          {visible.map((p) => {
            const out = p.stockMl <= 0;
            return (
              <button
                key={p.id}
                className={`pick${out ? ' pick--out' : ''}`}
                onClick={() => !out && addToCart(p)}
                disabled={out}
                title={out ? 'Out of stock' : 'Add to bill'}
              >
                <div className="pick__name">{p.name}</div>
                <div className="pick__meta">
                  {p.companyName} · {p.packLabel || `${p.unitLitres} ${p.sizeUnit}`}
                </div>
                <div className="pick__price">Rs {formatPaisa(p.salePricePaisa)}</div>
                <div className={`pick__stock${p.isLowStock ? ' is-low' : ''}`}>
                  {out ? 'Out of stock' : `${formatStock(p.stockMl, p.unitType)} left`}
                </div>
              </button>
            );
          })}
          {visible.length === 0 && <p className="text-muted">No product matches "{search}".</p>}
        </div>
      </div>

      {/* ---------------- the bill ---------------- */}
      <div className="pos__side">
        <div className="panel">
          <div className="pos__billhead">
            <strong>This bill</strong>
            {nextNo && <span className="text-muted text-small">{nextNo}</span>}
          </div>

          <label className="field">
            <span className="field__label">Customer</span>
            <select
              className="field__input"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              disabled={busy}
            >
              <option value="">Walk-in customer</option>
              {/*
                Phone is shown in the list because two customers can easily
                share a name — "Bilal Store" is not a unique thing to be called
                in a bazaar. The phone number is how the worker tells them apart.
              */}
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.phone ? ` · ${c.phone}` : ''}
                  {c.balancePaisa > 0 ? ` — owes ${formatPaisa(c.balancePaisa)}` : ''}
                </option>
              ))}
            </select>
            {selectedCustomer && (
              <span className="field__hint">
                {selectedCustomer.phone ? `Phone ${selectedCustomer.phone}` : 'No phone on record'}
                {selectedCustomer.balancePaisa > 0
                  ? ` · already owes Rs ${formatPaisa(selectedCustomer.balancePaisa)}`
                  : ''}
              </span>
            )}
          </label>

          <label className="field">
            <span className="field__label">Payment</span>
            <select
              className="field__input"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              disabled={busy}
            >
              <option value="cash">Cash</option>
              <option value="bank">Bank / JazzCash / EasyPaisa</option>
              <option value="credit">Udhaar — pay later</option>
            </select>
          </label>

          {/* Digital payment: which service, their reference, and the proof. */}
          {isDigital && (
            <>
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
                    {(shop.paymentChannels || []).map((ch) => (
                      <option key={ch} value={ch}>
                        {ch}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field__label">Reference / TID</span>
                  <input
                    className="field__input"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    disabled={busy}
                    placeholder="optional"
                  />
                </label>
              </div>

              <div className="filelist">
                {files.map((f, i) => (
                  <div className="filelist__item" key={i}>
                    <span>{f.originalName}</span>
                    <span className="text-muted text-small">
                      {Math.round(f.sizeBytes / 1024)} KB
                    </span>
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
                ＋ Attach payment screenshot
              </button>
            </>
          )}

          {/*
            The walk-in name boxes appear ONLY for cash and bank sales.
            They are ignored for udhaar, and showing an input that will be
            thrown away is worse than not showing it at all — the user types
            into it, then gets told no.
          */}
          {!customerId && !isCredit && (
            <div className="grid-2">
              <Field
                label="Customer name (optional)"
                value={walkinName}
                onChange={setWalkinName}
                disabled={busy}
                placeholder="write on the bill"
              />
              <Field
                label="Phone (optional)"
                value={walkinPhone}
                onChange={setWalkinPhone}
                disabled={busy}
                placeholder="03xx-xxxxxxx"
              />
            </div>
          )}

          {isCredit && !customerId && (
            <div className="callout callout--warn">
              <strong>Udhaar needs a saved customer</strong>
              <p>
                Pick one from the <strong>Customer</strong> list above. A name typed on the bill is
                only printed text — there would be no account to track the debt, no reminder when
                it is due, and no way to record the payment later.
              </p>
              <p className="text-muted text-small">
                New customer? Add them under the <strong>Customers</strong> tab first, then come
                back to this bill.
              </p>
            </div>
          )}

          {isCredit && selectedCustomer && selectedCustomer.balancePaisa > 0 && (
            <div className="callout callout--warn">
              <strong>{selectedCustomer.name} already owes Rs {formatPaisa(selectedCustomer.balancePaisa)}</strong>
            </div>
          )}
        </div>

        <div className="panel pos__cart">
          {cart.length === 0 ? (
            <p className="text-muted">Tap a product on the left to start the bill.</p>
          ) : (
            <table className="table table--form">
              <tbody>
                {cart.map((row, index) => (
                  <tr key={`${row.productId}-${index}`}>
                    <td>
                      <div className="pick__name">{row.name}</div>
                      <div className="text-muted text-small">
                        {row.companyName} · {formatStock(totals.lines[index]?.ml || 0, row.unitType)}
                      </div>
                      <div className="qty" style={{ marginTop: 6 }}>
                        <input
                          className="field__input qty__number"
                          type="number"
                          min="0"
                          step="any"
                          value={row.qty}
                          onChange={(e) => setLine(index, { qty: e.target.value })}
                          disabled={busy}
                        />
                        <select
                          className="field__input qty__unit"
                          value={row.mode}
                          onChange={(e) => setLine(index, { mode: e.target.value })}
                          disabled={busy}
                        >
                          <option value="pack">packs</option>
                          <option value="carton">cartons</option>
                          {row.unitType === 'weight' ? (
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
                        <input
                          className="field__input qty__rate"
                          type="number"
                          min="0"
                          step="any"
                          value={row.rateRupees}
                          onChange={(e) => !isWorker && setLine(index, { rateRupees: e.target.value })}
                          readOnly={isWorker}
                          disabled={busy}
                          title={isWorker ? 'Price set by admin' : 'Rate per unit'}
                        />
                      </div>
                    </td>
                    <td className="num" style={{ verticalAlign: 'top', width: 90 }}>
                      {formatPaisa(totals.lines[index]?.totalPaisa || 0)}
                      <div>
                        <button
                          className="btn btn--small btn--danger"
                          onClick={() => removeLine(index)}
                          disabled={busy}
                          style={{ marginTop: 6 }}
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="grid-2" style={{ marginTop: 12 }}>
            <label className="field">
              <span className="field__label">Discount (Rs)</span>
              <input
                className="field__input"
                type="number"
                value={discountRupees}
                onChange={(e) => setDiscountRupees(e.target.value)}
                disabled={busy}
              />
            </label>
            {isCredit && (
              <label className="field">
                <span className="field__label">Paid now (Rs)</span>
                <input
                  className="field__input"
                  type="number"
                  value={paidRupees}
                  onChange={(e) => setPaidRupees(e.target.value)}
                  disabled={busy}
                />
              </label>
            )}
          </div>

          {isCredit && totals.outstanding > 0 && (
            <label className="field">
              <span className="field__label">Payment due date *</span>
              <input
                className="field__input"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={busy}
              />
              <span className="field__hint">Required — the owner is reminded on this date</span>
            </label>
          )}

          <div className="totals" style={{ maxWidth: 'none', marginLeft: 0 }}>
            <div className="totals__row">
              <span>Subtotal</span>
              <span className="num">{formatPaisa(totals.subtotal)}</span>
            </div>
            {totals.discount > 0 && (
              <div className="totals__row">
                <span>Discount</span>
                <span className="num">− {formatPaisa(totals.discount)}</span>
              </div>
            )}
            {totals.tax > 0 && (
              <div className="totals__row">
                <span>Tax</span>
                <span className="num">+ {formatPaisa(totals.tax)}</span>
              </div>
            )}
            <div className="totals__row totals__row--grand">
              <span>Total</span>
              <span className="num">Rs {formatPaisa(totals.total)}</span>
            </div>
            {totals.outstanding > 0 && (
              <div className="totals__row totals__row--due">
                <span>Udhaar</span>
                <span className="num">Rs {formatPaisa(totals.outstanding)}</span>
              </div>
            )}
            <div className="totals__row totals__row--muted">
              <span>Stock going out</span>
              <span className="num">
                {totals.totalVolumeMl > 0 && formatStock(totals.totalVolumeMl, 'volume')}
                {totals.totalVolumeMl > 0 && totals.totalWeightMg > 0 && ' + '}
                {totals.totalWeightMg > 0 && formatStock(totals.totalWeightMg, 'weight')}
                {totals.totalVolumeMl === 0 && totals.totalWeightMg === 0 && '0'}
              </span>
            </div>
          </div>

          {stockProblem && <div className="callout callout--error">{stockProblem}</div>}
          {error && <div className="callout callout--error">{error}</div>}

          <button
            className="btn btn--primary btn--block pos__save"
            onClick={() => save({ print: true })}
            disabled={busy || cart.length === 0}
          >
            {busy ? 'Saving…' : 'Save & print bill'}
          </button>
          <div className="btn-row">
            <button
              className="btn"
              onClick={() => save({ print: false })}
              disabled={busy || cart.length === 0}
            >
              Save without printing
            </button>
            <button className="btn" onClick={clearAll} disabled={busy}>
              Clear
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

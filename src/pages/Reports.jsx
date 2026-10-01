import { useCallback, useEffect, useMemo, useState } from 'react';
import SubTabs from '../components/SubTabs.jsx';
import { TrendChart, ShareChart } from '../components/Charts.jsx';
import { toIso, todayIso, addDays, monthRange } from '../lib/date.js';
import { formatPaisa } from '../lib/format.js';

/**
 * REPORTS — the whole business over a chosen period, with export.
 *
 * The period presets exist because a shopkeeper does not want to pick two dates
 * to answer "how was last month". Custom dates are there for when he does.
 */

/*
 * Every date here comes from lib/date.js, which works in LOCAL calendar days.
 *
 * This is where a real bug lived: the presets used `toISOString()`, which
 * converts to UTC. At UTC+5 that made "August" run from 31 July to 30 August —
 * every report was a day out at both ends, silently.
 */
function presets() {
  const today = todayIso();
  const thisMonth = monthRange(0);
  const lastMonth = monthRange(-1);
  const yearStart = toIso(new Date(new Date().getFullYear(), 0, 1));

  return [
    { id: 'today', label: 'Today', from: today, to: today, granularity: 'day' },
    { id: 'week', label: 'Last 7 days', from: addDays(today, -6), to: today, granularity: 'day' },
    { id: 'month', label: thisMonth.label, ...thisMonth, granularity: 'day' },
    { id: 'lastmonth', label: lastMonth.label, ...lastMonth, granularity: 'day' },
    { id: 'year', label: 'This year', from: yearStart, to: today, granularity: 'month' }
  ];
}

export default function Reports() {
  const [tab, setTab] = useState('overview');
  const all = useMemo(presets, []);
  const [range, setRange] = useState(() => {
    const m = all.find((p) => p.id === 'month');
    return { from: m.from, to: m.to, granularity: 'day', preset: 'month' };
  });

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const res = await window.api.reports.full({
      from: range.from,
      to: range.to,
      granularity: range.granularity
    });
    if (res.ok) setData(res.data);
    else setError(res.message);
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  async function exportPdf() {
    setBusy(true);
    setNotice(null);
    const res = await window.api.exports.reportPdf(range);
    setBusy(false);
    if (!res.ok) return setError(res.message);
    if (res.data.saved) setNotice(`PDF saved to ${res.data.filePath}`);
  }

  async function exportExcel() {
    setBusy(true);
    setNotice(null);
    const res = await window.api.exports.reportExcel(range);
    setBusy(false);
    if (!res.ok) return setError(res.message);
    if (res.data.saved) setNotice(`Excel file saved to ${res.data.filePath}`);
  }

  return (
    <div className="page page--wide">
      <div className="page__head">
        <h1 className="page__title">Reports</h1>
        <div className="btn-row" style={{ margin: 0 }}>
          <button className="btn" onClick={exportPdf} disabled={busy || !data}>
            Export PDF
          </button>
          <button className="btn" onClick={exportExcel} disabled={busy || !data}>
            Export Excel
          </button>
        </div>
      </div>

      {error && <div className="callout callout--error">{error}</div>}
      {notice && <div className="callout callout--ok">{notice}</div>}

      <div className="panel filters">
        {all.map((p) => (
          <button
            key={p.id}
            className={`btn btn--small${range.preset === p.id ? ' btn--primary' : ''}`}
            onClick={() =>
              setRange({ from: p.from, to: p.to, granularity: p.granularity, preset: p.id })
            }
          >
            {p.label}
          </button>
        ))}

        <label className="field">
          <span className="field__label">From</span>
          <input
            className="field__input"
            type="date"
            value={range.from}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value, preset: 'custom' }))}
          />
        </label>
        <label className="field">
          <span className="field__label">To</span>
          <input
            className="field__input"
            type="date"
            value={range.to}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value, preset: 'custom' }))}
          />
        </label>
        <label className="field">
          <span className="field__label">Group by</span>
          <select
            className="field__input"
            value={range.granularity}
            onChange={(e) => setRange((r) => ({ ...r, granularity: e.target.value }))}
          >
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </label>
      </div>

      <SubTabs
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'products', label: 'Products' },
          { id: 'stock', label: 'Stock value' },
          { id: 'compare', label: 'Compare months' }
        ]}
        value={tab}
        onChange={setTab}
      />

      {!data ? (
        <div className="panel text-muted">Loading…</div>
      ) : (
        <>
          {tab === 'overview' && <Overview data={data} />}
          {tab === 'products' && <Products data={data} />}
          {tab === 'stock' && <Stock data={data} />}
          {tab === 'compare' && <Compare />}
        </>
      )}
    </div>
  );
}

function Overview({ data }) {
  const s = data.summary;

  return (
    <>
      <div className="cards">
        <div className="card-stat card-stat--good">
          <span className="card-stat__label">Sales ({s.sales.count} bills)</span>
          <span className="card-stat__value">Rs {formatPaisa(s.sales.totalPaisa)}</span>
          <span className="text-muted text-small">{s.sales.quantityText} sold</span>
        </div>
        <div className="card-stat">
          <span className="card-stat__label">Cost of goods sold</span>
          <span className="card-stat__value">Rs {formatPaisa(s.costPaisa)}</span>
          <span className="text-muted text-small">{s.marginPercent}% margin</span>
        </div>
        <div className="card-stat">
          <span className="card-stat__label">Expenses</span>
          <span className="card-stat__value">Rs {formatPaisa(s.expenses.totalPaisa)}</span>
          <span className="text-muted text-small">{s.expenses.count} entries</span>
        </div>
        <div className={`card-stat ${s.netProfitPaisa >= 0 ? 'card-stat--good' : 'card-stat--overdue'}`}>
          <span className="card-stat__label">Net profit</span>
          <span className="card-stat__value">Rs {formatPaisa(s.netProfitPaisa)}</span>
          <span className="text-muted text-small">after everything</span>
        </div>
      </div>

      <div className="panel">
        <h2 className="panel__title">Sales and profit over time</h2>
        <TrendChart data={data.series} />
      </div>

      <div className="grid-2">
        <div className="panel">
          <h2 className="panel__title">Where the money went</h2>
          <ShareChart
            items={[
              { label: 'Cost of goods sold', valuePaisa: s.costPaisa },
              ...s.expenses.byCategory.map((c) => ({ label: c.category, valuePaisa: c.totalPaisa })),
              ...(s.netProfitPaisa > 0
                ? [{ label: 'Profit kept', valuePaisa: s.netProfitPaisa }]
                : [])
            ]}
            totalPaisa={
              s.costPaisa + s.expenses.totalPaisa + Math.max(0, s.netProfitPaisa)
            }
          />
        </div>

        <div className="panel">
          <h2 className="panel__title">Udhaar position right now</h2>
          <table className="table">
            <tbody>
              <tr>
                <td>Customers owe the shop</td>
                <td className="num text-danger">
                  {formatPaisa(data.outstanding.customersTotalPaisa)}
                </td>
              </tr>
              <tr>
                <td>The shop owes suppliers</td>
                <td className="num">{formatPaisa(data.outstanding.suppliersTotalPaisa)}</td>
              </tr>
              <tr>
                <td>Udhaar given out this period</td>
                <td className="num">{formatPaisa(s.sales.udhaarGivenPaisa)}</td>
              </tr>
              <tr>
                <td>Udhaar recovered this period</td>
                <td className="num text-ok">{formatPaisa(s.payments.receivedPaisa)}</td>
              </tr>
            </tbody>
          </table>
          <p className="text-muted text-small">
            The first two are a snapshot of today, not of the chosen period — money owed does not
            belong to a date range.
          </p>
        </div>
      </div>

      <div className="panel">
        <h2 className="panel__title">Period by period</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Period</th>
              <th className="num">Bills</th>
              <th className="num">Sales</th>
              <th className="num">Cost</th>
              <th className="num">Gross profit</th>
              <th className="num">Expenses</th>
              <th className="num">Stock bought</th>
              <th className="num">Net profit</th>
            </tr>
          </thead>
          <tbody>
            {data.series.length === 0 && (
              <tr>
                <td colSpan={8} className="text-muted">
                  Nothing recorded in this period.
                </td>
              </tr>
            )}
            {/*
              A row can be all zeros except "Stock bought" — that is a day the
              shop only took delivery. Without this column such a row looked
              like a bug rather than a quiet day.
            */}
            {data.series.map((b) => (
              <tr key={b.bucket}>
                <td>{b.label}</td>
                <td className="num">{b.billCount}</td>
                <td className="num">{formatPaisa(b.salesTotalPaisa)}</td>
                <td className="num">{formatPaisa(b.costPaisa)}</td>
                <td className="num text-ok">{formatPaisa(b.grossProfitPaisa)}</td>
                <td className="num">{formatPaisa(b.expensesPaisa)}</td>
                <td className="num text-muted">{formatPaisa(b.purchasesPaisa)}</td>
                <td className={`num ${b.netProfitPaisa < 0 ? 'text-danger' : 'text-ok'}`}>
                  {formatPaisa(b.netProfitPaisa)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Products({ data }) {
  return (
    <>
      <div className="panel">
        <h2 className="panel__title">Best sellers</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Product</th>
              <th className="num">Bills</th>
              <th className="num">Quantity</th>
              <th className="num">Cartons</th>
              <th className="num">Sold for</th>
              <th className="num">Profit</th>
            </tr>
          </thead>
          <tbody>
            {data.topProducts.length === 0 && (
              <tr>
                <td colSpan={6} className="text-muted">
                  Nothing sold in this period.
                </td>
              </tr>
            )}
            {data.topProducts.map((p) => (
              <tr key={p.productId}>
                <td>
                  {p.companyName} — {p.productName}
                </td>
                <td className="num">{p.billCount}</td>
                <td className="num">{p.quantityText}</td>
                <td className="num">{p.cartons}</td>
                <td className="num">{formatPaisa(p.revenuePaisa)}</td>
                <td className={`num ${p.profitPaisa < 0 ? 'text-danger' : 'text-ok'}`}>
                  {formatPaisa(p.profitPaisa)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.byCompany.length > 0 && (
        <div className="panel">
          <h2 className="panel__title">By company</h2>
          <ShareChart
            items={data.byCompany.map((c) => ({ label: c.companyName, valuePaisa: c.revenuePaisa }))}
            totalPaisa={data.byCompany.reduce((t, c) => t + c.revenuePaisa, 0)}
          />
        </div>
      )}
    </>
  );
}

function Stock({ data }) {
  const cost = data.stock.reduce((t, p) => t + p.costValuePaisa, 0);
  const sale = data.stock.reduce((t, p) => t + p.saleValuePaisa, 0);

  return (
    <div className="panel">
      <h2 className="panel__title">What the stock on the shelf is worth</h2>
      <div className="cards cards--3">
        <div className="card-stat">
          <span className="card-stat__label">Value at cost</span>
          <span className="card-stat__value">Rs {formatPaisa(cost)}</span>
        </div>
        <div className="card-stat">
          <span className="card-stat__label">Value at sale price</span>
          <span className="card-stat__value">Rs {formatPaisa(sale)}</span>
        </div>
        <div className="card-stat card-stat--good">
          <span className="card-stat__label">Profit if it all sells</span>
          <span className="card-stat__value">Rs {formatPaisa(sale - cost)}</span>
        </div>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Product</th>
            <th className="num">In stock</th>
            <th className="num">Packs</th>
            <th className="num">At cost</th>
            <th className="num">At sale price</th>
          </tr>
        </thead>
        <tbody>
          {data.stock.map((p, i) => (
            <tr key={i} className={p.isLowStock ? 'row--soon' : ''}>
              <td>
                {p.companyName} — {p.productName}
                {p.isLowStock && <span className="badge badge--warn"> low</span>}
              </td>
              <td className="num">{p.stockText}</td>
              <td className="num">{p.packs}</td>
              <td className="num">{formatPaisa(p.costValuePaisa)}</td>
              <td className="num">{formatPaisa(p.saleValuePaisa)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th colSpan={3}>Total</th>
            <th className="num">{formatPaisa(cost)}</th>
            <th className="num">{formatPaisa(sale)}</th>
          </tr>
        </tfoot>
      </table>

      <p className="text-muted text-small">
        Valued at what it cost, not what it might sell for — unsold oil is not profit yet.
      </p>
    </div>
  );
}

/**
 * Month vs month — the client asked for this by name: "January vs February,
 * sab cheez compare ho".
 */
function Compare() {
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const months = useMemo(() => {
    const list = [];
    for (let i = 0; i < 13; i += 1) {
      const m = monthRange(-i);
      list.push({ id: m.from.slice(0, 7), label: m.label, from: m.from, to: m.to });
    }
    return list;
  }, []);

  const [aId, setAId] = useState(months[1]?.id || months[0].id);
  const [bId, setBId] = useState(months[0].id);

  const run = useCallback(async () => {
    const a = months.find((m) => m.id === aId);
    const b = months.find((m) => m.id === bId);
    const res = await window.api.reports.compare({
      a: { from: a.from, to: a.to, label: a.label },
      b: { from: b.from, to: b.to, label: b.label }
    });
    if (res.ok) setResult(res.data);
    else setError(res.message);
  }, [aId, bId, months]);

  useEffect(() => {
    run();
  }, [run]);

  return (
    <div className="panel">
      <h2 className="panel__title">Compare two months</h2>

      {error && <div className="callout callout--error">{error}</div>}

      <div className="grid-2">
        <label className="field">
          <span className="field__label">Earlier month</span>
          <select className="field__input" value={aId} onChange={(e) => setAId(e.target.value)}>
            {months.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Compare with</span>
          <select className="field__input" value={bId} onChange={(e) => setBId(e.target.value)}>
            {months.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {result && (
        <table className="table">
          <thead>
            <tr>
              <th />
              <th className="num">{result.a.label}</th>
              <th className="num">{result.b.label}</th>
              <th className="num">Change</th>
              <th className="num">%</th>
            </tr>
          </thead>
          <tbody>
            {result.lines.map((l) => {
              const isCount = l.label === 'Bills';
              const isVolume = l.label === 'Volume sold';
              const isWeight = l.label === 'Weight sold';
              const fmt = (v) =>
                isCount ? v
                  : isVolume ? `${(v / 1000).toLocaleString()} L`
                  : isWeight ? `${(v / 1000000).toLocaleString()} kg`
                  : formatPaisa(v);
              return (
                <tr key={l.label}>
                  <td>{l.label}</td>
                  <td className="num">{fmt(l.beforePaisa)}</td>
                  <td className="num">{fmt(l.afterPaisa)}</td>
                  <td className={`num ${l.isImprovement ? 'text-ok' : 'text-danger'}`}>
                    {l.changePaisa >= 0 ? '+' : '−'} {fmt(Math.abs(l.changePaisa))}
                  </td>
                  <td className={`num ${l.isImprovement ? 'text-ok' : 'text-danger'}`}>
                    {l.changePercent === null ? '—' : `${l.changePercent > 0 ? '+' : ''}${l.changePercent}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <p className="text-muted text-small">
        Green means the movement is good news for the shop. More sales is green; more expenses is
        not, even though both went up.
      </p>
    </div>
  );
}

import { formatPaisa } from '../lib/format.js';

/**
 * Charts drawn as inline SVG.
 *
 * No charting library and no CDN, for two reasons: the shop's laptop is offline
 * so nothing can be fetched at runtime, and a chart of a dozen bars does not
 * justify shipping a graphics library into an app that must stay small and
 * auditable. These are a few dozen lines of arithmetic.
 *
 * Everything is drawn in a `viewBox` and scaled by CSS, so it stays sharp at
 * any window size without measuring the DOM.
 */

const PALETTE = ['#1a6b3c', '#8fc7a6', '#f0c674', '#d98b8b', '#7fa8d9', '#b6a2d3', '#c9a227'];

/** Rupees, shortened, for axis labels where space is tight. */
function shortMoney(paisa) {
  const rupees = Math.abs(paisa) / 100;
  if (rupees >= 100000) return `${(rupees / 100000).toFixed(1)}L`;
  if (rupees >= 1000) return `${Math.round(rupees / 1000)}k`;
  return String(Math.round(rupees));
}

/**
 * Grouped bars: one pair per period, sales beside profit.
 *
 * Profit can be negative, so the baseline is not always at the bottom — the
 * scale covers both directions and the zero line is drawn where it belongs.
 */
export function TrendChart({ data, height = 220 }) {
  if (!data || data.length === 0) {
    return <p className="text-muted">Nothing to chart in this period.</p>;
  }

  const width = Math.max(360, data.length * 64);
  const padTop = 16;
  const padBottom = 34;
  const padLeft = 46;
  const plotH = height - padTop - padBottom;
  const plotW = width - padLeft - 12;

  const values = data.flatMap((d) => [d.salesTotalPaisa, d.netProfitPaisa, 0]);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;

  const y = (v) => padTop + plotH - ((v - min) / span) * plotH;
  const zeroY = y(0);
  const slot = plotW / data.length;
  const barW = Math.min(20, slot / 3);

  return (
    <div className="chart-scroll">
      <svg viewBox={`0 0 ${width} ${height}`} className="chart" role="img" style={{ width, maxWidth: '100%' }}>
        {/* horizontal guides */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const value = min + span * t;
          return (
            <g key={t}>
              <line x1={padLeft} x2={width - 12} y1={y(value)} y2={y(value)} className="chart__grid" />
              <text x={padLeft - 6} y={y(value) + 3} textAnchor="end" className="chart__axis">
                {shortMoney(value)}
              </text>
            </g>
          );
        })}

        <line x1={padLeft} x2={width - 12} y1={zeroY} y2={zeroY} className="chart__zero" />

        {data.map((d, i) => {
          const cx = padLeft + slot * i + slot / 2;
          const salesTop = y(Math.max(0, d.salesTotalPaisa));
          const salesH = Math.abs(zeroY - y(d.salesTotalPaisa));
          const profitTop = y(Math.max(0, d.netProfitPaisa));
          const profitH = Math.abs(zeroY - y(d.netProfitPaisa));

          return (
            <g key={d.bucket}>
              <rect x={cx - barW - 2} y={salesTop} width={barW} height={Math.max(1, salesH)} rx="2" fill={PALETTE[0]}>
                <title>{`${d.label} — sales Rs ${formatPaisa(d.salesTotalPaisa)}`}</title>
              </rect>
              <rect
                x={cx + 2}
                y={profitTop}
                width={barW}
                height={Math.max(1, profitH)}
                rx="2"
                fill={d.netProfitPaisa < 0 ? '#a02020' : PALETTE[1]}
              >
                <title>{`${d.label} — net profit Rs ${formatPaisa(d.netProfitPaisa)}`}</title>
              </rect>
              <text x={cx} y={height - 14} textAnchor="middle" className="chart__axis">
                {d.label.length > 8 ? d.label.slice(5) : d.label}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="chart__legend">
        <span>
          <i style={{ background: PALETTE[0] }} /> Sales
        </span>
        <span>
          <i style={{ background: PALETTE[1] }} /> Net profit
        </span>
      </div>
    </div>
  );
}

/**
 * Share of a total, as a stacked strip plus a legend.
 *
 * A strip rather than a pie: with seven expense categories a pie becomes
 * unreadable slivers, and a shopkeeper only wants to know which one is biggest.
 */
export function ShareChart({ items, totalPaisa }) {
  if (!items || items.length === 0 || !totalPaisa) {
    return <p className="text-muted">Nothing to show.</p>;
  }

  let offset = 0;
  const segments = items.map((item, i) => {
    const pct = (item.valuePaisa / totalPaisa) * 100;
    const seg = { ...item, pct, offset, colour: PALETTE[i % PALETTE.length] };
    offset += pct;
    return seg;
  });

  return (
    <>
      <svg viewBox="0 0 100 8" className="sharebar" preserveAspectRatio="none" role="img">
        {segments.map((s) => (
          <rect key={s.label} x={s.offset} y="0" width={Math.max(0.4, s.pct)} height="8" fill={s.colour}>
            <title>{`${s.label} — Rs ${formatPaisa(s.valuePaisa)} (${s.pct.toFixed(1)}%)`}</title>
          </rect>
        ))}
      </svg>

      <table className="table" style={{ marginTop: 12 }}>
        <tbody>
          {segments.map((s) => (
            <tr key={s.label}>
              <td style={{ width: 24 }}>
                <i className="swatch" style={{ background: s.colour }} />
              </td>
              <td>{s.label}</td>
              <td className="num" style={{ width: 70 }}>
                {s.pct.toFixed(1)}%
              </td>
              <td className="num" style={{ width: 130 }}>
                {formatPaisa(s.valuePaisa)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

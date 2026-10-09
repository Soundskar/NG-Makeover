import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useI18n } from '../../i18n/i18n';
import { formatINR } from '../../lib/money';
import { compactINR, niceCeil } from '../../lib/periods';

// Hand-written charts for the Reports screen. Rules (dataviz method): thin marks
// (<= 24px), 2px surface gaps between touching fills, 4px rounded data ends,
// hairline solid grid, a legend for 2+ series, text in text colours (never the
// series colour), a tooltip on tap/hover/focus that never gates a value: every
// chart has a "See the numbers" table.

export interface Series {
  name: string;
  /** A CSS colour, normally var(--series-N) in fixed order. */
  color: string;
}

function useWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setW(Math.round(e!.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** A rectangle with only its top corners rounded (data end), square at the baseline. */
function topRounded(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

export function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return (
    <div className="legend">
      {series.map((s) => (
        <span key={s.name} className="legend-item"><i style={{ background: s.color }} />{s.name}</span>
      ))}
    </div>
  );
}

export interface Column {
  key: string;
  /** Under the column (may be blank to thin out crowded axes). */
  tick: string;
  /** Full name for the tooltip and table, e.g. "Mon, 6 Oct". */
  label: string;
  values: number[];
}

/**
 * Columns over time, stacked when there is more than one series. Money by
 * default; pass `format`/`axis` for counts.
 */
export function ColumnChart({ columns, series, height = 168, format = formatINR, axis = compactINR, title }: {
  columns: Column[];
  series: Series[];
  height?: number;
  format?: (n: number) => string;
  axis?: (n: number) => string;
  title: string;
}) {
  const { t } = useI18n();
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const totals = columns.map((c) => c.values.reduce((s, v) => s + v, 0));
  const top = niceCeil(Math.max(0, ...totals));
  const padL = 44;
  const padB = 24;
  const padT = 8;
  const plotW = Math.max(0, width - padL - 4);
  const plotH = height - padB - padT;
  const slot = columns.length ? plotW / columns.length : 0;
  const barW = Math.max(3, Math.min(24, slot - 2, slot * 0.72));
  const y = (v: number) => padT + plotH - (v / top) * plotH;
  const ticks = [0, top / 2, top];
  const a = active != null ? columns[active] : null;

  return (
    <figure className="chart" aria-label={title}>
      <Legend series={series} />
      <div className="chart-plot" ref={ref} onPointerLeave={() => setActive(null)}>
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label={title}>
            {ticks.map((v) => (
              <g key={v}>
                <line x1={padL} x2={width - 4} y1={y(v)} y2={y(v)} className="grid" />
                <text x={padL - 6} y={y(v)} dy="0.32em" textAnchor="end" className="axis-label">{axis(v)}</text>
              </g>
            ))}
            {columns.map((c, i) => {
              const cx = padL + slot * i + slot / 2;
              let base = y(0);
              const segs = c.values.map((v, si) => ({ v, si })).filter((s) => s.v > 0);
              return (
                <g key={c.key} className={active != null && active !== i ? 'dim' : undefined}>
                  {active === i && <rect x={padL + slot * i} y={padT} width={slot} height={plotH} className="hover-band" />}
                  {segs.map(({ v, si }, n) => {
                    const h = Math.max(1, (v / top) * plotH);
                    const gap = n > 0 ? 2 : 0; // surface gap between stacked segments
                    const yTop = base - h;
                    const isTop = n === segs.length - 1;
                    const d = isTop ? topRounded(cx - barW / 2, yTop, barW, h - gap, 4)
                      : `M${cx - barW / 2},${yTop}h${barW}v${h - gap}h${-barW}Z`;
                    base = yTop;
                    return <path key={si} d={d} fill={series[si]!.color} />;
                  })}
                  {c.tick && (
                    <text x={cx} y={height - 6} textAnchor="middle" className="axis-label">{c.tick}</text>
                  )}
                  {/* The hit area is the whole slot, much bigger than the bar. */}
                  <rect x={padL + slot * i} y={padT} width={slot} height={plotH + padB} fill="transparent"
                    tabIndex={0} role="button" aria-label={`${c.label}: ${format(totals[i]!)}`}
                    onPointerEnter={() => setActive(i)} onPointerDown={() => setActive(i)}
                    onFocus={() => setActive(i)} onBlur={() => setActive(null)} />
                </g>
              );
            })}
          </svg>
        )}
        {a && (
          <div className="chart-tip" style={{ left: Math.min(Math.max(padL + slot * active! + slot / 2, 70), width - 70) }}>
            <span className="tip-title">{a.label}</span>
            {series.length > 1 && <strong className="num">{format(totals[active!]!)}</strong>}
            {series.map((s, si) => (
              <span key={s.name} className="tip-row">
                <i style={{ background: s.color }} />
                <strong className="num">{format(a.values[si] ?? 0)}</strong>
                {series.length > 1 && <span className="muted">{s.name}</span>}
              </span>
            ))}
          </div>
        )}
      </div>
      <NumbersTable
        head={[t('rep_when'), ...(series.length > 1 ? series.map((s) => s.name) : []), t('total')]}
        rows={columns.filter((_, i) => totals[i]! > 0).map((c) => [
          c.label,
          ...(series.length > 1 ? c.values.map(format) : []),
          format(c.values.reduce((s, v) => s + v, 0)),
        ])}
      />
    </figure>
  );
}

/** "See the numbers": the table twin of a chart, so no value needs a hover. */
export function NumbersTable({ head, rows }: { head: string[]; rows: string[][] }) {
  const { t } = useI18n();
  if (!rows.length) return null;
  return (
    <details className="numbers">
      <summary>{t('rep_see_numbers')}</summary>
      <table>
        <thead><tr>{head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j} className="num">{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

/** Part of a whole as one bar (cash / UPI / card / udhaar), with a legend that carries the numbers. */
export function StackBar({ parts, format = formatINR }: {
  parts: { name: string; value: number; color: string }[];
  format?: (n: number) => string;
}) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  if (total === 0) return null;
  return (
    <div className="stack-bar-wrap">
      <div className="stack-bar" role="img" aria-label={parts.map((p) => `${p.name} ${format(p.value)}`).join(', ')}>
        {parts.filter((p) => p.value > 0).map((p) => (
          <span key={p.name} style={{ flexGrow: p.value, background: p.color }} title={`${p.name}: ${format(p.value)}`} />
        ))}
      </div>
      <div className="stack-legend">
        {parts.map((p) => (
          <div key={p.name} className="stack-legend-row">
            <i style={{ background: p.color }} />
            <span className="grow">{p.name}</span>
            <strong className="num">{format(p.value)}</strong>
            <span className="muted num pct">{Math.round((p.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Ranked rows with a thin bar each: one series, so one colour and no legend. */
export function BarList({ rows, color = 'var(--series-1)' }: {
  rows: { key: string; label: ReactNode; value: number; valueText: string; sub?: string }[];
  color?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ol className="bar-list">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="row-between" style={{ gap: 8 }}>
            <span className="grow bar-label">
              {r.label}{r.sub && <span className="muted small num"> · {r.sub}</span>}
            </span>
            <strong className="num">{r.valueText}</strong>
          </div>
          <div className="bar-row">
            <span className="bar-fill" style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: color }} />
          </div>
        </li>
      ))}
    </ol>
  );
}

/** "▲ 12% vs last week". Arrow + sign + words, so direction never relies on colour. */
export function Delta({ pct, vs, upIsGood = true }: { pct: number | null; vs: string; upIsGood?: boolean }) {
  // Nothing to compare with (the period before was empty): say nothing rather than "+∞%".
  if (pct == null) return null;
  const up = pct > 0;
  const tone = pct === 0 ? 'flat' : up === upIsGood ? 'good' : 'bad';
  return (
    <span className={`delta ${tone}`}>
      {pct !== 0 && (up ? <ArrowUpRight /> : <ArrowDownRight />)}
      <span className="num">{pct > 0 ? '+' : ''}{pct}%</span> <span className="vs">{vs}</span>
    </span>
  );
}

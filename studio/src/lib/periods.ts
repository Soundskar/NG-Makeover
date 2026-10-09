import { addDays, addMonths, daysBetween, monthEnd, monthStart, weekdayOf, type ISODate } from './dates';

export type PeriodKind = 'day' | 'week' | 'month';

export interface Period {
  kind: PeriodKind;
  from: ISODate;
  /** Last day counted: the period's end, or today if the period isn't over yet. */
  to: ISODate;
  /** The period's real last day (a week's Sunday, a month's last day). */
  end: ISODate;
  /** The same span just before, for "vs last week" comparisons. */
  prevFrom: ISODate;
  prevTo: ISODate;
  /** True once the whole period is in the past. */
  complete: boolean;
}

const min = (a: ISODate, b: ISODate) => (a < b ? a : b);

/**
 * The day, week (Monday to Sunday) or month containing `anchor`. A period still
 * running is compared with the same number of days of the one before, so
 * "this week so far" is never set against a whole week.
 */
export function periodOf(kind: PeriodKind, anchor: ISODate, today: ISODate): Period {
  if (kind === 'day') {
    const prev = addDays(anchor, -1);
    return { kind, from: anchor, to: anchor, end: anchor, prevFrom: prev, prevTo: prev, complete: anchor < today };
  }
  if (kind === 'week') {
    const from = addDays(anchor, -((weekdayOf(anchor) + 6) % 7));
    const end = addDays(from, 6);
    const to = min(end, today);
    const prevFrom = addDays(from, -7);
    return { kind, from, to, end, prevFrom, prevTo: addDays(prevFrom, daysBetween(from, to)), complete: end < today };
  }
  const from = monthStart(anchor);
  const end = monthEnd(anchor);
  const to = min(end, today);
  const prevFrom = addMonths(from, -1);
  const complete = end < today;
  // A finished month is compared with the whole month before; a running one with the same days.
  const prevTo = complete ? monthEnd(prevFrom) : min(addDays(prevFrom, daysBetween(from, to)), monthEnd(prevFrom));
  return { kind, from, to, end, prevFrom, prevTo, complete };
}

/** The anchor date of the period before (-1) or after (+1). */
export function shiftAnchor(p: Period, dir: -1 | 1): ISODate {
  if (p.kind === 'day') return addDays(p.from, dir);
  if (p.kind === 'week') return addDays(p.from, 7 * dir);
  return addMonths(p.from, dir);
}

/** Change from `prev` to `cur` as a whole percentage, or null when there's nothing to compare with. */
export function changePct(cur: number, prev: number): number | null {
  if (prev === 0) return null;
  return Math.round(((cur - prev) / prev) * 100);
}

/** Short Indian money for chart axes: ₹950, ₹12k, ₹1.2L. */
export function compactINR(n: number): string {
  const a = Math.abs(n);
  const trim = (x: number) => (x >= 10 ? Math.round(x).toString() : (Math.round(x * 10) / 10).toString());
  if (a >= 100_000) return `₹${trim(n / 100_000)}L`;
  if (a >= 1_000) return `₹${trim(n / 1_000)}k`;
  return `₹${Math.round(n)}`;
}

/** A round number at or above `max` for a chart's top gridline (1, 2, 2.5, 5 × 10ⁿ). */
export function niceCeil(max: number): number {
  if (max <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * pow >= max) return m * pow;
  return 10 * pow;
}

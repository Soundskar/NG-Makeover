// All business dates are calendar days in India (Asia/Kolkata), stored as
// 'YYYY-MM-DD' strings. Never use the phone's local timezone or UTC for "today".

export type ISODate = string;
export type Lang = 'en' | 'hi';

const IST = 'Asia/Kolkata';
const isoFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: IST, year: 'numeric', month: '2-digit', day: '2-digit',
});

export function todayIST(now: Date = new Date()): ISODate {
  return isoFmt.format(now);
}

function parts(iso: ISODate): [number, number, number] {
  const [y, m, d] = iso.split('-').map(Number);
  return [y!, m!, d!];
}

function toISO(y: number, m: number, d: number): ISODate {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function addDays(iso: ISODate, n: number): ISODate {
  const [y, m, d] = parts(iso);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return toISO(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** Same day n months later, clamped to the month's last day (31 Jan + 1 = 28/29 Feb). */
export function addMonths(iso: ISODate, n: number): ISODate {
  const [y, m, d] = parts(iso);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return toISO(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}

/** Course durations can be fractional (1.5 months = 1 month + 15 days). */
export function addMonthsFractional(iso: ISODate, months: number): ISODate {
  const whole = Math.floor(months);
  const extraDays = Math.round((months - whole) * 30);
  return addDays(addMonths(iso, whole), extraDays);
}

export function daysBetween(from: ISODate, to: ISODate): number {
  const [y1, m1, d1] = parts(from);
  const [y2, m2, d2] = parts(to);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/** 0 = Sunday … 6 = Saturday */
export function weekdayOf(iso: ISODate): number {
  const [y, m, d] = parts(iso);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** First day of the month the date falls in. */
export function monthStart(iso: ISODate): ISODate {
  const [y, m] = parts(iso);
  return toISO(y, m, 1);
}

/** Indian financial year label, April to March: 2026-10-08 → '26-27'. */
export function financialYear(iso: ISODate): string {
  const [y, m] = parts(iso);
  const start = m >= 4 ? y : y - 1;
  return `${String(start % 100).padStart(2, '0')}-${String((start + 1) % 100).padStart(2, '0')}`;
}

const locale = (lang: Lang) => (lang === 'hi' ? 'hi-IN' : 'en-IN');

export function formatDate(iso: ISODate, lang: Lang = 'en', withYear = true): string {
  const [y, m, d] = parts(iso);
  return new Intl.DateTimeFormat(locale(lang), {
    day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function formatWeekday(iso: ISODate, lang: Lang = 'en', style: 'long' | 'short' = 'long'): string {
  const [y, m, d] = parts(iso);
  return new Intl.DateTimeFormat(locale(lang), { weekday: style, timeZone: 'UTC' })
    .format(new Date(Date.UTC(y, m - 1, d)));
}

/** Short weekday name for 0 (Sun) … 6 (Sat). */
export function weekdayName(day: number, lang: Lang = 'en', style: 'long' | 'short' = 'short'): string {
  // 2026-10-04 is a Sunday.
  return formatWeekday(addDays('2026-10-04', day), lang, style);
}

/** '14:30:00' or '14:30' → '2:30 pm' */
export function formatTime(hhmm: string, lang: Lang = 'en'): string {
  const [h, m] = hhmm.split(':').map(Number);
  return new Intl.DateTimeFormat(locale(lang), { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })
    .format(new Date(Date.UTC(2000, 0, 1, h!, m!)));
}

/** Time of day in India for a stored timestamp. */
export function formatClock(ts: string, lang: Lang = 'en'): string {
  return new Intl.DateTimeFormat(locale(lang), { hour: 'numeric', minute: '2-digit', timeZone: IST })
    .format(new Date(ts));
}

export function formatDateTime(ts: string, lang: Lang = 'en'): string {
  return new Intl.DateTimeFormat(locale(lang), {
    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: IST,
  }).format(new Date(ts));
}

/** '2026-10-01' → 'October 2026' */
export function formatMonth(iso: ISODate, lang: Lang = 'en'): string {
  const [y, m] = parts(iso);
  return new Intl.DateTimeFormat(locale(lang), { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(y, m - 1, 1)));
}

/** Last day of the month the date falls in. */
export function monthEnd(iso: ISODate): ISODate {
  return addDays(addMonths(monthStart(iso), 1), -1);
}

import { weekdayOf, type ISODate } from './dates';

export interface Scheduled {
  id: string;
  slot_id: string | null;
  days_of_week: number[];
  start_date: ISODate;
  status: string;
}

/** Is this enrollment expected in class on `day`? (Holidays are checked separately.) */
export function isScheduledOn(e: Scheduled, day: ISODate): boolean {
  return e.status === 'active' && e.start_date <= day && e.days_of_week.includes(weekdayOf(day));
}

/**
 * How full a slot is for someone who would come on `days`: the busiest of
 * those weekdays decides, because a seat has to be free on every one of them.
 * `exceptId` leaves out the enrollment being edited.
 */
export function slotLoad(enrollments: Scheduled[], slotId: string, days: number[], exceptId?: string): number {
  const active = enrollments.filter((e) => e.status === 'active' && e.slot_id === slotId && e.id !== exceptId);
  let max = 0;
  for (const d of days) {
    const n = active.filter((e) => e.days_of_week.includes(d)).length;
    if (n > max) max = n;
  }
  return max;
}

/** Monday-first order for showing weekday chips (Indian calendars start on Monday). */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function defaultDays(weeklyOff: number | null): number[] {
  return WEEK_ORDER.filter((d) => d !== (weeklyOff ?? 0));
}

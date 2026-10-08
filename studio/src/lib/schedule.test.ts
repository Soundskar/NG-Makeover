import { describe, expect, it } from 'vitest';
import { defaultDays, isScheduledOn, slotLoad } from './schedule';

const e = (id: string, slot: string, days: number[], status = 'active', start = '2026-10-01') =>
  ({ id, slot_id: slot, days_of_week: days, start_date: start, status });

describe('schedule', () => {
  it('knows who is expected on a day', () => {
    // 2026-10-08 is a Thursday (4).
    expect(isScheduledOn(e('a', 's', [1, 3, 5]), '2026-10-08')).toBe(false);
    expect(isScheduledOn(e('a', 's', [2, 4]), '2026-10-08')).toBe(true);
    expect(isScheduledOn(e('a', 's', [4], 'paused'), '2026-10-08')).toBe(false);
    expect(isScheduledOn(e('a', 's', [4], 'active', '2026-10-09'), '2026-10-08')).toBe(false);
  });

  it('counts seats by the busiest chosen day', () => {
    const list = [
      e('a', 'morning', [1, 2, 3]),
      e('b', 'morning', [1, 3, 5]),
      e('c', 'morning', [2, 4]),
      e('d', 'evening', [1, 2, 3]),
      e('x', 'morning', [1], 'completed'),
    ];
    expect(slotLoad(list, 'morning', [1])).toBe(2);
    expect(slotLoad(list, 'morning', [2, 4])).toBe(2);
    expect(slotLoad(list, 'morning', [6])).toBe(0);
    expect(slotLoad(list, 'morning', [1, 3], 'a')).toBe(1);
  });

  it('defaults to every day except the weekly off', () => {
    expect(defaultDays(0)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(defaultDays(2)).toEqual([1, 3, 4, 5, 6, 0]);
  });
});

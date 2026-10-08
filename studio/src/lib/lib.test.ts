import { describe, expect, it } from 'vitest';
import {
  addDays, addMonths, addMonthsFractional, daysBetween, financialYear, todayIST, weekdayOf,
} from './dates';
import { allocatePayments, formatINR, makePlan, parseRupees, summarizeFees } from './money';
import { normalizePhone, waLink } from './whatsapp';

describe('dates', () => {
  it('uses India time for today, not UTC', () => {
    // 20:00 UTC on 7 Oct is 01:30 IST on 8 Oct.
    expect(todayIST(new Date('2026-10-07T20:00:00Z'))).toBe('2026-10-08');
    // 18:00 UTC on 7 Oct is 23:30 IST, still 7 Oct.
    expect(todayIST(new Date('2026-10-07T18:00:00Z'))).toBe('2026-10-07');
  });

  it('adds months and clamps to the end of short months', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
  });

  it('handles 1.5-month courses', () => {
    expect(addMonthsFractional('2026-10-08', 1.5)).toBe('2026-11-23');
    expect(addMonthsFractional('2026-10-08', 3)).toBe('2027-01-08');
  });

  it('counts days and weekdays', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(daysBetween('2026-10-01', '2026-10-08')).toBe(7);
    expect(weekdayOf('2026-10-08')).toBe(4); // Thursday
  });

  it('labels the Indian financial year (April to March)', () => {
    expect(financialYear('2026-10-08')).toBe('26-27');
    expect(financialYear('2027-03-31')).toBe('26-27');
    expect(financialYear('2027-04-01')).toBe('27-28');
  });
});

describe('money', () => {
  it('formats in the Indian style', () => {
    expect(formatINR(125000)).toBe('₹1,25,000');
    expect(formatINR(950)).toBe('₹950');
    expect(formatINR(-100)).toBe('−₹100');
  });

  it('reads typed amounts', () => {
    expect(parseRupees('1,250')).toBe(1250);
    expect(parseRupees('₹ 30000')).toBe(30000);
    expect(parseRupees('')).toBeNull();
    expect(parseRupees('12a')).toBeNull();
  });

  const plan = [
    { id: 'a', due_date: '2026-10-01', amount: 10000 },
    { id: 'b', due_date: '2026-11-01', amount: 10000 },
    { id: 'c', due_date: '2026-12-01', amount: 10000 },
  ];

  it('applies payments oldest installment first', () => {
    const s = allocatePayments(plan, 15000, '2026-10-20');
    expect(s.map((i) => [i.status, i.paid])).toEqual([
      ['paid', 10000], ['partial', 5000], ['upcoming', 0],
    ]);
  });

  it('marks unpaid installments past their date as overdue', () => {
    const s = allocatePayments(plan, 15000, '2026-11-02');
    expect(s[1]).toMatchObject({ status: 'overdue', remaining: 5000 });
    // Due today is not overdue yet.
    expect(allocatePayments(plan, 10000, '2026-11-01')[1]!.status).toBe('upcoming');
  });

  it('summarizes fees and ignores voided payments', () => {
    const f = summarizeFees(30000, plan, [
      { amount: 10000 }, { amount: 5000, voided: true }, { amount: 2000 },
    ], '2026-11-05');
    expect(f.paid).toBe(12000);
    expect(f.balance).toBe(18000);
    expect(f.overdueAmount).toBe(8000);
    expect(f.status).toBe('overdue');
    expect(f.nextDue).toEqual({ date: '2026-12-01', amount: 10000 });
  });

  it('is clear when everything is paid, even with overpayment', () => {
    const f = summarizeFees(30000, plan, [{ amount: 31000 }], '2027-01-01');
    expect(f.status).toBe('clear');
    expect(f.balance).toBe(0);
    expect(f.nextDue).toBeNull();
  });

  it('makes plans that add up exactly, in round amounts', () => {
    const p = makePlan(30000, 3, '2026-10-08');
    expect(p.map((x) => x.amount)).toEqual([10000, 10000, 10000]);
    expect(p.map((x) => x.due_date)).toEqual(['2026-10-08', '2026-11-08', '2026-12-08']);
    const odd = makePlan(25000, 3, '2026-10-08');
    expect(odd.map((x) => x.amount)).toEqual([8400, 8300, 8300]);
    expect(odd.reduce((s, x) => s + x.amount, 0)).toBe(25000);
  });
});

describe('whatsapp', () => {
  it('normalizes Indian mobile numbers', () => {
    expect(normalizePhone('+91 98765-43210')).toBe('9876543210');
    expect(normalizePhone('09876543210')).toBe('9876543210');
    expect(normalizePhone('919876543210')).toBe('9876543210');
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('5876543210')).toBeNull();
  });

  it('builds wa.me links with the message encoded', () => {
    expect(waLink('98765 43210', 'Hi & thanks')).toBe('https://wa.me/919876543210?text=Hi%20%26%20thanks');
    expect(waLink('bad', 'x')).toBeNull();
  });
});

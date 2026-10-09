import { describe, expect, it } from 'vitest';
import {
  addDays, addMonths, addMonthsFractional, daysBetween, financialYear, todayIST, weekdayOf,
} from './dates';
import { allocatePayments, discountFrom, formatINR, makePlan, parseRupees, payParts, summarizeFees } from './money';
import { changePct, compactINR, niceCeil, periodOf, shiftAnchor } from './periods';
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

describe('salon bill', () => {
  it('turns a discount in rupees or percent into whole rupees within the bill', () => {
    expect(discountFrom(350, 'percent', 10)).toBe(35);
    expect(discountFrom(333, 'percent', 15)).toBe(50);
    expect(discountFrom(400, 'amount', 55)).toBe(55);
    expect(discountFrom(400, 'amount', 900)).toBe(400);
    expect(discountFrom(400, 'percent', 150)).toBe(400);
    expect(discountFrom(400, 'amount', null)).toBe(0);
    expect(discountFrom(0, 'percent', 10)).toBe(0);
  });

  it('puts the whole total on one payment mode, or takes the split as typed', () => {
    expect(payParts('udhaar', 500, {})).toEqual({ cash: 0, upi: 0, card: 0, udhaar: 500 });
    expect(payParts('upi', 500, { cash: 100 })).toEqual({ cash: 0, upi: 500, card: 0, udhaar: 0 });
    expect(payParts('split', 500, { cash: 200, udhaar: 300 })).toEqual({ cash: 200, upi: 0, card: 0, udhaar: 300 });
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

describe('report periods', () => {
  it('weeks run Monday to Sunday, and a running week is compared with the same days last week', () => {
    // 2026-10-09 is a Friday.
    const w = periodOf('week', '2026-10-09', '2026-10-09');
    expect([w.from, w.to, w.end, w.prevFrom, w.prevTo, w.complete]).toEqual(
      ['2026-10-05', '2026-10-09', '2026-10-11', '2026-09-28', '2026-10-02', false]);
    const past = periodOf('week', '2026-09-30', '2026-10-09');
    expect([past.from, past.to, past.prevFrom, past.prevTo, past.complete]).toEqual(
      ['2026-09-28', '2026-10-04', '2026-09-21', '2026-09-27', true]);
  });

  it('months compare the same days while running, and the whole month once finished', () => {
    const m = periodOf('month', '2026-10-09', '2026-10-09');
    expect([m.from, m.to, m.prevFrom, m.prevTo]).toEqual(['2026-10-01', '2026-10-09', '2026-09-01', '2026-09-09']);
    const done = periodOf('month', '2026-09-15', '2026-10-09');
    expect([done.from, done.to, done.prevFrom, done.prevTo]).toEqual(['2026-09-01', '2026-09-30', '2026-08-01', '2026-08-31']);
    // 31 March running to its end is compared with all of February, not past it.
    const mar = periodOf('month', '2027-03-31', '2027-03-31');
    expect([mar.prevFrom, mar.prevTo]).toEqual(['2027-02-01', '2027-02-28']);
  });

  it('a day is compared with the day before; shifting moves by a whole period', () => {
    const d = periodOf('day', '2026-10-09', '2026-10-09');
    expect([d.prevFrom, d.prevTo]).toEqual(['2026-10-08', '2026-10-08']);
    expect(shiftAnchor(periodOf('month', '2026-10-09', '2026-10-09'), -1)).toBe('2026-09-01');
    expect(shiftAnchor(periodOf('week', '2026-10-09', '2026-10-09'), -1)).toBe('2026-09-28');
  });

  it('formats axis money the Indian way and rounds chart tops', () => {
    expect([compactINR(950), compactINR(12_400), compactINR(125_000), compactINR(1_500)]).toEqual(['₹950', '₹12k', '₹1.3L', '₹1.5k']);
    expect([niceCeil(0), niceCeil(3_400), niceCeil(9_400), niceCeil(18_000)]).toEqual([1, 5_000, 10_000, 20_000]);
    expect([changePct(120, 100), changePct(80, 100), changePct(5, 0)]).toEqual([20, -20, null]);
  });
});

import { addMonths, type ISODate } from './dates';

// Money is whole rupees everywhere (integers). No paise.

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/** 125000 → '₹1,25,000' */
export function formatINR(n: number): string {
  const sign = n < 0 ? '−' : '';
  return `${sign}₹${inr.format(Math.abs(Math.round(n)))}`;
}

/** Reads what someone typed ('1,250', '₹ 1250', '1250.00') as whole rupees. Empty or invalid → null. */
export function parseRupees(input: string): number | null {
  const cleaned = input.replace(/[₹,\s]/g, '');
  if (cleaned === '') return null;
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned));
}

export function sum(ns: number[]): number {
  return ns.reduce((s, n) => s + n, 0);
}

export interface Installment {
  id: string;
  due_date: ISODate;
  amount: number;
  label?: string | null;
}

export type InstallmentStatus = 'paid' | 'partial' | 'upcoming' | 'overdue';

export interface InstallmentState extends Installment {
  paid: number;
  remaining: number;
  status: InstallmentStatus;
}

/**
 * Applies the total paid to installments oldest-first. An installment is
 * overdue once its due date has passed (before today) and money is still owed.
 */
export function allocatePayments(installments: Installment[], totalPaid: number, today: ISODate): InstallmentState[] {
  const sorted = [...installments].sort((a, b) => a.due_date.localeCompare(b.due_date));
  let left = Math.max(0, totalPaid);
  return sorted.map((inst) => {
    const paid = Math.min(left, inst.amount);
    left -= paid;
    const remaining = inst.amount - paid;
    let status: InstallmentStatus;
    if (remaining === 0) status = 'paid';
    else if (inst.due_date < today) status = 'overdue';
    else if (paid > 0) status = 'partial';
    else status = 'upcoming';
    return { ...inst, paid, remaining, status };
  });
}

export interface FeeSummary {
  agreedFee: number;
  paid: number;
  balance: number;
  overdueAmount: number;
  nextDue: { date: ISODate; amount: number } | null;
  status: 'clear' | 'overdue' | 'due';
  installments: InstallmentState[];
}

export function summarizeFees(
  agreedFee: number,
  installments: Installment[],
  payments: { amount: number; voided?: boolean | null }[],
  today: ISODate,
): FeeSummary {
  const paid = sum(payments.filter((p) => !p.voided).map((p) => p.amount));
  const states = allocatePayments(installments, paid, today);
  const overdueAmount = sum(states.filter((s) => s.status === 'overdue').map((s) => s.remaining));
  const next = states.find((s) => s.remaining > 0 && s.status !== 'overdue');
  const balance = Math.max(0, agreedFee - paid);
  return {
    agreedFee,
    paid,
    balance,
    overdueAmount,
    nextDue: next ? { date: next.due_date, amount: next.remaining } : null,
    status: balance === 0 ? 'clear' : overdueAmount > 0 ? 'overdue' : 'due',
    installments: states,
  };
}

/**
 * Builds a starting installment plan: `parts` monthly payments from
 * `firstDate`, rounded down to ₹100 so amounts look natural. Rounding leftovers
 * go on the first payment so the plan always adds up exactly to `total`.
 * Mom edits the rows afterwards if she wants different amounts or dates.
 */
export function makePlan(total: number, parts: number, firstDate: ISODate): { due_date: ISODate; amount: number }[] {
  if (parts < 1 || total <= 0) return [];
  const base = Math.floor(total / parts / 100) * 100;
  const first = total - base * (parts - 1);
  return Array.from({ length: parts }, (_, i) => ({
    due_date: addMonths(firstDate, i),
    amount: i === 0 ? first : base,
  }));
}

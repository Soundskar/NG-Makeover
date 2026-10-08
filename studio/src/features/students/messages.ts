import type { TFn } from '../../i18n/i18n';
import { formatDate } from '../../lib/dates';
import { formatINR, type FeeSummary } from '../../lib/money';
import type { Lang, Payment } from '../../lib/types';

/** WhatsApp text receipt sent after recording a fee payment. */
export function receiptMessage(o: {
  t: TFn; lang: Lang; studio: string; student: string; course: string; payment: Payment; fees: FeeSummary;
}): string {
  const { t, lang } = o;
  const lines = [
    o.studio,
    t('msg_receipt_no', { no: o.payment.receipt_no ?? '' }),
    t('msg_receipt_body', {
      amount: formatINR(o.payment.amount),
      name: o.student,
      course: o.course,
      date: formatDate(o.payment.paid_on, lang),
      mode: t(o.payment.mode),
    }),
    t('msg_receipt_paid', { paid: formatINR(o.fees.paid), fee: formatINR(o.fees.agreedFee) }),
    o.fees.balance > 0 ? t('msg_receipt_balance', { amount: formatINR(o.fees.balance) }) : t('msg_receipt_clear'),
  ];
  const late = o.fees.installments.find((i) => i.status === 'overdue');
  if (late) {
    lines.push(t('msg_receipt_overdue', { amount: formatINR(o.fees.overdueAmount), date: formatDate(late.due_date, lang) }));
  }
  if (o.fees.nextDue) {
    lines.push(t('msg_receipt_next', { amount: formatINR(o.fees.nextDue.amount), date: formatDate(o.fees.nextDue.date, lang) }));
  }
  lines.push(t('msg_thanks'));
  return lines.join('\n');
}

/** Polite reminder for an overdue or upcoming installment. */
export function reminderMessage(o: {
  t: TFn; lang: Lang; studio: string; student: string; course: string; amount: number; date: string; overdue: boolean;
}): string {
  const first = o.student.split(' ')[0] ?? o.student;
  return o.t(o.overdue ? 'msg_remind_overdue' : 'msg_remind_upcoming', {
    name: first,
    studio: o.studio,
    course: o.course,
    amount: formatINR(o.amount),
    date: formatDate(o.date, o.lang),
  });
}

/** Check-in after a student has missed classes. */
export function absenceMessage(o: { t: TFn; studio: string; student: string }): string {
  const first = o.student.split(' ')[0] ?? o.student;
  return o.t('msg_absent', { name: first, studio: o.studio });
}

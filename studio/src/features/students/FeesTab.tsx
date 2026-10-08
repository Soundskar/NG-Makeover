import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ban, Bell, Check, ChevronRight, Pencil, Plus, Receipt } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Choices, Confirm, ErrorBox, Field, Money, MoneyInput, Sheet, SheetCloseButton, useToast } from '../../components/ui';
import { useI18n } from '../../i18n/i18n';
import { formatDate, todayIST } from '../../lib/dates';
import { formatINR, summarizeFees } from '../../lib/money';
import { must, supabase } from '../../lib/supabase';
import { nameOf, type Course, type Enrollment, type Payment, type PayMode } from '../../lib/types';
import { waLink } from '../../lib/whatsapp';
import { payModeOptions } from './AdmissionPage';
import { useSettings, type StudentFull } from './data';
import { receiptMessage, reminderMessage } from './messages';
import { PlanEditor, planIsValid, toRows, type PlanRow } from './PlanEditor';

const statusBadge = { paid: 'badge-success', partial: 'badge-warning', upcoming: 'badge-neutral', overdue: 'badge-danger' } as const;

export function FeesTab({ data, enrollment, course, receiptFor }: {
  data: StudentFull; enrollment: Enrollment; course: Course | null; receiptFor: string | null;
}) {
  const { t, lang } = useI18n();
  const settings = useSettings();
  const today = todayIST();
  const fee = data.fees.find((f) => f.enrollment_id === enrollment.id);
  const installments = data.installments.filter((i) => i.enrollment_id === enrollment.id);
  const payments = data.payments.filter((p) => p.enrollment_id === enrollment.id);
  const summary = summarizeFees(fee?.agreed_fee ?? 0, installments, payments, today);

  const [recordOpen, setRecordOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [receipt, setReceipt] = useState<Payment | null>(null);
  const [voiding, setVoiding] = useState<Payment | null>(null);
  const [picked, setPicked] = useState<Payment | null>(null);

  // Straight after an admission with a first payment, offer its receipt.
  useEffect(() => {
    if (receiptFor) {
      const p = data.payments.find((x) => x.id === receiptFor);
      if (p) setReceipt(p);
      window.history.replaceState({}, '');
    }
  }, [receiptFor, data.payments]);

  if (!fee) return null;
  const studio = settings.data?.settings.studio_name ?? 'Namita Garg Makeover';
  const courseName = course ? nameOf(course, lang) : '';
  const phone = data.student.whatsapp ?? data.student.phone;
  const pct = summary.agreedFee ? Math.min(100, Math.round((summary.paid / summary.agreedFee) * 100)) : 100;

  const remindTarget = summary.overdueAmount > 0
    ? { amount: summary.overdueAmount, date: summary.installments.find((i) => i.status === 'overdue')!.due_date, overdue: true }
    : summary.nextDue ? { ...summary.nextDue, overdue: false } : null;
  const remindLink = remindTarget && phone
    ? waLink(phone, reminderMessage({ t, lang, studio, student: data.student.full_name, course: courseName, ...remindTarget }))
    : null;

  return (
    <div className="stack-lg">
      <div className="card stack" style={{ gap: 8 }}>
        <div className="row-between">
          <span className="stat-label">{t('fee_paid')}</span>
          <span className={`badge ${summary.status === 'clear' ? 'badge-success' : summary.status === 'overdue' ? 'badge-danger' : 'badge-warning'}`}>
            {t(`fee_status_${summary.status}`)}
          </span>
        </div>
        <div className="num"><Money n={summary.paid} className="stat-value" animate /> <span className="muted">/ {formatINR(summary.agreedFee)}</span></div>
        <div className={`bar ${summary.status === 'clear' ? 'success' : ''}`}><span style={{ width: `${pct}%` }} /></div>
        {summary.balance > 0 && <div className="stat-sub">{t('fee_balance_amt', { amount: formatINR(summary.balance) })}</div>}
        {summary.overdueAmount > 0 && (
          <div className="notice notice-danger">{t('fee_overdue_amt', { amount: formatINR(summary.overdueAmount) })}</div>
        )}
        {summary.nextDue && (
          <div className="stat-sub">{t('fee_next', { amount: formatINR(summary.nextDue.amount), date: formatDate(summary.nextDue.date, lang) })}</div>
        )}
        {fee.list_fee !== fee.agreed_fee && (
          <div className="small muted">{t('discount_amt', { amount: formatINR(fee.list_fee - fee.agreed_fee) })}{fee.discount_note ? ` · ${fee.discount_note}` : ''}</div>
        )}
        {fee.kit_included && <div className="small muted">{t('kit_included')}</div>}
      </div>

      <div className="stack">
        {summary.balance > 0 && (
          <button className="btn btn-primary btn-lg btn-block" onClick={() => setRecordOpen(true)}><Plus /> {t('record_payment')}</button>
        )}
        {remindLink && (
          <a className="btn btn-whatsapp btn-block" href={remindLink} target="_blank" rel="noopener"><Bell /> {t('remind_whatsapp')}</a>
        )}
      </div>

      <section className="stack">
        <div className="row-between">
          <h2 className="section-title">{t('installments')}</h2>
          <button className="btn btn-sm btn-soft" onClick={() => setPlanOpen(true)}><Pencil /> {t('edit_plan')}</button>
        </div>
        <div className="list">
          {summary.installments.map((i, n) => (
            <div key={i.id} className="list-item">
              <span className="grow">
                <span className="title" style={{ display: 'block' }}>{i.label || t('installment_n', { n: n + 1 })}</span>
                <span className="sub">
                  {formatDate(i.due_date, lang)}
                  {i.paid > 0 && i.remaining > 0 ? ` · ${t('inst_paid_left', { paid: formatINR(i.paid), left: formatINR(i.remaining) })}` : ''}
                </span>
              </span>
              <span className="end stack" style={{ gap: 2, alignItems: 'flex-end' }}>
                <Money n={i.amount} className="title" />
                <span className={`badge ${statusBadge[i.status]}`}>{t(`inst_${i.status}`)}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="stack">
        <h2 className="section-title">{t('payments')}</h2>
        {payments.length === 0 ? <p className="muted">{t('payments_none')}</p> : (
          <div className="list">
            {payments.map((p) => {
              const body = (
                <span className="grow">
                  <span className="title" style={{ display: 'block', textDecoration: p.voided ? 'line-through' : undefined }}>
                    <Money n={p.amount} /> · {t(p.mode)}
                  </span>
                  <span className="sub num" style={{ display: 'block' }}>{formatDate(p.paid_on, lang)} · {p.receipt_no}</span>
                  {p.voided && <span className="badge badge-danger">{t('payment_cancelled')}: {p.void_reason}</span>}
                </span>
              );
              return p.voided ? (
                <div key={p.id} className="list-item" style={{ opacity: 0.6 }}>{body}</div>
              ) : (
                <button key={p.id} className="list-item" aria-label={`${t('payment_options')}: ${formatINR(p.amount)}`} onClick={() => setPicked(p)}>
                  <span className="avatar" data-tint="5" style={{ width: 40, height: 40 }}><Receipt size={20} /></span>
                  {body}
                  <ChevronRight className="chev" />
                </button>
              );
            })}
          </div>
        )}
      </section>

      {recordOpen && (
        <RecordPaymentSheet
          enrollmentId={enrollment.id}
          suggested={summary.overdueAmount || summary.nextDue?.amount || summary.balance}
          max={summary.balance}
          onClose={() => setRecordOpen(false)}
          onSaved={(p) => { setRecordOpen(false); setReceipt(p); }}
        />
      )}
      {planOpen && (
        <PlanSheet enrollment={enrollment} fee={fee.agreed_fee} discountNote={fee.discount_note ?? ''}
          installments={installments} paid={summary.paid} onClose={() => setPlanOpen(false)} />
      )}
      {receipt && (
        <ReceiptSheet payment={receipt} phone={phone} onClose={() => setReceipt(null)}
          text={receiptMessage({
            t, lang, studio, student: data.student.full_name, course: courseName, payment: receipt,
            // The summary must include this payment even if the list hasn't refreshed yet.
            fees: payments.some((p) => p.id === receipt.id) ? summary
              : summarizeFees(fee.agreed_fee, installments, [...payments, receipt], today),
          })} />
      )}
      {voiding && <VoidPaymentSheet payment={voiding} onClose={() => setVoiding(null)} />}
      {picked && (
        <Sheet open onClose={() => setPicked(null)} title={`${formatINR(picked.amount)} · ${t(picked.mode)}`}>
          <div className="stack">
            <p className="muted num">{formatDate(picked.paid_on, lang)} · {picked.receipt_no}{picked.note ? ` · ${picked.note}` : ''}</p>
            <button className="btn btn-whatsapp btn-lg btn-block" onClick={() => { setReceipt(picked); setPicked(null); }}>
              <Receipt /> {t('receipt_show')}
            </button>
            <button className="btn btn-danger btn-block" onClick={() => { setVoiding(picked); setPicked(null); }}>
              <Ban /> {t('cancel_payment')}
            </button>
            <SheetCloseButton label={t('close')} />
          </div>
        </Sheet>
      )}
    </div>
  );
}

function RecordPaymentSheet({ enrollmentId, suggested, max, onClose, onSaved }: {
  enrollmentId: string; suggested: number; max: number; onClose: () => void; onSaved: (p: Payment) => void;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [amount, setAmount] = useState<number | null>(suggested || null);
  const [date, setDate] = useState(todayIST());
  const [mode, setMode] = useState<PayMode>('cash');
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState(false);
  const m = useMutation({
    mutationFn: async () => must(await supabase.from('payments')
      .insert({ enrollment_id: enrollmentId, amount, paid_on: date, mode, note: note.trim() || null })
      .select().single()) as Payment,
    onSuccess: (p) => {
      for (const k of ['student', 'fee-status', 'home']) qc.invalidateQueries({ queryKey: [k] });
      toast({ kind: 'success', text: t('payment_saved', { amount: formatINR(p.amount) }) });
      onSaved(p);
    },
  });
  const over = amount != null && amount > max;
  return (
    <Sheet open onClose={onClose} title={t('record_payment')}>
      <div className="stack">
        <Field label={t('amount')} htmlFor="ra" error={over ? t('payment_over', { amount: formatINR(max) }) : null}>
          <MoneyInput id="ra" value={amount} onChange={setAmount} invalid={over} autoFocus />
        </Field>
        <Field label={t('mode')}>
          <Choices<PayMode> label={t('mode')} value={mode} onChange={setMode} options={payModeOptions(t)} />
        </Field>
        <Field label={t('paid_on')} htmlFor="rd">
          <input id="rd" type="date" className="input" value={date} max={todayIST()} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={`${t('note')} (${t('optional')})`} htmlFor="rn">
          <input id="rn" className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {m.error && <ErrorBox error={m.error} />}
        <button className="btn btn-primary btn-lg btn-block" disabled={!amount || over || m.isPending} aria-busy={m.isPending} onClick={() => setConfirm(true)}>
          <Check /> {t('save')}
        </button>
      </div>
      <Confirm open={confirm} onClose={() => setConfirm(false)} busy={m.isPending}
        title={t('payment_confirm', { amount: formatINR(amount ?? 0), mode: t(mode) })}
        confirmLabel={t('payment_confirm_yes')}
        onConfirm={() => { setConfirm(false); m.mutate(); }} />
    </Sheet>
  );
}

function ReceiptSheet({ payment, phone, text, onClose }: {
  payment: Payment; phone: string | null; text: string; onClose: () => void;
}) {
  const { t } = useI18n();
  const link = phone ? waLink(phone, text) : null;
  return (
    <Sheet open onClose={onClose} title={t('receipt_title', { no: payment.receipt_no ?? '' })}>
      <div className="stack">
        <pre className="card small" style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{text}</pre>
        {link ? (
          <a className="btn btn-whatsapp btn-lg btn-block" href={link} target="_blank" rel="noopener" onClick={onClose}>
            <Receipt /> {t('send_receipt')}
          </a>
        ) : <p className="muted">{t('no_phone')}</p>}
        <SheetCloseButton label={t('close')} />
      </div>
    </Sheet>
  );
}

function VoidPaymentSheet({ payment, onClose }: { payment: Payment; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [reason, setReason] = useState('');
  const m = useMutation({
    mutationFn: async () => must(await supabase.from('payments')
      .update({ voided: true, void_reason: reason.trim() }).eq('id', payment.id).select().single()),
    onSuccess: () => {
      for (const k of ['student', 'fee-status', 'home']) qc.invalidateQueries({ queryKey: [k] });
      toast({ kind: 'info', text: t('payment_cancelled_done') });
      onClose();
    },
  });
  return (
    <Sheet open onClose={onClose} title={t('cancel_payment')}>
      <div className="stack">
        <p className="muted">{t('cancel_payment_body', { amount: formatINR(payment.amount), no: payment.receipt_no ?? '' })}</p>
        <Field label={t('entry_cancel_reason')} htmlFor="vr">
          <input id="vr" className="input" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
        </Field>
        {m.error && <ErrorBox error={m.error} />}
        <button className="btn btn-danger btn-lg btn-block" disabled={!reason.trim() || m.isPending} aria-busy={m.isPending} onClick={() => m.mutate()}>
          <Ban /> {t('cancel_payment')}
        </button>
      </div>
    </Sheet>
  );
}

function PlanSheet({ enrollment, fee, discountNote, installments, paid, onClose }: {
  enrollment: Enrollment; fee: number; discountNote: string;
  installments: { due_date: string; amount: number }[]; paid: number; onClose: () => void;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [agreed, setAgreed] = useState<number | null>(fee);
  const [note, setNote] = useState(discountNote);
  const [rows, setRows] = useState<PlanRow[]>(() => toRows(installments));
  const toast = useToast();
  const m = useMutation({
    mutationFn: async () => must(await supabase.rpc('update_fee_plan', {
      p_enrollment: enrollment.id, p_agreed_fee: agreed, p_discount_note: note,
      p_installments: rows.map((r) => ({ due_date: r.due_date, amount: r.amount })),
    })),
    onSuccess: () => {
      for (const k of ['student', 'fee-status', 'home']) qc.invalidateQueries({ queryKey: [k] });
      toast({ kind: 'success', text: t('plan_saved') });
      onClose();
    },
  });
  return (
    <Sheet open onClose={onClose} title={t('edit_plan')}>
      <div className="stack">
        <Field label={t('agreed_fee')} htmlFor="pf" hint={t('paid_so_far', { amount: formatINR(paid) })}>
          <MoneyInput id="pf" value={agreed} onChange={setAgreed} />
        </Field>
        <Field label={t('discount_note')} htmlFor="pn">
          <input id="pn" className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <PlanEditor total={agreed ?? 0} rows={rows} onChange={setRows} firstDate={enrollment.start_date} />
        {m.error && <ErrorBox error={m.error} />}
        <button className="btn btn-primary btn-lg btn-block" disabled={agreed == null || !planIsValid(rows, agreed) || m.isPending} aria-busy={m.isPending}
          onClick={() => m.mutate()}>
          <Check /> {t('save')}
        </button>
      </div>
    </Sheet>
  );
}

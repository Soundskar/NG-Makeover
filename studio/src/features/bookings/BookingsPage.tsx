import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Ban, BellRing, CalendarPlus, CalendarX2, Check, ChevronLeft, ChevronRight, IndianRupee, MoreHorizontal, Pencil, Play, UserX,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMe, useTeamNames } from '../../auth/auth';
import {
  Choices, Confirm, Empty, ErrorBox, Field, Loaded, MoneyInput, Page, Sheet, SheetCloseButton, TopBar, useToast,
} from '../../components/ui';
import { errorText, useI18n } from '../../i18n/i18n';
import { addDays, formatClock, formatDate, formatTime, formatWeekday, todayIST } from '../../lib/dates';
import { haptic } from '../../lib/haptics';
import { formatINR } from '../../lib/money';
import { must, supabase } from '../../lib/supabase';
import type { Advance, Booking, PayMode } from '../../lib/types';
import { waLink } from '../../lib/whatsapp';
import { payModeOptions } from '../students/AdmissionPage';
import { useSettings } from '../students/data';
import { bookingMessage } from '../clients/data';
import { advancePaid, useBookings } from './data';

const STRIP = 14;

/** Bookings by day: today first, a two-week strip to look ahead, and reminders for tomorrow. */
export default function BookingsPage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const today = todayIST();
  const [params, setParams] = useSearchParams();
  const day = params.get('d') ?? today;
  const start = params.get('s') ?? (day < today ? day : today);
  const end = addDays(start, STRIP - 1);
  const q = useBookings(start, end < addDays(day, 1) ? addDays(day, 1) : end);
  const [actionsFor, setActionsFor] = useState<Booking | null>(null);
  const select = (d: string, s = start) => setParams({ d, s }, { replace: true });
  const tomorrow = addDays(today, 1);

  return (
    <>
      <TopBar title={t('bookings_title')} actions={
        <Link className="icon-btn" to={`/bookings/new?d=${day < today ? today : day}`} aria-label={t('booking_new')}><CalendarPlus /></Link>
      } />
      <Page>
        {/* Two weeks at a glance; dots show how many bookings each day has. */}
        <div className="row" style={{ gap: 4 }}>
          <button className="icon-btn" aria-label={t('rep_prev')} onClick={() => select(addDays(day, -7), addDays(start, -7))}><ChevronLeft /></button>
          <div className="date-strip grow" role="tablist" aria-label={t('bookings_title')}>
            {Array.from({ length: STRIP }, (_, i) => addDays(start, i)).map((d) => {
              const n = (q.data?.bookings ?? []).filter((b) => b.day === d && b.status === 'booked').length;
              return (
                <button key={d} role="tab" aria-selected={d === day} className={`date-chip${d === today ? ' today' : ''}`} onClick={() => select(d)}>
                  <span className="dc-wd">{formatWeekday(d, lang, 'short')}</span>
                  <span className="dc-d num">{Number(d.slice(8))}</span>
                  <span className="dc-n">{n > 0 ? '•'.repeat(Math.min(n, 3)) : ' '}</span>
                </button>
              );
            })}
          </div>
          <button className="icon-btn" aria-label={t('rep_next')} onClick={() => select(addDays(day, 7), addDays(start, 7))}><ChevronRight /></button>
        </div>

        <Loaded q={q} skeleton="cards">
          {({ bookings, advances }) => {
            const list = bookings.filter((b) => b.day === day);
            const booked = list.filter((b) => b.status === 'booked');
            const toRemind = bookings.filter((b) => b.day === tomorrow && b.status === 'booked' && !b.reminded_on);
            return (
              <>
                <div className="row-between">
                  <span>
                    <strong style={{ display: 'block' }}>{day === today ? t('today') : day === tomorrow ? t('tomorrow') : formatWeekday(day, lang)}</strong>
                    <span className="muted small">{formatDate(day, lang)}</span>
                  </span>
                  <span className="badge badge-primary num">{t('bookings_n', { n: booked.length })}</span>
                </div>

                {day === today && toRemind.length > 0 && (
                  <button className="notice notice-info" style={{ border: 0, textAlign: 'left', width: '100%' }} onClick={() => select(tomorrow)}>
                    <BellRing /><span className="grow">{t('bookings_remind_tomorrow', { n: toRemind.length })}</span><ChevronRight />
                  </button>
                )}

                {list.length === 0 ? (
                  <div className="stack">
                    <Empty icon={<CalendarX2 />} title={t('bookings_none')} />
                    {day >= today && (
                      <Link to={`/bookings/new?d=${day}`} className="btn btn-primary btn-lg btn-block"><CalendarPlus /> {t('booking_new')}</Link>
                    )}
                  </div>
                ) : (
                  <div className="stack stagger">
                    {list.map((b) => (
                      <BookingCard key={b.id} b={b} advance={advancePaid(advances, b.id)}
                        onStart={() => navigate(`/salon/new?booking=${b.id}`)} onMore={() => setActionsFor(b)} />
                    ))}
                  </div>
                )}

                {actionsFor && (
                  <BookingActions b={actionsFor} advances={advances.filter((a) => a.appointment_id === actionsFor.id)}
                    onClose={() => setActionsFor(null)} />
                )}
              </>
            );
          }}
        </Loaded>
      </Page>
    </>
  );
}

function BookingCard({ b, advance, onStart, onMore }: { b: Booking; advance: number; onStart: () => void; onMore: () => void }) {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const nameOf = useTeamNames();
  const settings = useSettings();
  const today = todayIST();
  const studio = settings.data?.settings.studio_name ?? 'Namita Garg Makeover';
  const open = b.status === 'booked';
  const remind = open && b.day >= today
    ? waLink(b.client_phone, bookingMessage({
      t, lang, studio, kind: 'remind', name: b.client_name, day: b.day, time: b.start_time, services: b.services_text, advance,
    }))
    : null;
  const statusBadge = b.status === 'done' ? <span className="badge badge-success"><Check size={14} /> {t('booking_done')}</span>
    : b.status === 'no_show' ? <span className="badge badge-warning">{t('booking_no_show')}</span>
      : b.status === 'cancelled' ? <span className="badge badge-neutral">{t('booking_cancelled')}</span> : null;

  return (
    <article className={`card stack booking${open ? '' : ' closed'}`} style={{ gap: 10 }}>
      <div className="row" style={{ alignItems: 'flex-start', gap: 14 }}>
        <div className="booking-time">
          <strong className="num">{formatTime(b.start_time, lang)}</strong>
          <span className="muted small num">{t('duration_short', { n: b.duration_minutes })}</span>
        </div>
        <div className="grow stack" style={{ gap: 2 }}>
          <Link to={`/clients/${b.client_phone}`} className="booking-name">{b.client_name}</Link>
          {b.services_text && <span className="small">{b.services_text}</span>}
          {/* Who, price, advance and reminder on one quiet line; a badge only when it's no longer open. */}
          {(b.staff_id || b.quoted != null || advance > 0 || (b.reminded_on && open)) && (
            <span className="muted small num">
              {[
                b.staff_id ? nameOf(b.staff_id) : null,
                b.quoted != null ? formatINR(b.quoted) : null,
                advance > 0 ? t('booking_advance_badge', { amount: formatINR(advance) }) : null,
                b.reminded_on && open ? t('booking_reminded') : null,
              ].filter(Boolean).join(' · ')}
            </span>
          )}
          {statusBadge && <span style={{ marginTop: 2 }}>{statusBadge}</span>}
          {b.note && <span className="muted small" style={{ whiteSpace: 'pre-wrap' }}>{b.note}</span>}
          {b.status === 'cancelled' && b.cancel_reason && <span className="muted small">{b.cancel_reason}</span>}
        </div>
      </div>
      {open && (
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-sm btn-primary grow" onClick={onStart}><Play /> {t('booking_start')}</button>
          {remind && (
            <a className="btn btn-sm btn-whatsapp grow" href={remind} target="_blank" rel="noopener" onClick={() => {
              haptic();
              void supabase.from('appointments').update({ reminded_on: today }).eq('id', b.id)
                .then(() => qc.invalidateQueries({ queryKey: ['bookings'] }));
            }}>
              <BellRing /> {t('booking_remind')}
            </a>
          )}
          <button className="btn btn-sm btn-secondary" aria-label={t('booking_more')} onClick={onMore}><MoreHorizontal /></button>
        </div>
      )}
    </article>
  );
}

/** Take an advance, edit, mark no-show, cancel; and the advances so far. */
function BookingActions({ b, advances, onClose }: { b: Booking; advances: Advance[]; onClose: () => void }) {
  const me = useMe();
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const nameOf = useTeamNames();
  const [mode, setMode] = useState<'menu' | 'advance' | 'cancel' | 'noshow'>('menu');
  const [amount, setAmount] = useState<number | null>(null);
  const [payMode, setPayMode] = useState<PayMode>('upi');
  const [reason, setReason] = useState('');
  const refresh = () => {
    for (const k of ['bookings', 'booking', 'client', 'clients', 'clients-due', 'report', 'advances', 'closing']) qc.invalidateQueries({ queryKey: [k] });
  };

  const addAdvance = useMutation({
    mutationFn: async () => must(await supabase.rpc('add_advance', { p_appointment: b.id, p_amount: amount, p_mode: payMode })),
    onSuccess: () => { refresh(); toast({ kind: 'success', text: t('booking_advance_saved', { amount: formatINR(amount ?? 0) }) }); onClose(); },
  });
  const setStatus = useMutation({
    mutationFn: async (status: 'cancelled' | 'no_show') => must(await supabase.from('appointments')
      .update({ status, cancel_reason: status === 'cancelled' ? reason.trim() : null }).eq('id', b.id)),
    onSuccess: (_, status) => { refresh(); toast({ kind: 'info', text: status === 'cancelled' ? t('booking_cancelled') : t('booking_no_show') }); onClose(); },
  });
  const voidAdvance = useMutation({
    mutationFn: async (id: string) => must(await supabase.rpc('void_advance', { p_id: id, p_reason: 'Cancelled' })),
    onSuccess: () => { refresh(); toast({ kind: 'info', text: t('entry_cancelled') }); },
    onError: (e) => toast({ kind: 'error', text: errorText(e, t) }),
  });

  if (mode === 'noshow') {
    return (
      <Confirm open onClose={onClose} title={t('booking_no_show_confirm', { name: b.client_name })} busy={setStatus.isPending}
        confirmLabel={t('booking_no_show')} onConfirm={() => setStatus.mutate('no_show')} />
    );
  }

  return (
    <Sheet open onClose={onClose} title={`${b.client_name} · ${formatTime(b.start_time, lang)}`}>
      {mode === 'menu' && (
        <div className="stack">
          {advances.length > 0 && (
            <div className="list">
              {advances.map((a) => (
                <div key={a.id} className="list-item" style={{ opacity: a.voided ? 0.55 : 1 }}>
                  <span className="grow">
                    <span className="title num" style={{ display: 'block', textDecoration: a.voided ? 'line-through' : undefined }}>
                      {t('booking_advance_badge', { amount: formatINR(a.amount) })} · {t(a.mode)}
                    </span>
                    <span className="sub">{formatDate(a.paid_on, lang, false)} · {formatClock(a.created_at, lang)} · {nameOf(a.received_by)}</span>
                  </span>
                  {!a.voided && (me.is_owner || a.received_by === me.id) && (
                    <button className="icon-btn" aria-label={t('udhaar_cancel')} disabled={voidAdvance.isPending}
                      onClick={() => voidAdvance.mutate(a.id)}><Ban /></button>
                  )}
                </div>
              ))}
            </div>
          )}
          <button className="btn btn-primary btn-block" onClick={() => setMode('advance')}><IndianRupee /> {t('booking_take_advance')}</button>
          <button className="btn btn-secondary btn-block" onClick={() => navigate(`/bookings/new?edit=${b.id}`)}><Pencil /> {t('booking_edit')}</button>
          <button className="btn btn-secondary btn-block" onClick={() => setMode('noshow')}><UserX /> {t('booking_no_show')}</button>
          <button className="btn btn-danger btn-block" onClick={() => setMode('cancel')}><CalendarX2 /> {t('booking_cancel')}</button>
          <SheetCloseButton label={t('close')} />
        </div>
      )}
      {mode === 'advance' && (
        <div className="stack">
          <Field label={t('amount')} htmlFor="adv-a"><MoneyInput id="adv-a" value={amount} onChange={setAmount} autoFocus /></Field>
          <Field label={t('mode')}><Choices<PayMode> label={t('mode')} value={payMode} onChange={setPayMode} options={payModeOptions(t)} /></Field>
          {addAdvance.error && <ErrorBox error={addAdvance.error} />}
          <button className="btn btn-primary btn-lg btn-block" disabled={!amount || addAdvance.isPending} aria-busy={addAdvance.isPending}
            onClick={() => addAdvance.mutate()}><Check /> {t('booking_save_advance', { amount: formatINR(amount ?? 0) })}</button>
        </div>
      )}
      {mode === 'cancel' && (
        <form className="stack" onSubmit={(e) => { e.preventDefault(); setStatus.mutate('cancelled'); }}>
          {advancePaid(advances, b.id) > 0 && (
            <div className="notice notice-warning">{t('booking_cancel_advance', { amount: formatINR(advancePaid(advances, b.id)) })}</div>
          )}
          <Field label={t('entry_cancel_reason')} htmlFor="bk-r">
            <input id="bk-r" className="input" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus required />
          </Field>
          {setStatus.error && <ErrorBox error={setStatus.error} />}
          <button className="btn btn-danger btn-lg btn-block" disabled={!reason.trim() || setStatus.isPending} aria-busy={setStatus.isPending}>
            <CalendarX2 /> {t('booking_cancel')}
          </button>
        </form>
      )}
    </Sheet>
  );
}

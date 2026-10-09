import { AlertTriangle, BarChart3, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Contact, HandCoins, Lock, PhoneCall, Plus, Share2 } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTeamNames } from '../../auth/auth';
import { Empty, Loaded, Money, Page, TopBar } from '../../components/ui';
import { useI18n, type TFn } from '../../i18n/i18n';
import { addDays, formatDate, formatTime, formatWeekday, todayIST } from '../../lib/dates';
import { formatINR, sum } from '../../lib/money';
import type { Lang } from '../../lib/types';
import { waShareLink } from '../../lib/whatsapp';
import { useBookings } from '../bookings/data';
import { useClientsDue } from './CallbackPage';
import { summarizeDay, useAdvancesOn, useClosing, useUdhaarCollections, useUdhaarStatus, useVisits, type DaySummary } from './data';
import { VisitCard } from './VisitCard';

/** Owner: everything logged in the salon on one day, by whom, and the day's closing. */
export default function SalonDayPage() {
  const { t, lang } = useI18n();
  const [params, setParams] = useSearchParams();
  const today = todayIST();
  const day = params.get('day') ?? today;
  const visits = useVisits(day);
  const closing = useClosing(day);
  const collected = useUdhaarCollections(day);
  const advances = useAdvancesOn(day);
  const udhaar = useUdhaarStatus();
  const nameOf = useTeamNames();
  const dueCount = useClientsDue().data?.length ?? 0;
  const dayBookings = (useBookings(day, day).data?.bookings ?? []).filter((b) => b.status === 'booked');
  const liveCollections = (collected.data ?? []).filter((c) => !c.voided);
  const collectedToday = sum(liveCollections.map((c) => c.amount));
  const collectedCash = sum(liveCollections.filter((c) => c.mode === 'cash').map((c) => c.amount));
  const owed = (udhaar.data ?? []).filter((u) => u.outstanding > 0);
  const owedTotal = sum(owed.map((u) => u.outstanding));
  const owedClients = new Set(owed.map((u) => u.client_phone)).size;

  const go = (d: string) => setParams(d === today ? {} : { day: d }, { replace: true });

  return (
    <>
      <TopBar title={t('nav_salon')} actions={
        <Link className="icon-btn" to={day === today ? '/salon/new' : `/salon/new?date=${day}`} aria-label={t('nav_new_entry')}>
          <Plus />
        </Link>
      } />
      <Page>
        <div className="row-between">
          <button className="icon-btn" aria-label={t('prev_day')} onClick={() => go(addDays(day, -1))}><ChevronLeft /></button>
          <div className="center">
            <div style={{ fontWeight: 700 }}>{day === today ? t('today') : formatWeekday(day, lang)}</div>
            <div className="muted small">{formatDate(day, lang)}</div>
          </div>
          <button className="icon-btn" aria-label={t('next_day')} disabled={day >= today}
            style={{ visibility: day >= today ? 'hidden' : 'visible' }} onClick={() => go(addDays(day, 1))}>
            <ChevronRight />
          </button>
        </div>

        <Loaded q={visits}>
          {(all) => {
            const s = summarizeDay(all);
            return (
              <>
                <div className="card hero stack" style={{ gap: 2 }}>
                  <span className="stat-label">{day === today ? t('home_salon_today') : t('total')}</span>
                  <Money n={s.total} className="stat-value" animate />
                  <span className="stat-sub num">
                    {[t('salon_entries', { n: s.count }), payBreakdown(s, t),
                      s.discount > 0 ? t('work_discounts', { amount: formatINR(s.discount) }) : null].filter(Boolean).join(' · ')}
                  </span>
                  {collectedToday > 0 && (
                    <span className="stat-sub text-success num">{t('udhaar_collected_day', { amount: formatINR(collectedToday) })}</span>
                  )}
                </div>

                {/* An entry, udhaar payment or cash advance after closing changes the cash: say so, rather than show an old result. */}
                {closing.data && collected.isSuccess && advances.isSuccess
                  && closing.data.expected_cash !== s.cash + collectedCash + advances.data.cash ? (
                  <Link to={`/salon/close?day=${day}`} className="notice notice-warning">
                    <AlertTriangle />
                    <span className="grow">{t('closing_stale')}</span>
                    <ChevronRight />
                  </Link>
                ) : closing.data ? (
                  <Link to={`/salon/close?day=${day}`}
                    className={`notice ${closing.data.counted_cash === closing.data.expected_cash ? 'notice-success' : 'notice-warning'}`}>
                    {closing.data.counted_cash === closing.data.expected_cash ? <CheckCircle2 /> : <AlertTriangle />}
                    <span className="grow">{t('salon_closed', { diff: diffText(closing.data.counted_cash - closing.data.expected_cash, t) })}</span>
                    <ChevronRight />
                  </Link>
                ) : s.count > 0 && (
                  <Link to={`/salon/close?day=${day}`} className="btn btn-primary btn-block">
                    <Lock /> {t('close_title')}
                  </Link>
                )}

                {/* The rest of the salon, one row each, with a number only where there is one. */}
                <div className="list">
                  <Link to={`/bookings?d=${day}`} className="list-item">
                    <span className="row-icon info"><CalendarDays /></span>
                    <span className="grow">
                      <span className="title" style={{ display: 'block' }}>{t('bookings_title')}</span>
                      <span className="sub num">
                        {dayBookings[0]
                          ? `${t('bookings_n', { n: dayBookings.length })} · ${t('bookings_next', { time: formatTime(dayBookings[0].start_time, lang) })}`
                          : t('bookings_add')}
                      </span>
                    </span>
                    <ChevronRight className="chev" />
                  </Link>
                  <Link to="/salon/udhaar" className="list-item">
                    <span className={`row-icon ${owedTotal ? 'warning' : ''}`}><HandCoins /></span>
                    <span className="grow">
                      <span className="title" style={{ display: 'block' }}>{t('udhaar_title')}</span>
                      <span className="sub num">
                        {owedTotal ? `${formatINR(owedTotal)} · ${t('udhaar_clients', { n: owedClients })}` : t('udhaar_none')}
                      </span>
                    </span>
                    <ChevronRight className="chev" />
                  </Link>
                  {dueCount > 0 && (
                    <Link to="/salon/callback" className="list-item">
                      <span className="row-icon info"><PhoneCall /></span>
                      <span className="grow">
                        <span className="title" style={{ display: 'block' }}>{t('callback_title')}</span>
                        <span className="sub">{t('callback_alert', { n: dueCount })}</span>
                      </span>
                      <ChevronRight className="chev" />
                    </Link>
                  )}
                  <Link to="/clients" className="list-item">
                    <span className="row-icon"><Contact /></span>
                    <span className="grow">
                      <span className="title" style={{ display: 'block' }}>{t('clients_title')}</span>
                      <span className="sub">{t('clients_short')}</span>
                    </span>
                    <ChevronRight className="chev" />
                  </Link>
                  <Link to="/salon/work" className="list-item">
                    <span className="row-icon"><BarChart3 /></span>
                    <span className="grow">
                      <span className="title" style={{ display: 'block' }}>{t('work_title')}</span>
                      <span className="sub">{t('work_short')}</span>
                    </span>
                    <ChevronRight className="chev" />
                  </Link>
                </div>

                {s.byStaff.size > 0 && (
                  <section className="stack">
                    <h2 className="section-title">{t('salon_by_staff')}</h2>
                    <div className="list">
                      {[...s.byStaff.entries()].sort((a, b) => b[1].amount - a[1].amount).map(([id, x]) => (
                        <div key={id} className="list-item">
                          <span className="grow title">{nameOf(id)}</span>
                          <span className="end">
                            <Money n={x.amount} className="title" />
                            <div className="sub">{t('salon_services_n', { n: x.services })}</div>
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <section className="stack">
                  <h2 className="section-title">{t('salon_entries_title')}</h2>
                  {all.length === 0
                    ? <Empty title={t('salon_empty')} />
                    : <div className="stack stagger">{all.map((v) => <VisitCard key={v.id} v={v} showCreator canCancel />)}</div>}
                </section>

                {s.count > 0 && (
                  <a className="btn btn-whatsapp btn-block" href={waShareLink(summaryText(day, s, nameOf, t, lang))} target="_blank" rel="noopener">
                    <Share2 /> {t('share_summary')}
                  </a>
                )}
              </>
            );
          }}
        </Loaded>
      </Page>
    </>
  );
}

export function diffText(diff: number, t: TFn): string {
  if (diff === 0) return t('close_match');
  return diff < 0 ? t('close_short', { amount: formatINR(-diff) }) : t('close_extra', { amount: formatINR(diff) });
}

/** 'Cash ₹1,000 · UPI ₹1,900 · Udhaar ₹500', leaving out ways nobody paid (cash and UPI always shown). */
function payBreakdown(s: DaySummary, t: TFn): string {
  return [
    `${t('cash')} ${formatINR(s.cash)}`,
    `${t('upi')} ${formatINR(s.upi)}`,
    s.card ? `${t('card')} ${formatINR(s.card)}` : null,
    s.udhaar ? `${t('udhaar')} ${formatINR(s.udhaar)}` : null,
  ].filter(Boolean).join(' · ');
}

function summaryText(day: string, s: DaySummary, nameOf: (id: string) => string, t: TFn, lang: Lang): string {
  const lines = [
    `${t('summary_heading')}, ${formatDate(day, lang)}`,
    `${t('total')}: ${formatINR(s.total)} (${t('salon_entries', { n: s.count })})`,
    payBreakdown(s, t),
    s.discount ? t('work_discounts', { amount: formatINR(s.discount) }) : null,
    '',
    ...[...s.byStaff.entries()].sort((a, b) => b[1].amount - a[1].amount)
      .map(([id, x]) => `${nameOf(id)}: ${formatINR(x.amount)} (${x.services})`),
  ];
  return lines.filter((l) => l != null).join('\n');
}

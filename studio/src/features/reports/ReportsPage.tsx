import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, HardDriveDownload } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTeamNames } from '../../auth/auth';
import { Count, ErrorBox, Loaded, Money, Page, TopBar, useToast } from '../../components/ui';
import { useI18n, type TFn } from '../../i18n/i18n';
import { formatDate, formatMonth, formatTime, formatWeekday, todayIST, type ISODate } from '../../lib/dates';
import { downloadWorkbook } from '../../lib/export';
import { formatINR, sum } from '../../lib/money';
import { changePct, periodOf, shiftAnchor, type Period, type PeriodKind } from '../../lib/periods';
import { must, supabase } from '../../lib/supabase';
import type { Lang } from '../../lib/types';
import { useUdhaarStatus } from '../salon/data';
import { BarList, ColumnChart, Delta, StackBar, type Column } from './charts';

export interface Report {
  salon: { billed: number; visits: number; discount: number; cash: number; upi: number; card: number; udhaar: number; clients: number; no_phone: number };
  services: number;
  clients_new: number;
  clients_returning: number;
  by_day: { day: ISODate; salon: number; fees: number; visits: number }[];
  by_hour: { hour: number; visits: number; amount: number }[];
  top_services: { name: string; count: number; amount: number }[];
  by_staff: { staff_id: string; count: number; amount: number }[];
  fees: { collected: number; payments: number };
  admissions: number;
  attendance: { present: number; absent: number; leave: number };
  udhaar: { given: number; collected: number };
}

function useReport(from: ISODate, to: ISODate) {
  return useQuery({
    queryKey: ['report', from, to],
    queryFn: async () => must(await supabase.rpc('studio_report', { p_from: from, p_to: to })) as Report,
    // Changing the period keeps the last numbers on screen (faded) instead of flashing.
    placeholderData: keepPreviousData,
  });
}

const KINDS: PeriodKind[] = ['day', 'week', 'month'];

function periodTitle(p: Period, today: ISODate, t: TFn, lang: Lang): { main: string; sub: string } {
  if (p.kind === 'day') {
    return { main: p.from === today ? t('today') : formatWeekday(p.from, lang), sub: formatDate(p.from, lang) };
  }
  if (p.kind === 'week') {
    return {
      main: `${formatDate(p.from, lang, false)} – ${formatDate(p.end, lang, false)}`,
      sub: p.complete ? '' : t('rep_this_week'),
    };
  }
  return { main: formatMonth(p.from, lang), sub: p.complete ? '' : t('this_month') };
}

function vsText(p: Period, t: TFn): string {
  if (p.kind === 'day') return t('rep_vs_day');
  if (p.kind === 'week') return p.complete ? t('rep_vs_week') : t('rep_vs_week_sofar');
  return p.complete ? t('rep_vs_month') : t('rep_vs_month_sofar');
}

/** "5 pm" for the hour 17. */
const hourLabel = (h: number, lang: Lang) => formatTime(`${String(h).padStart(2, '0')}:00`, lang).replace(':00', '');

/** Owner: how the studio did over a day, a week or a month, against the period before. */
export default function ReportsPage() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const today = todayIST();
  const [params, setParams] = useSearchParams();
  const kind: PeriodKind = KINDS.includes(params.get('p') as PeriodKind) ? params.get('p') as PeriodKind : 'week';
  const anchor = params.get('d') && params.get('d')! <= today ? params.get('d')! : today;
  const p = periodOf(kind, anchor, today);
  const go = (k: PeriodKind, d: ISODate) => setParams(d >= today && k === 'week' ? {} : { p: k, d }, { replace: true });

  const cur = useReport(p.from, p.to);
  const prev = useReport(p.prevFrom, p.prevTo);
  const nameOf = useTeamNames();
  const udhaar = useUdhaarStatus();

  const title = periodTitle(p, today, t, lang);
  const vs = vsText(p, t);
  const isLatest = p.to === today || p.end >= today;

  return (
    <>
      <TopBar title={t('rep_title')} />
      <Page>
        <div className="tabs" role="tablist" aria-label={t('rep_period')}>
          {KINDS.map((k) => (
            <button key={k} role="tab" className="tab" aria-selected={kind === k} onClick={() => go(k, today)}>
              {t(`rep_${k}`)}
            </button>
          ))}
        </div>
        <div className="period">
          <button className="icon-btn" aria-label={t('rep_prev')} onClick={() => go(kind, shiftAnchor(p, -1))}><ChevronLeft /></button>
          <div className="label">
            <strong>{title.main}</strong>
            <span className="muted small">{title.sub}</span>
          </div>
          <button className="icon-btn" aria-label={t('rep_next')} disabled={isLatest}
            style={{ visibility: isLatest ? 'hidden' : 'visible' }} onClick={() => go(kind, shiftAnchor(p, 1))}><ChevronRight /></button>
        </div>

        <Loaded q={cur} skeleton="cards">
          {(r) => {
            const pr = prev.data;
            const income = r.salon.billed + r.fees.collected;
            const prevIncome = pr ? pr.salon.billed + pr.fees.collected : 0;
            const avg = r.salon.visits ? Math.round(r.salon.billed / r.salon.visits) : 0;
            const prevAvg = pr?.salon.visits ? Math.round(pr.salon.billed / pr.salon.visits) : 0;
            const d = (a: number, b: number | undefined) => (pr ? changePct(a, b ?? 0) : null);
            const marked = r.attendance.present + r.attendance.absent;
            const attendancePct = marked ? Math.round((r.attendance.present / marked) * 100) : null;
            const owedNow = sum((udhaar.data ?? []).map((u) => u.outstanding));
            const columns = trendColumns(p, r, lang);
            const busiest = r.by_hour.length ? r.by_hour.reduce((a, b) => (b.visits > a.visits ? b : a)) : null;

            return (
              <div className="stack-lg" style={{ opacity: cur.isPlaceholderData ? 0.55 : 1, transition: 'opacity 0.2s' }}>
                {/* ----- the headline ----- */}
                <div className="card hero stack" style={{ gap: 2 }}>
                  <span className="stat-label">{t('rep_income')}</span>
                  <Money n={income} className="stat-value" animate />
                  <span className="stat-sub num">
                    {t('nav_salon')} {formatINR(r.salon.billed)} · {t('rep_fees')} {formatINR(r.fees.collected)}
                  </span>
                  <Delta pct={d(income, prevIncome)} vs={vs} />
                </div>

                <div className="list">
                  <KpiRow label={t('rep_clients')} value={<Count n={r.salon.visits} className="kpi-value" />} delta={<Delta pct={d(r.salon.visits, pr?.salon.visits)} vs={vs} />} />
                  <KpiRow label={t('rep_avg_bill')} value={<Money n={avg} className="kpi-value" animate />} delta={<Delta pct={d(avg, prevAvg)} vs={vs} />} />
                  <KpiRow label={t('rep_discounts')} value={<Money n={r.salon.discount} className="kpi-value" animate />}
                    delta={<Delta pct={d(r.salon.discount, pr?.salon.discount)} vs={vs} upIsGood={false} />} />
                </div>

                {/* ----- over time ----- */}
                <ReportCard title={p.kind === 'day' ? t('rep_by_hour') : t('rep_by_day')}>
                  {income === 0 ? <p className="muted">{t('rep_nothing')}</p> : (
                    <ColumnChart
                      title={p.kind === 'day' ? t('rep_by_hour') : t('rep_by_day')}
                      columns={columns}
                      series={p.kind === 'day'
                        ? [{ name: t('nav_salon'), color: 'var(--series-1)' }]
                        : [{ name: t('nav_salon'), color: 'var(--series-1)' }, { name: t('rep_fees'), color: 'var(--series-2)' }]}
                    />
                  )}
                </ReportCard>

                {/* ----- salon ----- */}
                {r.salon.billed > 0 && (
                  <ReportCard title={t('rep_paid_how')}>
                    <StackBar parts={[
                      { name: t('cash'), value: r.salon.cash, color: 'var(--series-1)' },
                      { name: t('upi'), value: r.salon.upi, color: 'var(--series-2)' },
                      { name: t('card'), value: r.salon.card, color: 'var(--series-3)' },
                      { name: t('udhaar'), value: r.salon.udhaar, color: 'var(--series-4)' },
                    ]} />
                  </ReportCard>
                )}

                {r.top_services.length > 0 && (
                  <ReportCard title={t('rep_top_services')}>
                    <BarList rows={r.top_services.map((s) => ({
                      key: s.name, label: s.name, value: s.amount, valueText: formatINR(s.amount), sub: `× ${s.count}`,
                    }))} />
                  </ReportCard>
                )}

                {r.by_staff.length > 0 && (
                  <ReportCard title={t('rep_staff')} link={{ to: '/salon/work', label: t('rep_more') }}>
                    <BarList rows={r.by_staff.map((s) => ({
                      key: s.staff_id, label: nameOf(s.staff_id), value: s.amount, valueText: formatINR(s.amount),
                      sub: t('salon_services_n', { n: s.count }),
                    }))} />
                  </ReportCard>
                )}

                <ReportCard title={t('rep_clients_title')}>
                  <div className="stat-grid">
                    <MiniStat label={t('rep_new_clients')} value={r.clients_new} />
                    <MiniStat label={t('rep_returning')} value={r.clients_returning} />
                  </div>
                  {r.salon.no_phone > 0 && <p className="muted small">{t('rep_no_phone', { n: r.salon.no_phone })}</p>}
                </ReportCard>

                {p.kind !== 'day' && busiest && (
                  <ReportCard title={t('rep_busy_hours')}>
                    <p className="muted small">{t('rep_busiest', { time: hourLabel(busiest.hour, lang) })}</p>
                    <ColumnChart
                      title={t('rep_busy_hours')}
                      columns={hourColumns(r, lang, (h) => r.by_hour.find((x) => x.hour === h)?.visits ?? 0)}
                      series={[{ name: t('rep_clients'), color: 'var(--series-1)' }]}
                      format={(n) => t('salon_entries', { n })}
                      axis={(n) => String(Math.round(n))}
                      height={140}
                    />
                  </ReportCard>
                )}

                {/* ----- academy ----- */}
                <ReportCard title={t('rep_academy')}>
                  <div className="stat-grid">
                    <MiniStat label={t('rep_fees')} value={r.fees.collected} money delta={<Delta pct={d(r.fees.collected, pr?.fees.collected)} vs={vs} />} />
                    <MiniStat label={t('rep_admissions')} value={r.admissions} delta={<Delta pct={d(r.admissions, pr?.admissions)} vs={vs} />} />
                  </div>
                  {attendancePct != null && (
                    <div className="stack" style={{ gap: 6 }}>
                      <div className="row-between">
                        <span className="stat-label">{t('attendance')}</span>
                        <strong className="num">{attendancePct}%</strong>
                      </div>
                      <div className="meter"><span style={{ width: `${attendancePct}%` }} /></div>
                      <span className="muted small num">
                        {t('present')} {r.attendance.present} · {t('absent')} {r.attendance.absent} · {t('leave')} {r.attendance.leave}
                      </span>
                    </div>
                  )}
                </ReportCard>

                {/* ----- udhaar ----- */}
                {(r.udhaar.given > 0 || r.udhaar.collected > 0 || owedNow > 0) && (
                  <ReportCard title={t('udhaar_title')} link={{ to: '/salon/udhaar', label: t('rep_more') }}>
                    <div className="stat-grid">
                      <MiniStat label={t('rep_udhaar_given')} value={r.udhaar.given} money />
                      <MiniStat label={t('rep_udhaar_collected')} value={r.udhaar.collected} money />
                    </div>
                    {owedNow > 0 && <p className="muted small">{t('rep_udhaar_pending', { amount: formatINR(owedNow) })}</p>}
                  </ReportCard>
                )}

                <button className="btn btn-secondary btn-block" onClick={() => {
                  void downloadReport(r, p, title.main, nameOf, t, lang)
                    .then(() => toast({ kind: 'success', text: t('rep_downloaded') }))
                    .catch((e: unknown) => toast({ kind: 'error', text: String(e) }));
                }}>
                  <HardDriveDownload /> {t('rep_download')}
                </button>
              </div>
            );
          }}
        </Loaded>
        {prev.error != null && <ErrorBox error={prev.error} retry={() => prev.refetch()} />}
      </Page>
    </>
  );
}

function ReportCard({ title, link, children }: { title: string; link?: { to: string; label: string }; children: ReactNode }) {
  return (
    <section className="card stack report-card">
      <div className="row-between">
        <h2 className="card-title">{title}</h2>
        {link && <Link to={link.to} className="btn btn-link" style={{ minHeight: 32 }}>{link.label}</Link>}
      </div>
      {children}
    </section>
  );
}

/** One measure as a list row: the name and its change on the left, the number on the right. */
function KpiRow({ label, value, delta }: { label: string; value: ReactNode; delta: ReactNode }) {
  return (
    <div className="list-item">
      <span className="grow">
        <span className="title" style={{ display: 'block' }}>{label}</span>
        {delta}
      </span>
      <span className="end">{value}</span>
    </div>
  );
}

function MiniStat({ label, value, money, delta }: { label: string; value: number; money?: boolean; delta?: ReactNode }) {
  return (
    <div className="mini-stat stack" style={{ gap: 0 }}>
      <span className="stat-label">{label}</span>
      {money ? <Money n={value} className="mini-value" animate /> : <Count n={value} className="mini-value" />}
      {delta}
    </div>
  );
}

/** Columns for the trend: hours for one day, days for a week or a month. */
function trendColumns(p: Period, r: Report, lang: Lang): Column[] {
  if (p.kind === 'day') return hourColumns(r, lang, (h) => r.by_hour.find((x) => x.hour === h)?.amount ?? 0);
  return r.by_day.map((d, i) => ({
    key: d.day,
    // A week shows every weekday; a month labels every 5th day so the axis stays readable.
    tick: p.kind === 'week' ? formatWeekday(d.day, lang, 'short')
      : (i === 0 || Number(d.day.slice(8)) % 5 === 0) ? String(Number(d.day.slice(8))) : '',
    label: `${formatWeekday(d.day, lang, 'short')}, ${formatDate(d.day, lang, false)}`,
    values: [d.salon, d.fees],
  }));
}

/** Opening hours with anything logged, at least 10 am to 8 pm. */
function hourColumns(r: Report, lang: Lang, value: (h: number) => number): Column[] {
  const hours = r.by_hour.map((h) => h.hour);
  const lo = Math.min(10, ...hours);
  const hi = Math.max(20, ...hours);
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).map((h) => ({
    key: String(h),
    tick: h % 2 === 0 ? hourLabel(h, lang) : '',
    label: hourLabel(h, lang),
    values: [value(h)],
  }));
}

/** The same report as an Excel file, for Mom's records or the accountant. */
async function downloadReport(r: Report, p: Period, title: string, nameOf: (id: string) => string, t: TFn, lang: Lang) {
  const income = r.salon.billed + r.fees.collected;
  await downloadWorkbook(`ng-studio-report-${p.from}-to-${p.to}.xlsx`, [
    {
      name: t('rep_title'),
      rows: [
        [t('rep_period'), title],
        [t('rep_income'), income],
        [t('nav_salon'), r.salon.billed],
        [t('rep_fees'), r.fees.collected],
        [t('rep_clients'), r.salon.visits],
        [t('rep_services'), r.services],
        [t('rep_discounts'), r.salon.discount],
        [t('cash'), r.salon.cash],
        [t('upi'), r.salon.upi],
        [t('card'), r.salon.card],
        [t('udhaar'), r.salon.udhaar],
        [t('rep_new_clients'), r.clients_new],
        [t('rep_returning'), r.clients_returning],
        [t('rep_admissions'), r.admissions],
        [t('rep_udhaar_collected'), r.udhaar.collected],
      ].map(([k, v]) => ({ [t('rep_measure')]: k, [t('amount')]: v })),
    },
    {
      name: t('rep_by_day'),
      rows: r.by_day.map((d) => ({
        [t('date')]: formatDate(d.day, lang), [t('nav_salon')]: d.salon, [t('rep_fees')]: d.fees, [t('rep_clients')]: d.visits,
      })),
    },
    { name: t('rep_top_services'), rows: r.top_services.map((s) => ({ [t('name')]: s.name, [t('rep_services')]: s.count, [t('amount')]: s.amount })) },
    { name: t('rep_staff'), rows: r.by_staff.map((s) => ({ [t('name')]: nameOf(s.staff_id), [t('rep_services')]: s.count, [t('amount')]: s.amount })) },
    { name: t('rep_by_hour'), rows: r.by_hour.map((h) => ({ [t('rep_hour')]: hourLabel(h.hour, lang), [t('rep_clients')]: h.visits, [t('amount')]: h.amount })) },
  ]);
}

import { CheckCircle2, ChevronLeft, ChevronRight, Lock, Plus, Share2 } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTeamNames } from '../../auth/auth';
import { Empty, Loaded, Money, Page, TopBar } from '../../components/ui';
import { useI18n, type TFn } from '../../i18n/i18n';
import { addDays, formatDate, formatWeekday, todayIST } from '../../lib/dates';
import { formatINR } from '../../lib/money';
import type { Lang } from '../../lib/types';
import { waShareLink } from '../../lib/whatsapp';
import { summarizeDay, useClosing, useVisits, type DaySummary } from './data';
import { VisitCard } from './VisitCard';

/** Owner: everything logged in the salon on one day, by whom, and the day's closing. */
export default function SalonDayPage() {
  const { t, lang } = useI18n();
  const [params, setParams] = useSearchParams();
  const today = todayIST();
  const day = params.get('day') ?? today;
  const visits = useVisits(day);
  const closing = useClosing(day);
  const nameOf = useTeamNames();

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
                <div className="card stack" style={{ gap: 4 }}>
                  <div className="stat-label">{t('total')}</div>
                  <Money n={s.total} className="stat-value" />
                  <div className="stat-sub num">
                    {t('cash')} {formatINR(s.cash)} · {t('upi')} {formatINR(s.upi)}{s.card ? ` · ${t('card')} ${formatINR(s.card)}` : ''}
                  </div>
                  <div className="stat-sub">{t('salon_entries', { n: s.count })}</div>
                </div>

                {closing.data ? (
                  <Link to={`/salon/close?day=${day}`} className="notice notice-info" style={{ textDecoration: 'none' }}>
                    <CheckCircle2 />
                    <span>{t('salon_closed', { diff: diffText(closing.data.counted_cash - closing.data.expected_cash, t) })}</span>
                  </Link>
                ) : s.count > 0 && (
                  <Link to={`/salon/close?day=${day}`} className="btn btn-primary btn-block btn-lg">
                    <Lock /> {t('close_title')}
                  </Link>
                )}

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
                    : all.map((v) => <VisitCard key={v.id} v={v} showCreator canCancel />)}
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

function summaryText(day: string, s: DaySummary, nameOf: (id: string) => string, t: TFn, lang: Lang): string {
  const lines = [
    `${t('summary_heading')}, ${formatDate(day, lang)}`,
    `${t('total')}: ${formatINR(s.total)} (${t('salon_entries', { n: s.count })})`,
    `${t('cash')} ${formatINR(s.cash)} · ${t('upi')} ${formatINR(s.upi)}${s.card ? ` · ${t('card')} ${formatINR(s.card)}` : ''}`,
    '',
    ...[...s.byStaff.entries()].sort((a, b) => b[1].amount - a[1].amount)
      .map(([id, x]) => `${nameOf(id)}: ${formatINR(x.amount)} (${x.services})`),
  ];
  return lines.join('\n');
}

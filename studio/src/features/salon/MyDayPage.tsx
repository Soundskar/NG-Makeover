import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMe } from '../../auth/auth';
import { Empty, Loaded, Money, Page, TopBar } from '../../components/ui';
import { useI18n } from '../../i18n/i18n';
import { formatClock, formatDate, formatWeekday, todayIST } from '../../lib/dates';
import { formatINR, sum } from '../../lib/money';
import type { WorkLine } from '../../lib/types';
import { useMyWork, useVisits } from './data';
import { VisitCard, withinCancelWindow } from './VisitCard';

/** Staff: the work I did today (the basis for my commission) and the entries I logged. */
export default function MyDayPage() {
  const me = useMe();
  const { t } = useI18n();
  const today = todayIST();
  const work = useMyWork(today, today);
  const visits = useVisits(today);

  return (
    <>
      <TopBar title={t('my_day_title')} />
      <Page>
        <Loaded q={work} skeleton="cards">
          {(lines) => {
            const net = sum(lines.map((l) => l.price - l.discount));
            const discounts = sum(lines.map((l) => l.discount));
            return (
              <>
                <div className="card hero stack" style={{ gap: 2 }}>
                  <span className="stat-label">{t('work_net')}</span>
                  <Money n={net} className="stat-value" animate />
                  <span className="stat-sub">
                    {t('salon_services_n', { n: lines.length })}
                    {discounts > 0 ? ` · ${t('work_discounts', { amount: formatINR(discounts) })}` : ''}
                  </span>
                </div>

                {/* Entries can be cancelled for 15 minutes; only those need the full card. */}
                <Loaded q={visits} skeleton="cards">
                  {(all) => {
                    const recent = all.filter((v) => v.created_by === me.id && !v.voided && withinCancelWindow(v.created_at));
                    if (!recent.length) return null;
                    return (
                      <section className="stack" style={{ gap: 8 }}>
                        <h2 className="section-title">{t('my_recent_entries')}</h2>
                        <p className="muted small">{t('entry_cancel_window')}</p>
                        <div className="stack stagger">
                          {recent.map((v) => <VisitCard key={v.id} v={v} canCancel />)}
                        </div>
                      </section>
                    );
                  }}
                </Loaded>

                <section className="stack" style={{ gap: 8 }}>
                  <h2 className="section-title">{t('my_work_done')}</h2>
                  {lines.length === 0 ? <Empty title={t('my_day_empty')} sub={t('my_day_empty_sub')} /> : <WorkList lines={lines} byDay={false} />}
                </section>
              </>
            );
          }}
        </Loaded>

        <Link to="/salon/new" className="btn btn-primary btn-block"><Plus /> {t('nav_new_entry')}</Link>
      </Page>
    </>
  );
}

/** Services done, newest first; for a month, grouped under each day with its total. */
export function WorkList({ lines, byDay }: { lines: WorkLine[]; byDay: boolean }) {
  const { t, lang } = useI18n();
  const days = byDay ? [...new Set(lines.map((l) => l.day))] : [null];
  return (
    <div className="stack">
      {days.map((d) => {
        const rows = d ? lines.filter((l) => l.day === d) : lines;
        return (
          <div key={d ?? 'all'} className="stack" style={{ gap: 6 }}>
            {d && (
              <div className="row-between small" style={{ padding: '0 4px' }}>
                <strong>{formatWeekday(d, lang, 'short')}, {formatDate(d, lang, false)}</strong>
                <span className="muted num">{formatINR(sum(rows.map((l) => l.price - l.discount)))}</span>
              </div>
            )}
            <div className="list">
              {rows.map((l, i) => (
                <div key={i} className="list-item" style={{ minHeight: 56 }}>
                  <span className="grow">
                    <span className="title" style={{ display: 'block', fontWeight: 550 }}>{l.service_name}</span>
                    <span className="sub num">
                      {formatClock(l.logged_at, lang)}
                      {l.discount > 0 ? ` · ${t('entry_discount_badge', { amount: formatINR(l.discount) })}` : ''}
                      {l.price < l.list_price ? ` · ${t('log_menu_price', { price: formatINR(l.list_price) })}` : ''}
                    </span>
                  </span>
                  <span className="end num title">{formatINR(l.price - l.discount)}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

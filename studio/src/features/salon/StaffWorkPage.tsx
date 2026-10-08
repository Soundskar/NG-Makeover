import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { useState } from 'react';
import { useTeamNames } from '../../auth/auth';
import { Empty, Initials, Loaded, Money, Page, Sheet, SheetCloseButton, TopBar } from '../../components/ui';
import { useI18n } from '../../i18n/i18n';
import { addMonths, formatMonth, monthEnd, monthStart, todayIST } from '../../lib/dates';
import { formatINR, sum } from '../../lib/money';
import { must, supabase } from '../../lib/supabase';
import type { WorkLine } from '../../lib/types';
import { useWorkByStaff, type StaffWork } from './data';
import { WorkList } from './MyDayPage';

/** Owner: each person's salon work for a month — what commission will be worked out from. */
export default function StaffWorkPage() {
  const { t, lang } = useI18n();
  const nameOf = useTeamNames();
  const today = todayIST();
  const [month, setMonth] = useState(monthStart(today));
  const end = monthEnd(month) < today ? monthEnd(month) : today;
  const work = useWorkByStaff(month, end);
  const [person, setPerson] = useState<StaffWork | null>(null);
  const isCurrent = month === monthStart(today);

  return (
    <>
      <TopBar title={t('work_title')} back="/salon" />
      <Page>
        <div className="period">
          <button className="icon-btn" aria-label={t('month_prev')} onClick={() => setMonth(addMonths(month, -1))}><ChevronLeft /></button>
          <div className="label">
            <strong>{formatMonth(month, lang)}</strong>
            <span className="muted small">{isCurrent ? t('this_month') : ''}</span>
          </div>
          <button className="icon-btn" aria-label={t('month_next')} disabled={isCurrent}
            style={{ visibility: isCurrent ? 'hidden' : 'visible' }} onClick={() => setMonth(addMonths(month, 1))}><ChevronRight /></button>
        </div>

        <Loaded q={work} skeleton="cards">
          {(rows) => (
            <>
              <div className="card hero stack" style={{ gap: 2 }}>
                <span className="stat-label">{t('work_net')}</span>
                <Money n={sum(rows.map((r) => r.net))} className="stat-value" animate />
                <span className="stat-sub">
                  {t('salon_services_n', { n: sum(rows.map((r) => r.services)) })}
                  {sum(rows.map((r) => r.discount)) > 0 ? ` · ${t('work_discounts', { amount: formatINR(sum(rows.map((r) => r.discount))) })}` : ''}
                </span>
              </div>
              <p className="muted small">{t('work_commission_note')}</p>
              {rows.length === 0 ? <Empty icon={<Users />} title={t('work_none')} /> : (
                <div className="list">
                  {rows.map((r) => (
                    <button key={r.staff_id} className="list-item" onClick={() => setPerson(r)}>
                      <Initials name={nameOf(r.staff_id)} />
                      <span className="grow">
                        <span className="title" style={{ display: 'block' }}>{nameOf(r.staff_id)}</span>
                        <span className="sub num">
                          {t('salon_services_n', { n: r.services })}
                          {r.discount > 0 ? ` · ${t('work_discounts', { amount: formatINR(r.discount) })}` : ''}
                        </span>
                      </span>
                      <Money n={r.net} className="title" />
                      <ChevronRight className="chev" />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </Loaded>

        {person && (
          <PersonWorkSheet person={person} name={nameOf(person.staff_id)} from={month} to={end} onClose={() => setPerson(null)} />
        )}
      </Page>
    </>
  );
}

function PersonWorkSheet({ person, name, from, to, onClose }: {
  person: StaffWork; name: string; from: string; to: string; onClose: () => void;
}) {
  const { t } = useI18n();
  const lines = useQuery({
    queryKey: ['work', 'person', person.staff_id, from, to],
    queryFn: async () => {
      const rows = must(await supabase.from('visit_lines')
        .select('service_name, list_price, price, discount, visits!inner(visit_date, voided, created_at)')
        .eq('staff_id', person.staff_id).eq('visits.voided', false)
        .gte('visits.visit_date', from).lte('visits.visit_date', to)) as unknown as
        { service_name: string; list_price: number; price: number; discount: number; visits: { visit_date: string; created_at: string } }[];
      return rows.map((r) => ({
        day: r.visits.visit_date, service_name: r.service_name, list_price: r.list_price,
        price: r.price, discount: r.discount, logged_at: r.visits.created_at,
      }) satisfies WorkLine).sort((a, b) => b.logged_at.localeCompare(a.logged_at));
    },
  });
  return (
    <Sheet open onClose={onClose} title={name}>
      <div className="stack">
        <div className="card stack" style={{ gap: 4 }}>
          <div className="row-between"><span className="muted">{t('work_menu_value')}</span><Money n={person.menu_value} /></div>
          {person.charged !== person.menu_value && (
            <div className="row-between"><span className="muted">{t('work_charged')}</span><Money n={person.charged} /></div>
          )}
          {person.discount > 0 && (
            <div className="row-between text-success"><span>{t('discount')}</span><span className="num">−{formatINR(person.discount)}</span></div>
          )}
          <div className="bill-total row-between"><span className="stat-label">{t('work_net')}</span><Money n={person.net} className="stat-value" /></div>
        </div>
        <Loaded q={lines}>{(rows) => <WorkList lines={rows} byDay />}</Loaded>
        <SheetCloseButton label={t('close')} />
      </div>
    </Sheet>
  );
}

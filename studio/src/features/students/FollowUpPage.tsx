import { Bell, ChevronRight } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { Empty, Loaded, Page, TopBar } from '../../components/ui';
import { useI18n } from '../../i18n/i18n';
import { addDays, formatDate, todayIST } from '../../lib/dates';
import { formatINR } from '../../lib/money';
import { nameOf } from '../../lib/types';
import { waLink } from '../../lib/whatsapp';
import { useCourses, useFeeStatus, useSettings, useStudents } from './data';
import { reminderMessage } from './messages';

type Tab = 'overdue' | 'week' | 'ending';

/** Owner: who owes what, who pays this week, whose course is ending. */
export default function FollowUpPage() {
  const { t, lang } = useI18n();
  const fees = useFeeStatus(true);
  const students = useStudents();
  const courses = useCourses();
  const settings = useSettings();
  // The tab is in the address, so Home can open "This week" directly and Back keeps it.
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'week' || params.get('tab') === 'ending' ? params.get('tab') as Tab : 'overdue';
  const setTab = (x: Tab) => setParams(x === 'overdue' ? {} : { tab: x }, { replace: true });
  const today = todayIST();
  const weekEnd = addDays(today, 7);
  const studio = settings.data?.settings.studio_name ?? 'Namita Garg Makeover';

  return (
    <>
      <TopBar title={t('followup_title')} back="/" />
      <Page>
        <div className="tabs" role="tablist">
          {(['overdue', 'week', 'ending'] as const).map((x) => (
            <button key={x} role="tab" className="tab" aria-selected={tab === x} onClick={() => setTab(x)}>{t(`followup_${x}`)}</button>
          ))}
        </div>
        <Loaded q={students}>
          {(all) => {
            const studentOf = (id: string) => all.find((s) => s.id === id);
            const courseName = (id: string) => {
              const c = courses.data?.courses.find((x) => x.id === id);
              return c ? nameOf(c, lang) : '';
            };

            if (tab === 'ending') {
              const ending = all.flatMap((s) => s.enrollments
                .filter((e) => e.status === 'active' && e.expected_end_date <= weekEnd)
                .map((e) => ({ s, e })))
                .sort((a, b) => a.e.expected_end_date.localeCompare(b.e.expected_end_date));
              if (!ending.length) return <Empty title={t('followup_none_ending')} />;
              return (
                <div className="list">
                  {ending.map(({ s, e }) => (
                    <Link key={e.id} to={`/students/${s.id}`} className="list-item">
                      <span className="grow">
                        <span className="title" style={{ display: 'block' }}>{s.full_name}</span>
                        <span className="sub">{courseName(e.course_id)}</span>
                      </span>
                      <span className={`badge ${e.expected_end_date < today ? 'badge-danger' : 'badge-warning'}`}>
                        {e.expected_end_date < today ? t('ended_on', { date: formatDate(e.expected_end_date, lang, false) })
                          : t('ends_on', { date: formatDate(e.expected_end_date, lang, false) })}
                      </span>
                      <ChevronRight className="chev" />
                    </Link>
                  ))}
                </div>
              );
            }

            const rows = (fees.data ?? []).filter((f) => f.enrollment_status !== 'left' && f.balance > 0 && (tab === 'overdue'
              ? f.overdue_amount > 0
              : f.overdue_amount === 0 && f.next_due_date != null && f.next_due_date <= weekEnd))
              .sort((a, b) => tab === 'overdue'
                ? (a.oldest_overdue_date ?? '').localeCompare(b.oldest_overdue_date ?? '')
                : (a.next_due_date ?? '').localeCompare(b.next_due_date ?? ''));
            if (fees.isPending) return null;
            if (!rows.length) return <Empty title={tab === 'overdue' ? t('followup_none_overdue') : t('followup_none_week')} />;

            const total = rows.reduce((n, f) => n + (tab === 'overdue' ? f.overdue_amount : f.next_due_amount ?? 0), 0);
            return (
              <>
                <p className="muted num" style={{ padding: '0 2px' }}>{t('followup_count', { n: rows.length })} · <strong>{formatINR(total)}</strong></p>
                <div className="list">
                  {rows.map((f) => {
                    const s = studentOf(f.student_id);
                    if (!s) return null;
                    const overdue = tab === 'overdue';
                    const amount = overdue ? f.overdue_amount : f.next_due_amount ?? 0;
                    const date = (overdue ? f.oldest_overdue_date : f.next_due_date) ?? today;
                    const phone = s.whatsapp ?? s.phone;
                    const link = phone ? waLink(phone, reminderMessage({
                      t, lang, studio, student: s.full_name, course: courseName(f.course_id), amount, date, overdue,
                    })) : null;
                    return (
                      <div key={f.enrollment_id} className="list-item">
                        <Link to={`/students/${s.id}`} className="grow" style={{ textDecoration: 'none', color: 'inherit' }}>
                          <span className="title" style={{ display: 'block' }}>{s.full_name}</span>
                          <span className="sub" style={{ display: 'block' }}>{courseName(f.course_id)}</span>
                          <span className={`small num ${overdue ? 'text-danger' : ''}`} style={{ fontWeight: 700 }}>
                            {formatINR(amount)} · {overdue ? t('since', { date: formatDate(date, lang, false) }) : formatDate(date, lang, false)}
                          </span>
                        </Link>
                        {link && (
                          <a className="icon-btn icon-btn-wa" href={link} target="_blank" rel="noopener" aria-label={t('remind')}><Bell /></a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            );
          }}
        </Loaded>
      </Page>
    </>
  );
}

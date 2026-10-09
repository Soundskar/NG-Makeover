import { AlertCircle, ChevronRight, UserPlus } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMe } from '../../auth/auth';
import { Empty, Initials, Loaded, Page, SearchInput, TopBar } from '../../components/ui';
import { useI18n } from '../../i18n/i18n';
import { formatDate, formatTime, todayIST } from '../../lib/dates';
import { formatINR } from '../../lib/money';
import { nameOf, type FeeStatus, type StudentStatus } from '../../lib/types';
import { normalizePhone } from '../../lib/whatsapp';
import { useCourses, useFeeStatus, useSettings, useStudents } from './data';

export default function StudentsPage() {
  const me = useMe();
  const { t, lang } = useI18n();
  const students = useStudents();
  const courses = useCourses();
  const settings = useSettings();
  const fees = useFeeStatus(me.is_owner);
  // Search and tab live in the address, so coming Back from a student keeps them.
  const [params, setParams] = useSearchParams();
  const search = params.get('q') ?? '';
  const tab: StudentStatus = params.get('tab') === 'completed' || params.get('tab') === 'left' ? params.get('tab') as StudentStatus : 'active';
  const update = (q: string, tb: StudentStatus) => {
    const next: Record<string, string> = {};
    if (q) next.q = q;
    if (tb !== 'active') next.tab = tb;
    setParams(next, { replace: true });
  };
  const setSearch = (q: string) => update(q, tab);
  const setTab = (tb: StudentStatus) => update(search, tb);

  const feeByEnrollment = useMemo(() => {
    const m = new Map<string, FeeStatus>();
    for (const f of fees.data ?? []) m.set(f.enrollment_id, f);
    return m;
  }, [fees.data]);

  const overdueCount = (fees.data ?? []).filter((f) => f.overdue_amount > 0 && f.enrollment_status !== 'left').length;

  return (
    <>
      <TopBar title={t('nav_students')} actions={me.is_owner && (
        <Link to="/students/new" className="icon-btn" aria-label={t('adm_title')}><UserPlus /></Link>
      )} />
      <Page>
        {me.is_owner && overdueCount > 0 && (
          <Link to="/fees" className="notice notice-danger" style={{ textDecoration: 'none' }}>
            <AlertCircle />
            <span className="grow">{t('students_overdue_banner', { n: overdueCount })}</span>
            <ChevronRight />
          </Link>
        )}

        <SearchInput value={search} onChange={setSearch} placeholder={t('students_search')} />

        {me.is_owner && (
          <div className="tabs" role="tablist">
            {(['active', 'completed', 'left'] as const).map((s) => (
              <button key={s} role="tab" className="tab" aria-selected={tab === s} onClick={() => setTab(s)}>
                {t(`student_status_${s}`)}
              </button>
            ))}
          </div>
        )}

        <Loaded q={students}>
          {(all) => {
            const q = search.trim().toLowerCase();
            const digits = normalizePhone(search) ?? search.replace(/\D/g, '');
            const list = all.filter((s) => {
              if (q) {
                return s.full_name.toLowerCase().includes(q)
                  || (digits.length >= 4 && ((s.phone ?? '').includes(digits) || (s.whatsapp ?? '').includes(digits)));
              }
              return me.is_owner ? s.status === tab : s.status === 'active';
            });
            if (list.length === 0) {
              return all.length === 0 && me.is_owner
                ? (
                  <div className="stack">
                    <Empty title={t('students_empty')} sub={t('students_empty_sub')} />
                    <Link to="/students/new" className="btn btn-primary btn-lg btn-block"><UserPlus /> {t('adm_title')}</Link>
                  </div>
                )
                : <Empty title={t('students_none_match')} />;
            }
            const today = todayIST();
            return (
              <div className="list">
                {list.map((s) => {
                  const current = s.enrollments.filter((e) => e.status === 'active' || e.status === 'paused');
                  const shown = current.length ? current : s.enrollments.slice(0, 1);
                  const courseNames = shown
                    .map((e) => courses.data?.courses.find((c) => c.id === e.course_id))
                    .filter(Boolean).map((c) => nameOf(c!, lang)).join(', ');
                  const slot = shown[0]?.slot_id ? settings.data?.slots.find((x) => x.id === shown[0]!.slot_id) : null;
                  const f = shown.map((e) => feeByEnrollment.get(e.id)).filter(Boolean) as FeeStatus[];
                  const overdue = f.reduce((n, x) => n + x.overdue_amount, 0);
                  const balance = f.reduce((n, x) => n + x.balance, 0);
                  const nextDue = f.map((x) => x.next_due_date).filter(Boolean).sort()[0];
                  const badge = !me.is_owner || f.length === 0 ? null
                    : overdue > 0 ? <span className="badge badge-danger">{t('fee_overdue_amt', { amount: formatINR(overdue) })}</span>
                      : balance === 0 ? <span className="badge badge-success">{t('fee_clear')}</span>
                        : nextDue && nextDue <= today ? <span className="badge badge-warning">{t('fee_due_today')}</span>
                          : nextDue ? <span className="badge badge-neutral">{t('fee_next_short', { date: formatDate(nextDue, lang, false) })}</span> : null;
                  return (
                    <Link key={s.id} to={`/students/${s.id}`} className="list-item">
                      <Initials name={s.full_name} />
                      <span className="grow">
                        <span className="title" style={{ display: 'block' }}>{s.full_name}</span>
                        <span className="sub" style={{ display: 'block' }}>
                          {courseNames}
                          {slot && ` · ${formatTime(slot.start_time, lang)}`}
                        </span>
                      </span>
                      {badge && <span className="end">{badge}</span>}
                      <ChevronRight className="chev" />
                    </Link>
                  );
                })}
              </div>
            );
          }}
        </Loaded>
      </Page>
    </>
  );
}

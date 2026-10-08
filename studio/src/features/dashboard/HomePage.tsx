import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CalendarCheck, ChevronRight, HardDriveDownload, Lock, Plus, UserPlus, UserX } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useMe } from '../../auth/auth';
import { Money, Page } from '../../components/ui';
import { useI18n } from '../../i18n/i18n';
import { addDays, daysBetween, formatDate, formatWeekday, monthStart, todayIST } from '../../lib/dates';
import { formatINR, sum } from '../../lib/money';
import { isScheduledOn } from '../../lib/schedule';
import { must, supabase } from '../../lib/supabase';
import type { Attendance } from '../../lib/types';
import { summarizeDay, useClosing, useVisits } from '../salon/data';
import { useActiveEnrollments, useFeeStatus, useSettings } from '../students/data';

export default function HomePage() {
  const me = useMe();
  const { t, lang } = useI18n();
  const today = todayIST();
  const yesterday = addDays(today, -1);

  const visits = useVisits(today);
  const yVisits = useVisits(yesterday);
  const yClosing = useClosing(yesterday);
  const fees = useFeeStatus(true);
  const settings = useSettings();
  const enrollments = useActiveEnrollments();
  const collected = useQuery({
    queryKey: ['home', 'collected', today],
    queryFn: async () => {
      const rows = must(await supabase.from('payments').select('amount, paid_on')
        .gte('paid_on', monthStart(today)).eq('voided', false)) as { amount: number; paid_on: string }[];
      return { month: sum(rows.map((r) => r.amount)), today: sum(rows.filter((r) => r.paid_on === today).map((r) => r.amount)) };
    },
  });
  const recentAttendance = useQuery({
    queryKey: ['home', 'attendance', today],
    queryFn: async () => must(await supabase.from('attendance').select('*').gte('day', addDays(today, -21))
      .order('day', { ascending: false })) as Attendance[],
  });

  const salon = visits.data ? summarizeDay(visits.data) : null;
  const active = (fees.data ?? []).filter((f) => f.enrollment_status !== 'left' && f.balance > 0);
  const overdue = active.filter((f) => f.overdue_amount > 0);
  const dueWeek = active.filter((f) => f.overdue_amount === 0 && f.next_due_date && f.next_due_date <= addDays(today, 7));

  const holiday = settings.data?.holidays.some((h) => h.day === today);
  const scheduled = holiday ? [] : (enrollments.data ?? []).filter((e) => isScheduledOn(e, today));
  const markedToday = new Set((recentAttendance.data ?? []).filter((a) => a.day === today).map((a) => a.enrollment_id));
  const marked = scheduled.filter((e) => markedToday.has(e.id)).length;

  // Students whose last two marked classes were both absences.
  const absentTwice = (enrollments.data ?? []).filter((e) => {
    const recs = (recentAttendance.data ?? []).filter((a) => a.enrollment_id === e.id).slice(0, 2);
    return recs.length === 2 && recs.every((r) => r.status === 'absent');
  });
  const ending = (enrollments.data ?? []).filter((e) => e.expected_end_date <= addDays(today, 7));

  const lastBackup = settings.data?.settings.last_backup_at;
  const backupDays = lastBackup ? daysBetween(lastBackup.slice(0, 10), today) : null;
  const hasData = (enrollments.data?.length ?? 0) > 0 || (salon?.count ?? 0) > 0;

  const alerts: { key: string; to: string; icon: ReactNode; text: string; tone: 'danger' | 'warning' }[] = [];
  if (yVisits.data && summarizeDay(yVisits.data).count > 0 && yClosing.isSuccess && !yClosing.data) {
    alerts.push({ key: 'close', to: `/salon/close?day=${yesterday}`, icon: <Lock />, text: t('alert_not_closed'), tone: 'warning' });
  }
  for (const e of absentTwice.slice(0, 3)) {
    alerts.push({ key: `abs-${e.id}`, to: `/students/${e.student_id}`, icon: <UserX />, text: t('alert_absent', { name: e.students.full_name }), tone: 'warning' });
  }
  if (absentTwice.length > 3) {
    alerts.push({ key: 'abs-more', to: '/classes', icon: <UserX />, text: t('alert_absent_more', { n: absentTwice.length - 3 }), tone: 'warning' });
  }
  if (ending.length) {
    alerts.push({ key: 'ending', to: '/fees', icon: <CalendarCheck />, text: t('alert_ending', { n: ending.length }), tone: 'warning' });
  }
  if (settings.isSuccess && hasData && (backupDays == null || backupDays >= 7)) {
    alerts.push({
      key: 'backup', to: '/more/backup', icon: <HardDriveDownload />, tone: 'warning',
      text: backupDays == null ? t('alert_backup_never') : t('alert_backup', { n: backupDays }),
    });
  }

  return (
    <Page>
      <header className="stack" style={{ gap: 0, paddingTop: 8 }}>
        <h1 style={{ fontSize: '1.625rem', fontWeight: 800 }}>{t('greeting', { name: me.display_name.split(' ')[0] ?? '' })}</h1>
        <p className="muted">{formatWeekday(today, lang)}, {formatDate(today, lang)}</p>
      </header>

      {alerts.length > 0 && (
        <section className="stack" aria-label={t('home_attention')}>
          {alerts.map((a) => (
            <Link key={a.key} to={a.to} className={`notice notice-${a.tone}`} style={{ textDecoration: 'none' }}>
              {a.icon}<span className="grow">{a.text}</span><ChevronRight />
            </Link>
          ))}
        </section>
      )}

      <Link to="/salon" className="card-link stack" style={{ gap: 2 }}>
        <div className="row-between"><span className="stat-label">{t('home_salon_today')}</span><ChevronRight className="chev" /></div>
        <Money n={salon?.total ?? 0} className="stat-value" />
        <span className="stat-sub num">
          {salon ? `${t('cash')} ${formatINR(salon.cash)} · ${t('upi')} ${formatINR(salon.upi)} · ${t('salon_entries', { n: salon.count })}` : '…'}
        </span>
      </Link>

      <div className="stat-grid">
        <Link to="/fees" className="card-link stack" style={{ gap: 2 }}>
          <span className="stat-label">{t('home_overdue')}</span>
          <span className={`stat-value num ${overdue.length ? 'text-danger' : ''}`}>{overdue.length}</span>
          <span className="stat-sub num">{formatINR(sum(overdue.map((f) => f.overdue_amount)))}</span>
        </Link>
        <Link to="/fees" className="card-link stack" style={{ gap: 2 }}>
          <span className="stat-label">{t('home_due_week')}</span>
          <span className="stat-value num">{dueWeek.length}</span>
          <span className="stat-sub num">{formatINR(sum(dueWeek.map((f) => f.next_due_amount ?? 0)))}</span>
        </Link>
      </div>

      <div className="card stack" style={{ gap: 2 }}>
        <span className="stat-label">{t('home_fees_month')}</span>
        <Money n={collected.data?.month ?? 0} className="stat-value" />
        <span className="stat-sub num">{t('home_fees_today', { amount: formatINR(collected.data?.today ?? 0) })}</span>
      </div>

      <Link to="/classes" className="card-link stack" style={{ gap: 2 }}>
        <div className="row-between"><span className="stat-label">{t('home_classes_today')}</span><ChevronRight className="chev" /></div>
        <span className="stat-value num">{scheduled.length}</span>
        <span className="stat-sub">
          {holiday ? t('weekly_off_today') : scheduled.length ? t('classes_marked', { done: marked, total: scheduled.length }) : t('classes_none')}
        </span>
      </Link>

      <div className="stat-grid">
        <Link to="/students/new" className="btn btn-soft btn-lg" style={{ whiteSpace: 'normal' }}><UserPlus /> {t('adm_title')}</Link>
        <Link to="/salon/new" className="btn btn-soft btn-lg" style={{ whiteSpace: 'normal' }}><Plus /> {t('nav_new_entry')}</Link>
      </div>

      {(fees.error || visits.error) && (
        <div className="notice notice-danger"><AlertTriangle /><span>{t('err_generic')}</span></div>
      )}
    </Page>
  );
}

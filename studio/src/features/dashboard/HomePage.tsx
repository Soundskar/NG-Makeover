import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle, BellRing, Cake, CalendarCheck, CalendarClock, ChevronRight, HandCoins, HardDriveDownload, Lock, PhoneCall, Plus, UserPlus, Users, UserX,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useMe } from '../../auth/auth';
import { Greeting, Money, Page } from '../../components/ui';
import { useI18n } from '../../i18n/i18n';
import { addDays, daysBetween, daysUntilBirthday, formatTime, todayIST, weekdayOf } from '../../lib/dates';
import { formatINR, sum } from '../../lib/money';
import { isScheduledOn } from '../../lib/schedule';
import { must, supabase } from '../../lib/supabase';
import type { Attendance } from '../../lib/types';
import { useBookings } from '../bookings/data';
import { useClientList } from '../clients/data';
import { useClientsDue } from '../salon/CallbackPage';
import { summarizeDay, useClosing, useUdhaarStatus, useVisits } from '../salon/data';
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
  const udhaar = useUdhaarStatus();
  const dueCount = useClientsDue().data?.length ?? 0;
  const tomorrow = addDays(today, 1);
  const soon = useBookings(today, tomorrow).data?.bookings ?? [];
  const todayBookings = soon.filter((b) => b.day === today && b.status === 'booked');
  const toRemind = soon.filter((b) => b.day === tomorrow && b.status === 'booked' && !b.reminded_on);
  const birthdaysToday = (useClientList().data ?? []).filter((c) => c.birth_day && c.birth_month
    && daysUntilBirthday(c.birth_day, c.birth_month, today) === 0);
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
  const weeklyOff = settings.data?.settings.weekly_off != null
    && settings.data.settings.weekly_off === weekdayOf(today);
  const scheduled = holiday || weeklyOff ? [] : (enrollments.data ?? []).filter((e) => isScheduledOn(e, today));
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

  // One list of what needs doing, most urgent first. Each row says what and how much.
  const alerts: { key: string; to: string; icon: ReactNode; text: string; tone: 'danger' | 'warning' | 'info' }[] = [];
  if (yVisits.data && summarizeDay(yVisits.data).count > 0 && yClosing.isSuccess && !yClosing.data) {
    alerts.push({ key: 'close', to: `/salon/close?day=${yesterday}`, icon: <Lock />, text: t('alert_not_closed'), tone: 'warning' });
  }
  if (overdue.length) {
    alerts.push({
      key: 'overdue', to: '/fees', icon: <AlertTriangle />, tone: 'danger',
      text: t('home_overdue_row', { n: overdue.length, amount: formatINR(sum(overdue.map((f) => f.overdue_amount))) }),
    });
  }
  if (toRemind.length) {
    alerts.push({ key: 'remind', to: `/bookings?d=${tomorrow}`, icon: <BellRing />, tone: 'info', text: t('bookings_remind_tomorrow', { n: toRemind.length }) });
  }
  if (dueWeek.length) {
    alerts.push({
      key: 'week', to: '/fees?tab=week', icon: <CalendarClock />, tone: 'warning',
      text: t('home_due_week_row', { n: dueWeek.length, amount: formatINR(sum(dueWeek.map((f) => f.next_due_amount ?? 0))) }),
    });
  }
  // Udhaar that has waited more than a week deserves a reminder.
  const oldUdhaar = (udhaar.data ?? []).filter((u) => u.outstanding > 0 && u.visit_date <= addDays(today, -7));
  if (oldUdhaar.length) {
    alerts.push({
      key: 'udhaar', to: '/salon/udhaar', icon: <HandCoins />, tone: 'warning',
      text: t('alert_udhaar_old', { amount: formatINR(sum(oldUdhaar.map((u) => u.outstanding))) }),
    });
  }
  for (const e of absentTwice.slice(0, 3)) {
    alerts.push({ key: `abs-${e.id}`, to: `/students/${e.student_id}`, icon: <UserX />, text: t('alert_absent', { name: e.students.full_name }), tone: 'warning' });
  }
  if (absentTwice.length > 3) {
    alerts.push({ key: 'abs-more', to: '/classes', icon: <UserX />, text: t('alert_absent_more', { n: absentTwice.length - 3 }), tone: 'warning' });
  }
  if (ending.length) {
    alerts.push({ key: 'ending', to: '/fees?tab=ending', icon: <CalendarCheck />, text: t('alert_ending', { n: ending.length }), tone: 'info' });
  }
  for (const c of birthdaysToday.slice(0, 2)) {
    alerts.push({ key: `bday-${c.phone}`, to: '/clients', icon: <Cake />, tone: 'info', text: t('birthday_alert', { name: c.name ?? c.phone }) });
  }
  if (dueCount > 0) {
    alerts.push({ key: 'callback', to: '/salon/callback', icon: <PhoneCall />, tone: 'info', text: t('callback_alert', { n: dueCount }) });
  }
  if (settings.isSuccess && hasData && (backupDays == null || backupDays >= 7)) {
    alerts.push({
      key: 'backup', to: '/more/backup', icon: <HardDriveDownload />, tone: 'warning',
      text: backupDays == null ? t('alert_backup_never') : t('alert_backup', { n: backupDays }),
    });
  }
  const loaded = fees.isSuccess && visits.isSuccess;
  const closedToday = holiday || weeklyOff;

  return (
    <Page>
      <Greeting name={me.display_name} />

      <div className="home-actions">
        <Link to="/salon/new" className="btn btn-primary"><Plus /> {t('nav_new_entry')}</Link>
        <Link to="/students/new" className="btn btn-secondary"><UserPlus /> {t('adm_title')}</Link>
      </div>

      <Link to="/salon" className="card-link hero stack" style={{ gap: 2 }}>
        <div className="row-between"><span className="stat-label">{t('home_salon_today')}</span><ChevronRight className="chev" /></div>
        <Money n={salon?.total ?? 0} className="stat-value" animate />
        <span className="stat-sub num">
          {salon
            ? [
              t('salon_entries', { n: salon.count }),
              salon.cash ? `${t('cash')} ${formatINR(salon.cash)}` : null,
              salon.upi ? `${t('upi')} ${formatINR(salon.upi)}` : null,
              salon.card ? `${t('card')} ${formatINR(salon.card)}` : null,
              salon.udhaar ? `${t('udhaar')} ${formatINR(salon.udhaar)}` : null,
            ].filter(Boolean).join(' · ')
            : '…'}
        </span>
      </Link>

      {(todayBookings.length > 0 || scheduled.length > 0 || closedToday) && (
        <section className="stack" style={{ gap: 8 }}>
          <h2 className="section-title">{t('home_today')}</h2>
          <div className="list">
            {todayBookings.map((b) => (
              <Link key={b.id} to={`/bookings?d=${today}`} className="list-item">
                <strong className="num home-time">{formatTime(b.start_time, lang)}</strong>
                <span className="grow">
                  <span className="title" style={{ display: 'block' }}>{b.client_name}</span>
                  {b.services_text && <span className="sub">{b.services_text}</span>}
                </span>
                <ChevronRight className="chev" />
              </Link>
            ))}
            {scheduled.length > 0 && (
              <Link to="/classes" className="list-item">
                <span className="row-icon"><Users /></span>
                <span className="grow">{t('home_classes_row', { done: marked, total: scheduled.length })}</span>
                <ChevronRight className="chev" />
              </Link>
            )}
            {closedToday && <div className="list-item muted">{t('weekly_off_today')}</div>}
          </div>
        </section>
      )}

      <section className="stack" style={{ gap: 8 }}>
        <h2 className="section-title">{t('home_attention')}</h2>
        {alerts.length > 0 ? (
          <div className="list">
            {alerts.map((a) => (
              <Link key={a.key} to={a.to} className="list-item">
                <span className={`row-icon ${a.tone}`}>{a.icon}</span>
                <span className="grow">{a.text}</span>
                <ChevronRight className="chev" />
              </Link>
            ))}
          </div>
        ) : loaded && <p className="muted" style={{ padding: '0 2px' }}>{t('home_all_clear')}</p>}
      </section>

      {(fees.error || visits.error) && (
        <div className="notice notice-danger"><AlertTriangle /><span>{t('err_generic')}</span></div>
      )}
    </Page>
  );
}

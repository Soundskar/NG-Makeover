import { MessageCircle, Phone } from 'lucide-react';
import { useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useMe, useTeamNames } from '../../auth/auth';
import { Loaded, Page, TopBar } from '../../components/ui';
import { useI18n } from '../../i18n/i18n';
import { formatDate, formatTime, weekdayName } from '../../lib/dates';
import { WEEK_ORDER } from '../../lib/schedule';
import { nameOf } from '../../lib/types';
import { formatPhone, telLink, waLink } from '../../lib/whatsapp';
import { AttendanceTab } from './AttendanceTab';
import { useCourses, useSettings, useStudent } from './data';
import { DetailsTab } from './DetailsTab';
import { FeesTab } from './FeesTab';
import { ProgressTab } from './ProgressTab';

type Tab = 'fees' | 'attendance' | 'progress' | 'details';

export default function StudentPage() {
  const { id = '' } = useParams();
  const me = useMe();
  const { t, lang } = useI18n();
  const location = useLocation();
  const receiptFor = (location.state as { receiptFor?: string } | null)?.receiptFor ?? null;
  const q = useStudent(id, me.is_owner);
  const courses = useCourses();
  const settings = useSettings();
  const teamName = useTeamNames();
  const [tab, setTab] = useState<Tab>(me.is_owner ? 'fees' : 'attendance');
  const [enrollmentId, setEnrollmentId] = useState<string | null>(null);

  const tabs: Tab[] = me.is_owner ? ['fees', 'attendance', 'progress', 'details'] : ['attendance', 'progress'];

  return (
    <>
      <TopBar title={q.data?.student.full_name ?? t('nav_students')} back="/students" />
      <Page>
        <Loaded q={q}>
          {(data) => {
            const { student, enrollments } = data;
            const enr = enrollments.find((e) => e.id === enrollmentId) ?? enrollments[0];
            const course = enr && courses.data?.courses.find((c) => c.id === enr.course_id);
            const slot = enr?.slot_id ? settings.data?.slots.find((s) => s.id === enr.slot_id) : null;
            const phone = student.whatsapp ?? student.phone;
            return (
              <>
                {enrollments.length > 1 && (
                  <div className="chips" role="toolbar" aria-label={t('adm_step_course')}>
                    {enrollments.map((e) => {
                      const c = courses.data?.courses.find((x) => x.id === e.course_id);
                      return (
                        <button key={e.id} className="chip" aria-pressed={e.id === enr?.id} onClick={() => setEnrollmentId(e.id)}>
                          {c ? nameOf(c, lang) : '…'}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* One card: the course she's on, when she comes, and a quick way to reach her. */}
                <div className="card stack" style={{ gap: 10 }}>
                  {enr ? (
                    <div className="row" style={{ alignItems: 'flex-start' }}>
                      <span className="grow stack" style={{ gap: 2 }}>
                        <strong>{course ? nameOf(course, lang) : ''}</strong>
                        <span className="small">
                          {slot ? `${formatTime(slot.start_time, lang)}–${formatTime(slot.end_time, lang)} · ` : ''}
                          {WEEK_ORDER.filter((d) => enr.days_of_week.includes(d)).map((d) => weekdayName(d, lang)).join(', ')}
                        </span>
                        <span className="muted small">
                          {formatDate(enr.start_date, lang)} → {formatDate(enr.completed_on ?? enr.expected_end_date, lang)}
                          {enr.trainer_ids.length > 0 ? ` · ${t('trainer')}: ${enr.trainer_ids.map(teamName).join(', ')}` : ''}
                        </span>
                      </span>
                      <span className={`badge ${enr.status === 'active' ? 'badge-primary' : 'badge-neutral'}`}>{t(`enr_status_${enr.status}`)}</span>
                    </div>
                  ) : (
                    <span className={`badge ${student.status === 'active' ? 'badge-success' : 'badge-neutral'}`} style={{ alignSelf: 'flex-start' }}>
                      {t(`student_status_${student.status}`)}
                    </span>
                  )}
                  {(student.phone || phone) && (
                    <div className="row" style={{ gap: 8, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                      <span className="grow muted num">{formatPhone(student.phone ?? phone!)}</span>
                      {student.phone && telLink(student.phone) && (
                        <a className="icon-btn icon-btn-fill" href={telLink(student.phone)!} aria-label={t('call')}><Phone /></a>
                      )}
                      {phone && waLink(phone, '') && (
                        <a className="icon-btn icon-btn-wa" href={waLink(phone, '')!} target="_blank" rel="noopener" aria-label="WhatsApp">
                          <MessageCircle />
                        </a>
                      )}
                    </div>
                  )}
                </div>

                <div className="tabs" role="tablist">
                  {tabs.map((x) => (
                    <button key={x} role="tab" className="tab" aria-selected={tab === x} onClick={() => setTab(x)}>
                      {t(`tab_${x}`)}
                    </button>
                  ))}
                </div>

                {!enr ? null
                  : tab === 'fees' ? <FeesTab data={data} enrollment={enr} course={course ?? null} receiptFor={receiptFor} />
                    : tab === 'attendance' ? <AttendanceTab data={data} enrollment={enr} />
                      : tab === 'progress' ? <ProgressTab data={data} enrollment={enr} />
                        : <DetailsTab data={data} enrollment={enr} />}
              </>
            );
          }}
        </Loaded>
      </Page>
    </>
  );
}

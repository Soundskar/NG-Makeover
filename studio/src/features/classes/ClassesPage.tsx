import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarOff, CheckCheck, ChevronLeft, ChevronRight, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Empty, ErrorBox, Loaded, Page, SearchInput, Sheet, TopBar } from '../../components/ui';
import { useI18n } from '../../i18n/i18n';
import { addDays, formatDate, formatTime, formatWeekday, todayIST, weekdayOf } from '../../lib/dates';
import { isScheduledOn } from '../../lib/schedule';
import { must, supabase } from '../../lib/supabase';
import { nameOf, type Attendance, type AttendanceStatus } from '../../lib/types';
import { AttendanceButtons } from '../students/AttendanceTab';
import { useActiveEnrollments, useCourses, useSettings } from '../students/data';

/** Trainers and owner: who is expected today, and marking attendance. */
export default function ClassesPage() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const today = todayIST();
  const [day, setDay] = useState(today);
  const [extraOpen, setExtraOpen] = useState(false);
  const enrollments = useActiveEnrollments();
  const settings = useSettings();
  const courses = useCourses();
  const attendance = useQuery({
    queryKey: ['attendance', day],
    queryFn: async () => must(await supabase.from('attendance').select('*').eq('day', day)) as Attendance[],
  });

  const mark = useMutation({
    mutationFn: async (rows: { enrollment_id: string; status: AttendanceStatus; extra: boolean }[]) =>
      must(await supabase.from('attendance').upsert(rows.map((r) => ({ ...r, day, marked_at: new Date().toISOString() })))),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance', day] });
      qc.invalidateQueries({ queryKey: ['student'] });
      qc.invalidateQueries({ queryKey: ['home'] });
    },
  });

  const holiday = settings.data?.holidays.find((h) => h.day === day);
  const weeklyOff = settings.data?.settings.weekly_off === weekdayOf(day);

  return (
    <>
      <TopBar title={t('classes_title')} />
      <Page>
        <div className="row-between">
          <button className="icon-btn" aria-label={t('prev_day')} onClick={() => setDay(addDays(day, -1))}><ChevronLeft /></button>
          <div className="center">
            <div style={{ fontWeight: 700 }}>{day === today ? t('today') : formatWeekday(day, lang)}</div>
            <div className="muted small">{formatDate(day, lang)}</div>
          </div>
          <button className="icon-btn" aria-label={t('next_day')} style={{ visibility: day >= today ? 'hidden' : 'visible' }}
            onClick={() => setDay(addDays(day, 1))}><ChevronRight /></button>
        </div>

        {(holiday || weeklyOff) && (
          <div className="notice notice-info"><CalendarOff /><span>{holiday ? t('holiday_named', { name: holiday.name }) : t('weekly_off_today')}</span></div>
        )}
        {mark.error && <ErrorBox error={mark.error} />}

        <Loaded q={enrollments}>
          {(all) => {
            const marks = new Map((attendance.data ?? []).map((a) => [a.enrollment_id, a]));
            const scheduled = holiday || weeklyOff ? [] : all.filter((e) => isScheduledOn(e, day));
            const extras = all.filter((e) => !scheduled.includes(e) && marks.has(e.id));
            const slots = settings.data?.slots ?? [];
            const groups = new Map<string, typeof scheduled>();
            for (const e of scheduled) {
              const k = e.slot_id ?? 'none';
              groups.set(k, [...(groups.get(k) ?? []), e]);
            }
            const ordered = [...groups.entries()].sort(([a], [b]) => {
              const sa = slots.find((s) => s.id === a)?.start_time ?? '99';
              const sb = slots.find((s) => s.id === b)?.start_time ?? '99';
              return sa.localeCompare(sb);
            });
            const courseName = (id: string) => {
              const c = courses.data?.courses.find((x) => x.id === id);
              return c ? nameOf(c, lang) : '';
            };
            const markedCount = scheduled.filter((e) => marks.has(e.id)).length;

            const renderRow = (e: typeof all[number], extra: boolean) => (
              <div key={e.id} className="card stack" style={{ gap: 8 }}>
                <Link to={`/students/${e.student_id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <span style={{ fontWeight: 700 }}>{e.students.full_name}</span>
                  <span className="muted small"> · {courseName(e.course_id)}{extra ? ` · ${t('extra_class')}` : ''}</span>
                </Link>
                <AttendanceButtons value={marks.get(e.id)?.status ?? null} disabled={mark.isPending}
                  onChange={(status) => mark.mutate([{ enrollment_id: e.id, status, extra }])} />
              </div>
            );

            return (
              <>
                {scheduled.length > 0 && (
                  <p className="muted">{t('classes_marked', { done: markedCount, total: scheduled.length })}</p>
                )}
                {scheduled.length === 0 && extras.length === 0 && !holiday && !weeklyOff && <Empty title={t('classes_none')} />}
                {ordered.map(([slotId, list]) => {
                  const slot = slots.find((s) => s.id === slotId);
                  const unmarked = list.filter((e) => !marks.has(e.id));
                  return (
                    <section key={slotId} className="stack">
                      <div className="row-between">
                        <h2 className="section-title num">
                          {slot ? `${formatTime(slot.start_time, lang)} – ${formatTime(slot.end_time, lang)}` : t('slot_none')}
                        </h2>
                        {unmarked.length > 0 && (
                          <button className="btn btn-sm btn-soft" disabled={mark.isPending}
                            onClick={() => mark.mutate(unmarked.map((e) => ({ enrollment_id: e.id, status: 'present', extra: false })))}>
                            <CheckCheck /> {t('mark_all_present')}
                          </button>
                        )}
                      </div>
                      {list.sort((a, b) => a.students.full_name.localeCompare(b.students.full_name)).map((e) => renderRow(e, false))}
                    </section>
                  );
                })}
                {extras.length > 0 && (
                  <section className="stack">
                    <h2 className="section-title">{t('extra_class')}</h2>
                    {extras.map((e) => renderRow(e, true))}
                  </section>
                )}
                <button className="btn btn-secondary btn-block" onClick={() => setExtraOpen(true)}>
                  <UserPlus /> {t('add_extra')}
                </button>
                {extraOpen && (
                  <ExtraSheet
                    options={all.filter((e) => !scheduled.includes(e) && !marks.has(e.id))
                      .map((e) => ({ id: e.id, name: e.students.full_name, course: courseName(e.course_id) }))}
                    onPick={(id) => { mark.mutate([{ enrollment_id: id, status: 'present', extra: true }]); setExtraOpen(false); }}
                    onClose={() => setExtraOpen(false)}
                  />
                )}
              </>
            );
          }}
        </Loaded>
      </Page>
    </>
  );
}

function ExtraSheet({ options, onPick, onClose }: {
  options: { id: string; name: string; course: string }[]; onPick: (id: string) => void; onClose: () => void;
}) {
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const list = options.filter((o) => o.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <Sheet open onClose={onClose} title={t('add_extra')}>
      <div className="stack">
        <SearchInput value={q} onChange={setQ} placeholder={t('students_search')} />
        {list.length === 0 ? <Empty title={t('students_none_match')} /> : (
          <div className="list">
            {list.map((o) => (
              <button key={o.id} className="list-item" onClick={() => onPick(o.id)}>
                <span className="grow"><span className="title" style={{ display: 'block' }}>{o.name}</span><span className="sub">{o.course}</span></span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}

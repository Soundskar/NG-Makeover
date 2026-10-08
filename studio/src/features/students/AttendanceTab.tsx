import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ErrorBox } from '../../components/ui';
import { useI18n } from '../../i18n/i18n';
import { formatDate, formatWeekday, todayIST, weekdayOf } from '../../lib/dates';
import { must, supabase } from '../../lib/supabase';
import type { AttendanceStatus, Enrollment } from '../../lib/types';
import type { StudentFull } from './data';

const badge = { present: 'badge-success', absent: 'badge-danger', leave: 'badge-neutral' } as const;

export function attendancePct(records: { status: AttendanceStatus }[]): number | null {
  const present = records.filter((r) => r.status === 'present').length;
  const absent = records.filter((r) => r.status === 'absent').length;
  return present + absent === 0 ? null : Math.round((present / (present + absent)) * 100);
}

export function AttendanceTab({ data, enrollment }: { data: StudentFull; enrollment: Enrollment }) {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const today = todayIST();
  const records = data.attendance.filter((a) => a.enrollment_id === enrollment.id);
  const todays = records.find((r) => r.day === today);
  const pct = attendancePct(records);
  const count = (s: AttendanceStatus) => records.filter((r) => r.status === s).length;

  const mark = useMutation({
    mutationFn: async (status: AttendanceStatus) => must(await supabase.from('attendance').upsert({
      enrollment_id: enrollment.id, day: today, status,
      extra: !enrollment.days_of_week.includes(weekdayOf(today)),
    })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student'] });
      qc.invalidateQueries({ queryKey: ['attendance'] });
    },
  });

  return (
    <div className="stack-lg">
      <div className="card stack" style={{ gap: 4 }}>
        <div className="stat-label">{t('attendance')}</div>
        <div className="stat-value num">{pct == null ? '—' : `${pct}%`}</div>
        <div className="stat-sub">
          {t('present')} {count('present')} · {t('absent')} {count('absent')} · {t('leave')} {count('leave')}
        </div>
      </div>

      {enrollment.status === 'active' && (
        <section className="stack">
          <h2 className="section-title">{t('today')}</h2>
          <AttendanceButtons value={todays?.status ?? null} onChange={(s) => mark.mutate(s)} disabled={mark.isPending} />
          {mark.error && <ErrorBox error={mark.error} />}
        </section>
      )}

      <section className="stack">
        <h2 className="section-title">{t('attendance_history')}</h2>
        {records.length === 0 ? <p className="muted">{t('attendance_none')}</p> : (
          <div className="list">
            {records.slice(0, 60).map((r) => (
              <div key={r.day} className="list-item" style={{ minHeight: 52 }}>
                <span className="grow">
                  {formatDate(r.day, lang)} <span className="muted small">· {formatWeekday(r.day, lang, 'short')}</span>
                  {r.extra && <span className="muted small"> · {t('extra_class')}</span>}
                </span>
                <span className={`badge ${badge[r.status]}`}>{t(r.status)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/** Present / Absent / Leave as three big buttons with words. */
export function AttendanceButtons({ value, onChange, disabled }: {
  value: AttendanceStatus | null; onChange: (s: AttendanceStatus) => void; disabled?: boolean;
}) {
  const { t } = useI18n();
  const style = (s: AttendanceStatus) => value !== s ? undefined
    : s === 'present' ? { background: 'var(--success-soft)', borderColor: 'var(--success)', color: 'var(--success)' }
      : s === 'absent' ? { background: 'var(--danger-soft)', borderColor: 'var(--danger)', color: 'var(--danger)' }
        : { background: 'var(--surface-2)', borderColor: 'var(--text-2)', color: 'var(--text)' };
  return (
    <div className="choices" role="radiogroup" aria-label={t('attendance')}>
      {(['present', 'absent', 'leave'] as const).map((s) => (
        <button key={s} type="button" role="radio" aria-checked={value === s} className="choice" disabled={disabled}
          style={style(s)} onClick={() => onChange(s)}>
          {t(s)}
        </button>
      ))}
    </div>
  );
}

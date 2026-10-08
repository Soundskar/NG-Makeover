import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Award, Star } from 'lucide-react';
import { useState } from 'react';
import { useMe } from '../../auth/auth';
import { Confirm, Count, ErrorBox, Loaded, useToast } from '../../components/ui';
import { useI18n } from '../../i18n/i18n';
import { todayIST } from '../../lib/dates';
import { haptic } from '../../lib/haptics';
import { must, supabase } from '../../lib/supabase';
import { nameOf, titleOf, type CourseModule, type Enrollment, type ModuleProgress } from '../../lib/types';
import { modulesFor, useCourses, type StudentFull } from './data';

type Level = 'none' | 'learning' | 'done';

export function ProgressTab({ data, enrollment }: { data: StudentFull; enrollment: Enrollment }) {
  const me = useMe();
  const { t, lang } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const courses = useCourses();
  const [confirmDone, setConfirmDone] = useState(false);
  const progress = new Map(data.progress.filter((p) => p.enrollment_id === enrollment.id).map((p) => [p.module_id, p]));

  const setLevel = useMutation({
    mutationFn: async ({ module, level, rating }: { module: CourseModule; level: Level; rating?: number | null }) => {
      if (level === 'none') {
        must(await supabase.from('module_progress').delete().eq('enrollment_id', enrollment.id).eq('module_id', module.id));
      } else {
        must(await supabase.from('module_progress').upsert({
          enrollment_id: enrollment.id, module_id: module.id, status: level,
          rating: rating === undefined ? progress.get(module.id)?.rating ?? null : rating,
          updated_at: new Date().toISOString(),
        }));
      }
    },
    // Show the change at once; put it back if the save fails.
    onMutate: async ({ module, level, rating }) => {
      haptic(level === 'done' ? 'success' : 'tap');
      const key = ['student', data.student.id];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<StudentFull>(key);
      if (prev) {
        const rest = prev.progress.filter((p) => !(p.enrollment_id === enrollment.id && p.module_id === module.id));
        const old = progress.get(module.id);
        qc.setQueryData<StudentFull>(key, {
          ...prev,
          progress: level === 'none' ? rest : [...rest, {
            enrollment_id: enrollment.id, module_id: module.id, status: level, note: old?.note ?? null,
            rating: rating === undefined ? old?.rating ?? null : rating, updated_at: new Date().toISOString(),
          }],
        });
      }
      return { prev, key };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(ctx.key, ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ['student'] }),
  });

  const complete = useMutation({
    mutationFn: async () => {
      must(await supabase.from('enrollments').update({ status: 'completed', completed_on: todayIST() }).eq('id', enrollment.id));
      const stillActive = data.enrollments.some((e) => e.id !== enrollment.id && (e.status === 'active' || e.status === 'paused'));
      if (!stillActive) must(await supabase.from('students').update({ status: 'completed' }).eq('id', data.student.id));
    },
    onSuccess: () => {
      for (const k of ['student', 'students', 'active-enrollments']) qc.invalidateQueries({ queryKey: [k] });
      toast({ kind: 'success', text: t('course_completed') });
      setConfirmDone(false);
    },
  });

  return (
    <Loaded q={courses}>
      {({ courses: all, modules }) => {
        const course = all.find((c) => c.id === enrollment.course_id);
        if (!course) return null;
        const groups = modulesFor(course, all, modules);
        const total = groups.reduce((n, g) => n + g.modules.length, 0);
        const done = groups.reduce((n, g) => n + g.modules.filter((m) => progress.get(m.id)?.status === 'done').length, 0);
        const pct = total ? Math.round((done / total) * 100) : 0;
        return (
          <div className="stack-lg">
            <div className="card stack" style={{ gap: 6 }}>
              <div className="stat-label">{t('progress')}</div>
              <div className="stat-value num"><Count n={pct} />%</div>
              <div className={`bar ${pct === 100 ? 'success' : ''}`}><span style={{ width: `${pct}%` }} /></div>
              <div className="stat-sub">{t('modules_done', { done, total })}</div>
            </div>

            {setLevel.error && <ErrorBox error={setLevel.error} />}

            {groups.map((g) => (
              <section key={g.course.id} className="stack">
                {groups.length > 1 && <h2 className="section-title">{nameOf(g.course, lang)}</h2>}
                {g.modules.map((m) => (
                  <ModuleRow key={m.id} module={m} row={progress.get(m.id)}
                    onLevel={(level) => setLevel.mutate({ module: m, level })}
                    onRate={(rating) => setLevel.mutate({ module: m, level: 'done', rating })} />
                ))}
              </section>
            ))}

            {me.is_owner && enrollment.status === 'active' && (
              <button className="btn btn-soft btn-lg btn-block" onClick={() => setConfirmDone(true)}>
                <Award /> {t('mark_complete')}
              </button>
            )}
            <Confirm open={confirmDone} onClose={() => setConfirmDone(false)} busy={complete.isPending}
              title={t('mark_complete')}
              body={pct < 100 ? t('mark_complete_early', { pct }) : t('mark_complete_body')}
              confirmLabel={t('mark_complete')}
              onConfirm={() => complete.mutate()} />
            {complete.error && <ErrorBox error={complete.error} />}
          </div>
        );
      }}
    </Loaded>
  );
}

function ModuleRow({ module, row, onLevel, onRate }: {
  module: CourseModule; row: ModuleProgress | undefined;
  onLevel: (l: Level) => void; onRate: (r: number) => void;
}) {
  const { t, lang } = useI18n();
  const level: Level = row?.status ?? 'none';
  const color = level === 'done' ? 'var(--success)' : level === 'learning' ? 'var(--warning)' : 'var(--border)';
  return (
    <div className="card stack" style={{ gap: 10, borderLeft: `5px solid ${color}`, transition: 'border-color 0.3s' }}>
      <div>
        <div style={{ fontWeight: 700 }}>{titleOf(module, lang)}</div>
        {module.topics && <div className="muted small">{module.topics}</div>}
      </div>
      <div className="choices" role="radiogroup" aria-label={titleOf(module, lang)}>
        {(['none', 'learning', 'done'] as const).map((l) => (
          <button key={l} type="button" role="radio" aria-checked={level === l} className="choice"
            style={{ fontSize: '0.9375rem' }} onClick={() => onLevel(l)}>
            {t(`level_${l}`)}
          </button>
        ))}
      </div>
      {level === 'done' && (
        <div className="row" style={{ gap: 0 }} role="radiogroup" aria-label={t('rating')}>
          <span className="muted small" style={{ marginRight: 8 }}>{t('rating')}</span>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" className="icon-btn" role="radio" aria-checked={row?.rating === n}
              aria-label={t('rating_n', { n })} style={{ width: 40, height: 40 }} onClick={() => onRate(n)}>
              <Star fill={(row?.rating ?? 0) >= n ? 'var(--warning)' : 'none'} color="var(--warning)" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

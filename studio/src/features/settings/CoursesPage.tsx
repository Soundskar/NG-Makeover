import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronRight, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { CheckRow, ErrorBox, Field, Loaded, MoneyInput, Page, Sheet, TopBar, useToast } from '../../components/ui';
import { useI18n } from '../../i18n/i18n';
import { formatINR } from '../../lib/money';
import { must, supabase } from '../../lib/supabase';
import { nameOf, titleOf, type Course, type CourseModule } from '../../lib/types';
import { useCourses } from '../students/data';

/** Owner: course fees, durations and syllabus modules. */
export default function CoursesPage() {
  const { t, lang } = useI18n();
  const q = useCourses();
  const [course, setCourse] = useState<Course | null>(null);
  const [mod, setMod] = useState<{ course: Course; module: CourseModule | null } | null>(null);

  return (
    <>
      <TopBar title={t('courses_title')} back="/more" />
      <Page>
        <p className="muted small">{t('courses_hint')}</p>
        <Loaded q={q}>
          {({ courses, modules }) => (
            <>
              {courses.map((c) => (
                <section key={c.id} className="card stack" style={{ opacity: c.active ? 1 : 0.6 }}>
                  <button className="row-between" style={{ background: 'none', border: 0, textAlign: 'left', minHeight: 48 }} onClick={() => setCourse(c)}>
                    <span>
                      <span style={{ fontWeight: 700, display: 'block' }}>{nameOf(c, lang)}</span>
                      <span className="muted small num">{t('months_n', { n: Number(c.duration_months) })} · {formatINR(c.list_fee)}</span>
                    </span>
                    <Pencil className="chev" />
                  </button>
                  {c.is_combo ? (
                    <p className="muted small">
                      {t('combo_includes', {
                        list: c.included_course_ids.map((id) => courses.find((x) => x.id === id)).filter(Boolean).map((x) => nameOf(x!, lang)).join(', '),
                      })}
                    </p>
                  ) : (
                    <div className="list">
                      {modules.filter((m) => m.course_id === c.id).map((m, i) => (
                        <button key={m.id} className="list-item" onClick={() => setMod({ course: c, module: m })}>
                          <span className="muted num">{i + 1}.</span>
                          <span className="grow">
                            <span className="title" style={{ display: 'block' }}>{titleOf(m, lang)}</span>
                            {m.topics && <span className="sub">{m.topics}</span>}
                          </span>
                          <ChevronRight className="chev" />
                        </button>
                      ))}
                      <button className="list-item" onClick={() => setMod({ course: c, module: null })} style={{ color: 'var(--accent-ink)', fontWeight: 600 }}>
                        <Plus /> {t('module_add')}
                      </button>
                    </div>
                  )}
                </section>
              ))}
              {course && <CourseSheet course={course} onClose={() => setCourse(null)} />}
              {mod && (
                <ModuleSheet course={mod.course} module={mod.module}
                  nextSort={modules.filter((m) => m.course_id === mod.course.id).length + 1} onClose={() => setMod(null)} />
              )}
            </>
          )}
        </Loaded>
      </Page>
    </>
  );
}

function CourseSheet({ course, onClose }: { course: Course; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [en, setEn] = useState(course.name_en);
  const [hi, setHi] = useState(course.name_hi ?? '');
  const [months, setMonths] = useState(String(course.duration_months));
  const [fee, setFee] = useState<number | null>(course.list_fee);
  const [active, setActive] = useState(course.active);
  const monthsN = Number(months);
  const m = useMutation({
    mutationFn: async () => must(await supabase.from('courses').update({
      name_en: en.trim(), name_hi: hi.trim() || null, duration_months: monthsN, list_fee: fee, active,
    }).eq('id', course.id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['courses'] });
      toast({ kind: 'success', text: t('saved') });
      onClose();
    },
  });
  return (
    <Sheet open onClose={onClose} title={t('course_edit')}>
      <div className="stack">
        <Field label={t('name_en')} htmlFor="c-en"><input id="c-en" className="input" value={en} onChange={(e) => setEn(e.target.value)} /></Field>
        <Field label={t('name_hi')} htmlFor="c-hi"><input id="c-hi" className="input" lang="hi" value={hi} onChange={(e) => setHi(e.target.value)} /></Field>
        <Field label={t('duration_months')} htmlFor="c-m" hint={t('duration_hint')}>
          <input id="c-m" className="input num" inputMode="decimal" value={months} onChange={(e) => setMonths(e.target.value.replace(/[^\d.]/g, ''))} />
        </Field>
        <Field label={t('list_fee')} htmlFor="c-f" hint={t('fee_change_hint')}><MoneyInput id="c-f" value={fee} onChange={setFee} /></Field>
        <CheckRow checked={active} onChange={setActive} label={t('course_active')} />
        {m.error && <ErrorBox error={m.error} />}
        <button className="btn btn-primary btn-lg btn-block" disabled={!en.trim() || !(monthsN > 0) || fee == null || m.isPending} aria-busy={m.isPending} onClick={() => m.mutate()}>
          <Check /> {t('save')}
        </button>
      </div>
    </Sheet>
  );
}

function ModuleSheet({ course, module, nextSort, onClose }: {
  course: Course; module: CourseModule | null; nextSort: number; onClose: () => void;
}) {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [en, setEn] = useState(module?.title_en ?? '');
  const [hi, setHi] = useState(module?.title_hi ?? '');
  const [topics, setTopics] = useState(module?.topics ?? '');
  const m = useMutation({
    mutationFn: async () => {
      const row = { title_en: en.trim(), title_hi: hi.trim() || null, topics: topics.trim() || null };
      if (module) must(await supabase.from('course_modules').update(row).eq('id', module.id));
      else must(await supabase.from('course_modules').insert({ ...row, course_id: course.id, sort: nextSort }));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['courses'] });
      toast({ kind: 'success', text: t('saved') });
      onClose();
    },
  });
  return (
    <Sheet open onClose={onClose} title={`${nameOf(course, lang)}: ${module ? t('module_edit') : t('module_add')}`}>
      <div className="stack">
        <Field label={t('name_en')} htmlFor="m-en"><input id="m-en" className="input" value={en} onChange={(e) => setEn(e.target.value)} /></Field>
        <Field label={t('name_hi')} htmlFor="m-hi"><input id="m-hi" className="input" lang="hi" value={hi} onChange={(e) => setHi(e.target.value)} /></Field>
        <Field label={t('module_topics')} htmlFor="m-t"><textarea id="m-t" className="textarea" value={topics} onChange={(e) => setTopics(e.target.value)} /></Field>
        {m.error && <ErrorBox error={m.error} />}
        <button className="btn btn-primary btn-lg btn-block" disabled={!en.trim() || m.isPending} aria-busy={m.isPending} onClick={() => m.mutate()}>
          <Check /> {t('save')}
        </button>
      </div>
    </Sheet>
  );
}

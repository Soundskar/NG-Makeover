import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Banknote, Check, ChevronDown, CreditCard, Landmark, Smartphone } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTeam } from '../../auth/auth';
import { Choices, ErrorBox, Field, Loaded, Money, MoneyInput, Page, PhoneInput, TopBar, useToast } from '../../components/ui';
import { useI18n } from '../../i18n/i18n';
import { addMonthsFractional, formatTime, todayIST, weekdayName } from '../../lib/dates';
import { formatINR } from '../../lib/money';
import { defaultDays, slotLoad, WEEK_ORDER } from '../../lib/schedule';
import { must, supabase } from '../../lib/supabase';
import { nameOf, type PayMode, type Student } from '../../lib/types';
import { normalizePhone } from '../../lib/whatsapp';
import { SOURCES, useActiveEnrollments, useCourses, useSettings, type Source } from './data';
import { PlanEditor, planIsValid, toRows, type PlanRow } from './PlanEditor';

export const payModeOptions = (t: (k: PayMode) => string) => [
  { value: 'cash' as const, label: t('cash'), icon: <Banknote /> },
  { value: 'upi' as const, label: t('upi'), icon: <Smartphone /> },
  { value: 'card' as const, label: t('card'), icon: <CreditCard /> },
  { value: 'bank' as const, label: t('bank'), icon: <Landmark /> },
];

export default function AdmissionPage() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const existingId = params.get('student');

  const courses = useCourses();
  const settings = useSettings();
  const team = useTeam();
  const enrolled = useActiveEnrollments();
  const existing = useQuery({
    queryKey: ['student-basic', existingId],
    enabled: !!existingId,
    queryFn: async () => must(await supabase.from('students').select('*').eq('id', existingId!).single()) as Student,
  });

  const today = todayIST();
  const [step, setStep] = useState(existingId ? 2 : 1);

  // step 1: student
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [waSame, setWaSame] = useState(true);
  const [wa, setWa] = useState('');
  const [source, setSource] = useState<Source | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [d, setD] = useState({ dob: '', address: '', guardian_name: '', guardian_phone: '', id_type: '', id_last4: '', emergency_contact: '', notes: '' });

  // step 2: course
  const [courseId, setCourseId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState('');
  const [endTouched, setEndTouched] = useState(false);

  // step 3: timing
  const [slotId, setSlotId] = useState<string | null>(null);
  const [days, setDays] = useState<number[] | null>(null);
  const [trainerIds, setTrainerIds] = useState<string[]>([]);

  // step 4: fees
  const [agreed, setAgreed] = useState<number | null>(null);
  const [discountNote, setDiscountNote] = useState('');
  const [kit, setKit] = useState(false);
  const [rows, setRows] = useState<PlanRow[]>([]);
  // Until Mom edits the plan herself, it stays "full fee on the start date".
  const [planTouched, setPlanTouched] = useState(false);
  const [payNow, setPayNow] = useState(true);
  const [payAmount, setPayAmount] = useState<number | null>(null);
  const [payMode, setPayMode] = useState<PayMode>('cash');

  const course = courses.data?.courses.find((c) => c.id === courseId) ?? null;
  const trainers = useMemo(() => (team.data ?? []).filter((p) => p.active && p.is_trainer), [team.data]);
  const chosenDays = days ?? defaultDays(settings.data?.settings.weekly_off ?? 0);

  // Picking a course fills in its end date and fee.
  useEffect(() => {
    if (!course) return;
    if (!endTouched) setEndDate(addMonthsFractional(startDate, Number(course.duration_months)));
  }, [course, startDate, endTouched]);
  useEffect(() => {
    if (!course) return;
    setAgreed(course.list_fee);
    setPlanTouched(false);
    // Only when the course changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);
  useEffect(() => {
    if (!planTouched && agreed != null) setRows(toRows([{ due_date: startDate, amount: agreed }]));
  }, [agreed, startDate, planTouched]);
  useEffect(() => {
    if (trainers.length === 1 && trainerIds.length === 0) setTrainerIds([trainers[0]!.id]);
  }, [trainers, trainerIds.length]);
  useEffect(() => {
    setPayAmount(rows[0]?.amount ?? null);
  }, [rows]);

  const phoneOk = !!normalizePhone(phone);
  const valid: Record<number, boolean> = {
    1: name.trim().length > 1 && phoneOk && (waSame || !wa || !!normalizePhone(wa)),
    2: !!course && !!startDate && !!endDate && endDate >= startDate,
    3: chosenDays.length > 0,
    4: agreed != null && planIsValid(rows, agreed) && (!payNow || (payAmount != null && payAmount > 0 && payAmount <= agreed)),
  };

  const save = useMutation({
    mutationFn: async () => {
      const r = must(await supabase.rpc('create_admission', {
        p: {
          existing_student_id: existingId,
          student: existingId ? null : {
            full_name: name.trim(),
            phone: normalizePhone(phone),
            whatsapp: waSame ? normalizePhone(phone) : normalizePhone(wa),
            source,
            notes: d.notes,
          },
          details: existingId ? null : { ...d, id_last4: d.id_last4.trim() || null },
          enrollment: {
            course_id: courseId, start_date: startDate, expected_end_date: endDate,
            trainer_ids: trainerIds, slot_id: slotId, days_of_week: chosenDays,
          },
          fees: { list_fee: course!.list_fee, agreed_fee: agreed, discount_note: discountNote, kit_included: kit },
          installments: rows.map((x) => ({ due_date: x.due_date, amount: x.amount })),
          first_payment: payNow ? { amount: payAmount, mode: payMode, paid_on: today } : null,
        },
      })) as { student_id: string; payment_id: string | null };
      return r;
    },
    onSuccess: (r) => {
      for (const k of ['students', 'fee-status', 'active-enrollments', 'student']) qc.invalidateQueries({ queryKey: [k] });
      toast({ kind: 'success', text: t('adm_saved') });
      navigate(`/students/${r.student_id}`, { replace: true, state: { receiptFor: r.payment_id } });
    },
  });

  const titles = [t('adm_step_student'), t('adm_step_course'), t('adm_step_timing'), t('adm_step_fees')];

  return (
    <>
      <TopBar title={existingId ? t('adm_add_course') : t('adm_title')} back />
      <Page>
        <div className="stack" style={{ gap: 6 }}>
          <div className="row-between">
            <strong>{titles[step - 1]}</strong>
            <span className="muted small">{t('adm_step', { n: step, of: 4 })}</span>
          </div>
          <div className="bar"><span style={{ width: `${step * 25}%` }} /></div>
          {existingId && existing.data && <p className="muted">{existing.data.full_name}</p>}
        </div>

        {step === 1 && (
          <div className="stack">
            <Field label={t('full_name')} htmlFor="n">
              <input id="n" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" autoCapitalize="words" />
            </Field>
            <Field label={t('phone')} htmlFor="ph" error={phone && !phoneOk ? t('phone_invalid') : null}>
              <PhoneInput id="ph" value={phone} onChange={setPhone} />
            </Field>
            <label className="row" style={{ minHeight: 44, fontWeight: 600 }}>
              <input type="checkbox" checked={waSame} onChange={(e) => setWaSame(e.target.checked)}
                style={{ width: 22, height: 22, accentColor: 'var(--primary)' }} />
              {t('whatsapp_same')}
            </label>
            {!waSame && (
              <Field label={t('whatsapp_number')} htmlFor="wa">
                <PhoneInput id="wa" value={wa} onChange={setWa} />
              </Field>
            )}
            <div className="field">
              <span className="field-label">{t('source')}</span>
              <div className="chips" style={{ flexWrap: 'wrap' }}>
                {SOURCES.map((s) => (
                  <button key={s} type="button" className="chip" aria-pressed={source === s} onClick={() => setSource(source === s ? null : s)}>
                    {t(`source_${s}`)}
                  </button>
                ))}
              </div>
            </div>
            <button type="button" className="btn btn-secondary btn-block" aria-expanded={moreOpen} onClick={() => setMoreOpen((v) => !v)}>
              {t('more_details')} <ChevronDown style={{ transform: moreOpen ? 'rotate(180deg)' : undefined }} />
            </button>
            {moreOpen && (
              <div className="card stack">
                <Field label={t('dob')} htmlFor="dob">
                  <input id="dob" type="date" className="input" value={d.dob} onChange={(e) => setD({ ...d, dob: e.target.value })} />
                </Field>
                <Field label={t('address')} htmlFor="ad">
                  <textarea id="ad" className="textarea" value={d.address} onChange={(e) => setD({ ...d, address: e.target.value })} />
                </Field>
                <Field label={t('guardian_name')} htmlFor="gn">
                  <input id="gn" className="input" value={d.guardian_name} onChange={(e) => setD({ ...d, guardian_name: e.target.value })} />
                </Field>
                <Field label={t('guardian_phone')} htmlFor="gp">
                  <PhoneInput id="gp" value={d.guardian_phone} onChange={(v) => setD({ ...d, guardian_phone: v })} />
                </Field>
                <Field label={t('id_type')} htmlFor="it" hint={t('id_type_hint')}>
                  <input id="it" className="input" value={d.id_type} onChange={(e) => setD({ ...d, id_type: e.target.value })} />
                </Field>
                <Field label={t('id_last4')} htmlFor="il" hint={t('id_last4_hint')}>
                  <input id="il" className="input num" inputMode="numeric" maxLength={4} value={d.id_last4}
                    onChange={(e) => setD({ ...d, id_last4: e.target.value.replace(/[^0-9A-Za-z]/g, '') })} />
                </Field>
                <Field label={t('emergency_contact')} htmlFor="ec">
                  <input id="ec" className="input" value={d.emergency_contact} onChange={(e) => setD({ ...d, emergency_contact: e.target.value })} />
                </Field>
                <Field label={t('notes')} htmlFor="no">
                  <textarea id="no" className="textarea" value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} />
                </Field>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <Loaded q={courses}>
            {({ courses: list }) => (
              <div className="stack">
                <div className="stack" role="radiogroup" aria-label={t('adm_step_course')}>
                  {list.filter((c) => c.active).map((c) => (
                    <button key={c.id} type="button" role="radio" aria-checked={courseId === c.id} className="card-link"
                      style={courseId === c.id ? { borderColor: 'var(--primary)', background: 'var(--primary-soft)' } : undefined}
                      onClick={() => setCourseId(c.id)}>
                      <div className="row-between">
                        <strong>{nameOf(c, lang)}</strong>
                        {courseId === c.id && <Check className="text-success" />}
                      </div>
                      <div className="muted num">
                        {t('months_n', { n: Number(c.duration_months) })} · {formatINR(c.list_fee)}
                      </div>
                    </button>
                  ))}
                </div>
                <Field label={t('start_date')} htmlFor="sd">
                  <input id="sd" type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </Field>
                <Field label={t('end_date')} htmlFor="ed" hint={t('end_date_hint')}>
                  <input id="ed" type="date" className="input" value={endDate} min={startDate}
                    onChange={(e) => { setEndDate(e.target.value); setEndTouched(true); }} />
                </Field>
              </div>
            )}
          </Loaded>
        )}

        {step === 3 && (
          <Loaded q={settings}>
            {({ slots }) => (
              <div className="stack-lg">
                <div className="field">
                  <span className="field-label">{t('days')}</span>
                  <div className="chips" style={{ flexWrap: 'wrap' }}>
                    {WEEK_ORDER.map((wd) => (
                      <button key={wd} type="button" className="chip" aria-pressed={chosenDays.includes(wd)}
                        onClick={() => setDays(chosenDays.includes(wd) ? chosenDays.filter((x) => x !== wd) : [...chosenDays, wd])}>
                        {weekdayName(wd, lang)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="field">
                  <span className="field-label">{t('slot')}</span>
                  {slots.filter((s) => s.active).length === 0 ? (
                    <div className="notice notice-info">
                      <span>{t('slots_none')} <Link to="/more/slots">{t('slots_add_link')}</Link></span>
                    </div>
                  ) : (
                    <div className="list" role="radiogroup" aria-label={t('slot')}>
                      {slots.filter((s) => s.active).map((s) => {
                        const left = s.seats - slotLoad(enrolled.data ?? [], s.id, chosenDays);
                        return (
                          <button key={s.id} type="button" role="radio" aria-checked={slotId === s.id} className="list-item"
                            onClick={() => setSlotId(slotId === s.id ? null : s.id)}>
                            <span className="grow title num">{formatTime(s.start_time, lang)} – {formatTime(s.end_time, lang)}</span>
                            <span className={`badge ${left > 0 ? 'badge-success' : 'badge-danger'}`}>
                              {left > 0 ? t('seats_left', { n: left }) : t('slot_full')}
                            </span>
                            {slotId === s.id && <Check className="text-success" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="field">
                  <span className="field-label">{t('trainer')}</span>
                  <div className="chips" style={{ flexWrap: 'wrap' }}>
                    {trainers.map((p) => (
                      <button key={p.id} type="button" className="chip" aria-pressed={trainerIds.includes(p.id)}
                        onClick={() => setTrainerIds(trainerIds.includes(p.id) ? trainerIds.filter((x) => x !== p.id) : [...trainerIds, p.id])}>
                        {p.display_name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </Loaded>
        )}

        {step === 4 && course && agreed != null && (
          <div className="stack-lg">
            <div className="card stack">
              <div className="row-between">
                <span className="muted">{t('list_fee')}</span>
                <Money n={course.list_fee} />
              </div>
              <Field label={t('agreed_fee')} htmlFor="af">
                <MoneyInput id="af" value={agreed} onChange={(n) => {
                  setAgreed(n ?? 0);
                  setPlanTouched(false);
                }} />
              </Field>
              {agreed < course.list_fee && (
                <>
                  <span className="badge badge-primary" style={{ alignSelf: 'flex-start' }}>
                    {t('discount_amt', { amount: formatINR(course.list_fee - agreed) })}
                  </span>
                  <Field label={t('discount_note')} htmlFor="dn">
                    <input id="dn" className="input" value={discountNote} onChange={(e) => setDiscountNote(e.target.value)} />
                  </Field>
                </>
              )}
              <label className="row" style={{ minHeight: 44, fontWeight: 600 }}>
                <input type="checkbox" checked={kit} onChange={(e) => setKit(e.target.checked)}
                  style={{ width: 22, height: 22, accentColor: 'var(--primary)' }} />
                {t('kit_included')}
              </label>
            </div>

            <section className="stack">
              <h2 className="section-title">{t('plan')}</h2>
              <PlanEditor total={agreed} rows={rows} firstDate={startDate}
                onChange={(r) => { setRows(r); setPlanTouched(true); }} />
            </section>

            <section className="stack">
              <h2 className="section-title">{t('first_payment')}</h2>
              <div className="tabs" role="tablist">
                <button type="button" role="tab" className="tab" aria-selected={payNow} onClick={() => setPayNow(true)}>{t('first_payment_yes')}</button>
                <button type="button" role="tab" className="tab" aria-selected={!payNow} onClick={() => setPayNow(false)}>{t('first_payment_no')}</button>
              </div>
              {payNow && (
                <div className="card stack">
                  <Field label={t('amount')} htmlFor="pa">
                    <MoneyInput id="pa" value={payAmount} onChange={setPayAmount} />
                  </Field>
                  <Choices<PayMode> label={t('mode')} value={payMode} onChange={setPayMode} options={payModeOptions(t)} />
                </div>
              )}
            </section>
          </div>
        )}

        {save.error && <ErrorBox error={save.error} />}

        <div className="sticky-actions row" style={{ gap: 8 }}>
          {step > (existingId ? 2 : 1) && (
            <button type="button" className="btn btn-secondary btn-lg" onClick={() => setStep(step - 1)} aria-label={t('back')}>
              <ArrowLeft />
            </button>
          )}
          {step < 4 ? (
            <button type="button" className="btn btn-primary btn-lg grow" disabled={!valid[step]} onClick={() => setStep(step + 1)}>
              {t('next')} <ArrowRight />
            </button>
          ) : (
            <button type="button" className="btn btn-primary btn-lg grow" disabled={!valid[4] || save.isPending} onClick={() => save.mutate()}>
              <Check /> {t('adm_save')}
            </button>
          )}
        </div>
      </Page>
    </>
  );
}

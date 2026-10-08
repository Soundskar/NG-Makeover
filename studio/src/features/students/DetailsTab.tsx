import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Pause, Pencil, Play, Plus, UserX } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTeam } from '../../auth/auth';
import { Confirm, ErrorBox, Field, PhoneInput, Sheet, useToast } from '../../components/ui';
import { useI18n } from '../../i18n/i18n';
import { formatDate, formatTime, weekdayName } from '../../lib/dates';
import { slotLoad, WEEK_ORDER } from '../../lib/schedule';
import { must, supabase } from '../../lib/supabase';
import type { Enrollment, EnrollmentStatus, StudentDetails } from '../../lib/types';
import { formatPhone, normalizePhone } from '../../lib/whatsapp';
import { useActiveEnrollments, useSettings, type StudentFull } from './data';

function Row({ label, children }: { label: string; children: ReactNode }) {
  if (children == null || children === '') return null;
  return (
    <div className="list-item" style={{ minHeight: 52, alignItems: 'flex-start' }}>
      <span className="muted small" style={{ width: 120, flexShrink: 0 }}>{label}</span>
      <span className="grow" style={{ whiteSpace: 'pre-wrap' }}>{children}</span>
    </div>
  );
}

export function DetailsTab({ data, enrollment }: { data: StudentFull; enrollment: Enrollment }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const [editStudent, setEditStudent] = useState(false);
  const [editTiming, setEditTiming] = useState(false);
  const [statusTo, setStatusTo] = useState<EnrollmentStatus | null>(null);
  const { student, details } = data;

  const setStatus = useMutation({
    mutationFn: async (status: EnrollmentStatus) => {
      must(await supabase.from('enrollments').update({ status }).eq('id', enrollment.id));
      const others = data.enrollments.filter((e) => e.id !== enrollment.id);
      const anyActive = status === 'active' || status === 'paused' || others.some((e) => e.status === 'active' || e.status === 'paused');
      const studentStatus = anyActive ? 'active' : status === 'left' ? 'left' : 'completed';
      must(await supabase.from('students').update({ status: studentStatus }).eq('id', student.id));
    },
    onSuccess: () => {
      for (const k of ['student', 'students', 'active-enrollments', 'fee-status']) qc.invalidateQueries({ queryKey: [k] });
      toast({ kind: 'success', text: t('saved') });
      setStatusTo(null);
    },
  });

  return (
    <div className="stack-lg">
      <section className="stack">
        <div className="row-between">
          <h2 className="section-title">{t('adm_step_student')}</h2>
          <button className="btn btn-sm btn-soft" onClick={() => setEditStudent(true)}><Pencil /> {t('edit')}</button>
        </div>
        <div className="list">
          <Row label={t('full_name')}>{student.full_name}</Row>
          <Row label={t('phone')}>{student.phone && formatPhone(student.phone)}</Row>
          <Row label="WhatsApp">{student.whatsapp && student.whatsapp !== student.phone ? formatPhone(student.whatsapp) : null}</Row>
          <Row label={t('joined_on')}>{formatDate(student.joined_on, lang)}</Row>
          <Row label={t('source')}>{student.source && t(`source_${student.source as 'instagram'}`)}</Row>
          <Row label={t('dob')}>{details?.dob && formatDate(details.dob, lang)}</Row>
          <Row label={t('address')}>{details?.address}</Row>
          <Row label={t('guardian_name')}>{details?.guardian_name}</Row>
          <Row label={t('guardian_phone')}>{details?.guardian_phone && formatPhone(details.guardian_phone)}</Row>
          <Row label={t('id_type')}>{details?.id_type ? `${details.id_type}${details.id_last4 ? ` ••••${details.id_last4}` : ''}` : null}</Row>
          <Row label={t('emergency_contact')}>{details?.emergency_contact}</Row>
          <Row label={t('notes')}>{student.notes}</Row>
        </div>
      </section>

      <section className="stack">
        <div className="row-between">
          <h2 className="section-title">{t('adm_step_timing')}</h2>
          <button className="btn btn-sm btn-soft" onClick={() => setEditTiming(true)}><Pencil /> {t('edit')}</button>
        </div>
        <div className="stack">
          {enrollment.status === 'active' && (
            <button className="btn btn-secondary btn-block" onClick={() => setStatusTo('paused')}><Pause /> {t('enr_pause')}</button>
          )}
          {enrollment.status === 'paused' && (
            <button className="btn btn-secondary btn-block" onClick={() => setStatusTo('active')}><Play /> {t('enr_resume')}</button>
          )}
          {(enrollment.status === 'active' || enrollment.status === 'paused') && (
            <button className="btn btn-danger btn-block" onClick={() => setStatusTo('left')}><UserX /> {t('enr_left')}</button>
          )}
          <Link to={`/students/new?student=${student.id}`} className="btn btn-soft btn-block"><Plus /> {t('adm_add_course')}</Link>
        </div>
      </section>

      <Confirm open={statusTo != null} onClose={() => setStatusTo(null)} busy={setStatus.isPending}
        title={statusTo ? t(`enr_confirm_${statusTo}`) : ''}
        danger={statusTo === 'left'}
        confirmLabel={t('yes')}
        onConfirm={() => statusTo && setStatus.mutate(statusTo)} />
      {setStatus.error && <ErrorBox error={setStatus.error} />}

      {editStudent && <EditStudentSheet data={data} onClose={() => setEditStudent(false)} />}
      {editTiming && <EditTimingSheet enrollment={enrollment} onClose={() => setEditTiming(false)} />}
    </div>
  );
}

function EditStudentSheet({ data, onClose }: { data: StudentFull; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const s = data.student;
  const [name, setName] = useState(s.full_name);
  const [phone, setPhone] = useState(s.phone ?? '');
  const [wa, setWa] = useState(s.whatsapp ?? '');
  const [notes, setNotes] = useState(s.notes ?? '');
  const [d, setD] = useState<Omit<StudentDetails, 'student_id'>>({
    dob: data.details?.dob ?? null, address: data.details?.address ?? null,
    guardian_name: data.details?.guardian_name ?? null, guardian_phone: data.details?.guardian_phone ?? null,
    id_type: data.details?.id_type ?? null, id_last4: data.details?.id_last4 ?? null,
    emergency_contact: data.details?.emergency_contact ?? null,
  });
  const set = (k: keyof typeof d) => (v: string) => setD({ ...d, [k]: v || null });
  const m = useMutation({
    mutationFn: async () => {
      must(await supabase.from('students').update({
        full_name: name.trim(), phone: normalizePhone(phone) ?? (phone.trim() || null),
        whatsapp: normalizePhone(wa) ?? (wa.trim() || null), notes: notes.trim() || null,
      }).eq('id', s.id));
      must(await supabase.from('student_details').upsert({ student_id: s.id, ...d }));
    },
    onSuccess: () => {
      for (const k of ['student', 'students']) qc.invalidateQueries({ queryKey: [k] });
      toast({ kind: 'success', text: t('saved') });
      onClose();
    },
  });
  return (
    <Sheet open onClose={onClose} title={t('edit')}>
      <div className="stack">
        <Field label={t('full_name')} htmlFor="e-n"><input id="e-n" className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label={t('phone')} htmlFor="e-p"><PhoneInput id="e-p" value={phone} onChange={setPhone} /></Field>
        <Field label={t('whatsapp_number')} htmlFor="e-w"><PhoneInput id="e-w" value={wa} onChange={setWa} /></Field>
        <Field label={t('dob')} htmlFor="e-d"><input id="e-d" type="date" className="input" value={d.dob ?? ''} onChange={(e) => set('dob')(e.target.value)} /></Field>
        <Field label={t('address')} htmlFor="e-a"><textarea id="e-a" className="textarea" value={d.address ?? ''} onChange={(e) => set('address')(e.target.value)} /></Field>
        <Field label={t('guardian_name')} htmlFor="e-g"><input id="e-g" className="input" value={d.guardian_name ?? ''} onChange={(e) => set('guardian_name')(e.target.value)} /></Field>
        <Field label={t('guardian_phone')} htmlFor="e-gp"><PhoneInput id="e-gp" value={d.guardian_phone ?? ''} onChange={set('guardian_phone')} /></Field>
        <Field label={t('id_type')} htmlFor="e-it"><input id="e-it" className="input" value={d.id_type ?? ''} onChange={(e) => set('id_type')(e.target.value)} /></Field>
        <Field label={t('id_last4')} htmlFor="e-il" hint={t('id_last4_hint')}>
          <input id="e-il" className="input num" maxLength={4} value={d.id_last4 ?? ''} onChange={(e) => set('id_last4')(e.target.value.replace(/[^0-9A-Za-z]/g, ''))} />
        </Field>
        <Field label={t('emergency_contact')} htmlFor="e-ec"><input id="e-ec" className="input" value={d.emergency_contact ?? ''} onChange={(e) => set('emergency_contact')(e.target.value)} /></Field>
        <Field label={t('notes')} htmlFor="e-no"><textarea id="e-no" className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        {m.error && <ErrorBox error={m.error} />}
        <button className="btn btn-primary btn-lg btn-block" disabled={!name.trim() || m.isPending} aria-busy={m.isPending} onClick={() => m.mutate()}>
          <Check /> {t('save')}
        </button>
      </div>
    </Sheet>
  );
}

function EditTimingSheet({ enrollment, onClose }: { enrollment: Enrollment; onClose: () => void }) {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const settings = useSettings();
  const team = useTeam();
  const enrolled = useActiveEnrollments();
  const [slotId, setSlotId] = useState(enrollment.slot_id);
  const [days, setDays] = useState(enrollment.days_of_week);
  const [trainers, setTrainers] = useState(enrollment.trainer_ids);
  const [end, setEnd] = useState(enrollment.expected_end_date);
  const m = useMutation({
    mutationFn: async () => must(await supabase.from('enrollments').update({
      slot_id: slotId, days_of_week: days, trainer_ids: trainers, expected_end_date: end,
    }).eq('id', enrollment.id)),
    onSuccess: () => {
      for (const k of ['student', 'students', 'active-enrollments']) qc.invalidateQueries({ queryKey: [k] });
      toast({ kind: 'success', text: t('saved') });
      onClose();
    },
  });
  return (
    <Sheet open onClose={onClose} title={t('adm_step_timing')}>
      <div className="stack-lg">
        <div className="field">
          <span className="field-label">{t('days')}</span>
          <div className="chips" style={{ flexWrap: 'wrap' }}>
            {WEEK_ORDER.map((wd) => (
              <button key={wd} type="button" className="chip" aria-pressed={days.includes(wd)}
                onClick={() => setDays(days.includes(wd) ? days.filter((x) => x !== wd) : [...days, wd])}>
                {weekdayName(wd, lang)}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span className="field-label">{t('slot')}</span>
          <div className="list">
            {(settings.data?.slots ?? []).filter((s) => s.active || s.id === slotId).map((s) => {
              const left = s.seats - slotLoad(enrolled.data ?? [], s.id, days, enrollment.id);
              return (
                <button key={s.id} type="button" className="list-item" aria-pressed={slotId === s.id} onClick={() => setSlotId(s.id)}>
                  <span className="grow title num">{formatTime(s.start_time, lang)} – {formatTime(s.end_time, lang)}</span>
                  <span className={`badge ${left > 0 ? 'badge-success' : 'badge-danger'}`}>{left > 0 ? t('seats_left', { n: left }) : t('slot_full')}</span>
                  {slotId === s.id && <Check className="text-success" />}
                </button>
              );
            })}
          </div>
        </div>
        <div className="field">
          <span className="field-label">{t('trainer')}</span>
          <div className="chips" style={{ flexWrap: 'wrap' }}>
            {(team.data ?? []).filter((p) => p.active && p.is_trainer).map((p) => (
              <button key={p.id} type="button" className="chip" aria-pressed={trainers.includes(p.id)}
                onClick={() => setTrainers(trainers.includes(p.id) ? trainers.filter((x) => x !== p.id) : [...trainers, p.id])}>
                {p.display_name}
              </button>
            ))}
          </div>
        </div>
        <Field label={t('end_date')} htmlFor="t-e">
          <input id="t-e" type="date" className="input" value={end} min={enrollment.start_date} onChange={(e) => setEnd(e.target.value)} />
        </Field>
        {m.error && <ErrorBox error={m.error} />}
        <button className="btn btn-primary btn-lg btn-block" disabled={days.length === 0 || !end || m.isPending} aria-busy={m.isPending} onClick={() => m.mutate()}>
          <Check /> {t('save')}
        </button>
      </div>
    </Sheet>
  );
}


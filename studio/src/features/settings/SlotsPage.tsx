import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ErrorBox, Field, Loaded, Page, Sheet, TopBar } from '../../components/ui';
import { useI18n } from '../../i18n/i18n';
import { formatDate, formatTime, todayIST, weekdayName } from '../../lib/dates';
import { slotLoad, WEEK_ORDER } from '../../lib/schedule';
import { must, supabase } from '../../lib/supabase';
import type { TimeSlot } from '../../lib/types';
import { useActiveEnrollments, useSettings } from '../students/data';

/** Owner: class time slots with seats, the weekly off day, and holidays. */
export default function SlotsPage() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const settings = useSettings();
  const enrolled = useActiveEnrollments();
  const [slot, setSlot] = useState<TimeSlot | 'new' | null>(null);
  const [holidayOpen, setHolidayOpen] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ['settings'] });

  const setOff = useMutation({
    mutationFn: async (day: number | null) => must(await supabase.from('settings').update({ weekly_off: day }).eq('id', true)),
    onSuccess: refresh,
  });
  const removeHoliday = useMutation({
    mutationFn: async (day: string) => must(await supabase.from('holidays').delete().eq('day', day)),
    onSuccess: refresh,
  });

  return (
    <>
      <TopBar title={t('slots_title')} back="/more" />
      <Page>
        <Loaded q={settings}>
          {({ settings: s, slots, holidays }) => (
            <>
              <section className="stack">
                <h2 className="section-title">{t('slots_title')}</h2>
                {slots.length === 0 && <p className="muted">{t('slots_none')}</p>}
                <div className="list">
                  {slots.map((x) => {
                    const busiest = Math.max(0, ...WEEK_ORDER.map((d) => slotLoad(enrolled.data ?? [], x.id, [d])));
                    return (
                      <button key={x.id} className="list-item" onClick={() => setSlot(x)} style={{ opacity: x.active ? 1 : 0.55 }}>
                        <span className="grow">
                          <span className="title num" style={{ display: 'block' }}>{formatTime(x.start_time, lang)} – {formatTime(x.end_time, lang)}</span>
                          <span className="sub">{t('slot_usage', { used: busiest, seats: x.seats })}{x.active ? '' : ` · ${t('service_hidden')}`}</span>
                        </span>
                        <ChevronRight className="chev" />
                      </button>
                    );
                  })}
                </div>
                <button className="btn btn-secondary btn-block" onClick={() => setSlot('new')}><Plus /> {t('slot_add')}</button>
              </section>

              <section className="stack">
                <h2 className="section-title">{t('weekly_off')}</h2>
                <div className="chips" style={{ flexWrap: 'wrap' }}>
                  <button className="chip" aria-pressed={s.weekly_off == null} onClick={() => setOff.mutate(null)}>{t('none')}</button>
                  {WEEK_ORDER.map((d) => (
                    <button key={d} className="chip" aria-pressed={s.weekly_off === d} onClick={() => setOff.mutate(d)}>{weekdayName(d, lang, 'long')}</button>
                  ))}
                </div>
                {setOff.error && <ErrorBox error={setOff.error} />}
              </section>

              <section className="stack">
                <h2 className="section-title">{t('holidays')}</h2>
                {holidays.filter((h) => h.day >= todayIST()).length === 0 && <p className="muted">{t('holidays_none')}</p>}
                <div className="list">
                  {holidays.filter((h) => h.day >= todayIST()).map((h) => (
                    <div key={h.day} className="list-item">
                      <span className="grow"><span className="title" style={{ display: 'block' }}>{h.name}</span><span className="sub">{formatDate(h.day, lang)}</span></span>
                      <button className="icon-btn" aria-label={t('remove')} onClick={() => removeHoliday.mutate(h.day)}><Trash2 /></button>
                    </div>
                  ))}
                </div>
                <button className="btn btn-secondary btn-block" onClick={() => setHolidayOpen(true)}><Plus /> {t('holiday_add')}</button>
              </section>

              {slot && <SlotSheet slot={slot === 'new' ? null : slot} onClose={() => setSlot(null)} />}
              {holidayOpen && <HolidaySheet onClose={() => setHolidayOpen(false)} />}
            </>
          )}
        </Loaded>
      </Page>
    </>
  );
}

function SlotSheet({ slot, onClose }: { slot: TimeSlot | null; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [start, setStart] = useState(slot?.start_time.slice(0, 5) ?? '11:00');
  const [end, setEnd] = useState(slot?.end_time.slice(0, 5) ?? '13:00');
  const [seats, setSeats] = useState(String(slot?.seats ?? 6));
  const [active, setActive] = useState(slot?.active ?? true);
  const m = useMutation({
    mutationFn: async () => {
      const row = { start_time: start, end_time: end, seats: Number(seats), active };
      if (slot) must(await supabase.from('time_slots').update(row).eq('id', slot.id));
      else must(await supabase.from('time_slots').insert(row));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      onClose();
    },
  });
  return (
    <Sheet open onClose={onClose} title={slot ? t('slot_edit') : t('slot_add')}>
      <div className="stack">
        <div className="row">
          <Field label={t('slot_from')} htmlFor="sl-s"><input id="sl-s" type="time" className="input" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label={t('slot_to')} htmlFor="sl-e"><input id="sl-e" type="time" className="input" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
        </div>
        <Field label={t('slot_seats')} htmlFor="sl-n">
          <input id="sl-n" className="input num" inputMode="numeric" value={seats} onChange={(e) => setSeats(e.target.value.replace(/\D/g, '').slice(0, 3))} />
        </Field>
        <label className="row" style={{ minHeight: 44, fontWeight: 600 }}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} style={{ width: 22, height: 22, accentColor: 'var(--primary)' }} />
          {t('slot_active')}
        </label>
        {m.error && <ErrorBox error={m.error} />}
        <button className="btn btn-primary btn-lg btn-block" disabled={!start || !end || end <= start || !(Number(seats) > 0) || m.isPending} onClick={() => m.mutate()}>
          <Check /> {t('save')}
        </button>
      </div>
    </Sheet>
  );
}

function HolidaySheet({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [day, setDay] = useState(todayIST());
  const [name, setName] = useState('');
  const m = useMutation({
    mutationFn: async () => must(await supabase.from('holidays').upsert({ day, name: name.trim() })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      onClose();
    },
  });
  return (
    <Sheet open onClose={onClose} title={t('holiday_add')}>
      <div className="stack">
        <Field label={t('date')} htmlFor="h-d"><input id="h-d" type="date" className="input" value={day} onChange={(e) => setDay(e.target.value)} /></Field>
        <Field label={t('holiday_name')} htmlFor="h-n"><input id="h-n" className="input" placeholder={t('holiday_example')} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        {m.error && <ErrorBox error={m.error} />}
        <button className="btn btn-primary btn-lg btn-block" disabled={!day || !name.trim() || m.isPending} onClick={() => m.mutate()}>
          <Check /> {t('save')}
        </button>
      </div>
    </Sheet>
  );
}

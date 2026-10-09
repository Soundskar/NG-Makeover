import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CalendarCheck, Check, MessageCircle, Plus, StickyNote, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMe, useTeam, useTeamNames } from '../../auth/auth';
import {
  Choices, ErrorBox, Field, Loaded, MoneyInput, Page, PhoneInput, SearchInput, Sheet, SheetCloseButton, TopBar, useToast,
} from '../../components/ui';
import { useI18n } from '../../i18n/i18n';
import { formatDate, formatTime, todayIST } from '../../lib/dates';
import { haptic } from '../../lib/haptics';
import { formatINR, sum } from '../../lib/money';
import { must, supabase } from '../../lib/supabase';
import { nameOf, type Booking, type PayMode, type Service } from '../../lib/types';
import { normalizePhone, waLink } from '../../lib/whatsapp';
import { bookingMessage, useClientCard } from '../clients/data';
import { priceLabel, useServiceCatalog } from '../salon/data';
import { payModeOptions } from '../students/AdmissionPage';
import { useSettings } from '../students/data';
import { overlaps, useBooking, useBookings } from './data';

const TIMES = ['10:00', '11:00', '12:00', '13:00', '15:00', '16:00', '17:00', '18:00'];
const DURATIONS = [30, 60, 90, 120, 180, 240];

/** New booking, or editing one (?edit=id). Prefills from ?d=day and ?phone=. */
export default function BookingFormPage() {
  const me = useMe();
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const editId = params.get('edit');
  const existing = useBooking(editId);
  const today = todayIST();
  const catalog = useServiceCatalog();
  const team = useTeam();
  const teamName = useTeamNames();
  const settings = useSettings();
  const studio = settings.data?.settings.studio_name ?? 'Namita Garg Makeover';

  const [phone, setPhone] = useState(params.get('phone') ?? '');
  const [name, setName] = useState('');
  const [day, setDay] = useState(params.get('d') && params.get('d')! >= today ? params.get('d')! : today);
  const [time, setTime] = useState('11:00');
  const [duration, setDuration] = useState(60);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [quoted, setQuoted] = useState<number | null>(null);
  const [quotedTouched, setQuotedTouched] = useState(false);
  const [advance, setAdvance] = useState<number | null>(null);
  const [advanceMode, setAdvanceMode] = useState<PayMode>('upi');
  const [note, setNote] = useState('');
  const [picking, setPicking] = useState(false);
  const [saved, setSaved] = useState<Booking | null>(null);
  const [loaded, setLoaded] = useState(!editId);

  // Editing: fill the form once the booking arrives.
  useEffect(() => {
    const b = existing.data?.booking;
    if (!b || loaded) return;
    setPhone(b.client_phone); setName(b.client_name); setDay(b.day); setTime(b.start_time.slice(0, 5));
    setDuration(b.duration_minutes); setServiceIds(b.service_ids); setStaffId(b.staff_id);
    setQuoted(b.quoted); setQuotedTouched(true); setNote(b.note ?? '');
    setLoaded(true);
  }, [existing.data, loaded]);

  const ten = normalizePhone(phone);
  const card = useClientCard(phone);
  // A known client: fill in her name (unless one was typed).
  useEffect(() => {
    if (card.data?.name && !name) setName(card.data.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.data?.name]);

  const services = useMemo(() => {
    const all = catalog.data?.services ?? [];
    return serviceIds.map((id) => all.find((s) => s.id === id)).filter(Boolean) as Service[];
  }, [catalog.data, serviceIds]);
  const suggested = sum(services.map((s) => s.price_min ?? s.price));
  useEffect(() => {
    if (!quotedTouched) setQuoted(services.length ? suggested : null);
  }, [suggested, services.length, quotedTouched]);

  const sameDay = useBookings(day, day);
  const others = (sameDay.data?.bookings ?? []).filter((b) => b.status === 'booked' && b.id !== editId);
  const clash = others.filter((b) => overlaps(b, { start_time: time, duration_minutes: duration })
    && (staffId == null || b.staff_id == null || b.staff_id === staffId));

  const doers = (team.data ?? []).filter((p) => p.active && (p.is_staff || p.is_owner));
  const valid = !!ten && name.trim().length > 0 && !!day && !!time;

  const save = useMutation({
    mutationFn: async () => {
      const row = {
        client_phone: ten!, client_name: name.trim(), day, start_time: time, duration_minutes: duration,
        service_ids: serviceIds, services_text: services.map((s) => s.name_en).join(', ') || null,
        staff_id: staffId, quoted, note: note.trim() || null,
      };
      const b = editId
        ? must(await supabase.from('appointments').update(row).eq('id', editId).select().single()) as Booking
        : must(await supabase.from('appointments').insert(row).select().single()) as Booking;
      if (!editId && advance && advance > 0) {
        must(await supabase.rpc('add_advance', { p_appointment: b.id, p_amount: advance, p_mode: advanceMode }));
      }
      return b;
    },
    onSuccess: (b) => {
      for (const k of ['bookings', 'booking', 'client', 'clients', 'client-card', 'clients-due']) qc.invalidateQueries({ queryKey: [k] });
      haptic('success');
      if (editId) {
        toast({ kind: 'success', text: t('saved') });
        navigate(`/bookings?d=${b.day}`, { replace: true });
      } else setSaved(b);
    },
  });

  if (saved) {
    const wa = waLink(saved.client_phone, bookingMessage({
      t, lang, studio, kind: 'confirm', name: saved.client_name, day: saved.day, time: saved.start_time,
      services: saved.services_text, advance: advance ?? 0,
    }));
    return (
      <>
        <TopBar title={t('booking_new')} />
        <Page>
          <div className="card hero stack center" style={{ gap: 6, padding: 28 }}>
            <CalendarCheck size={40} style={{ margin: '0 auto' }} />
            <span className="stat-value" style={{ fontSize: '1.75rem' }}>{t('booking_saved')}</span>
            <span className="stat-sub">{saved.client_name} · {formatDate(saved.day, lang)} · {formatTime(saved.start_time, lang)}</span>
          </div>
          {wa && (
            <a className="btn btn-whatsapp btn-lg btn-block" href={wa} target="_blank" rel="noopener"
              onClick={() => navigate(`/bookings?d=${saved.day}`, { replace: true })}>
              <MessageCircle /> {t('booking_send_confirm')}
            </a>
          )}
          <button className="btn btn-secondary btn-block" onClick={() => navigate(`/bookings?d=${saved.day}`, { replace: true })}>{t('done')}</button>
        </Page>
      </>
    );
  }

  return (
    <>
      <TopBar title={editId ? t('booking_edit') : t('booking_new')} back />
      <Page>
        {editId && !loaded ? <Loaded q={existing} skeleton="cards">{() => null}</Loaded> : (
          <>
            <section className="card stack">
              <Field label={t('phone')} htmlFor="bk-p" error={phone && !ten ? t('phone_invalid') : null}>
                <PhoneInput id="bk-p" value={phone} onChange={setPhone} />
              </Field>
              <Field label={t('name')} htmlFor="bk-n">
                <input id="bk-n" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
              </Field>
              {card.data?.notes && (
                <div className="notice notice-info"><StickyNote /><span>{card.data.notes}</span></div>
              )}
              {card.data?.next_booking && card.data.next_booking.id !== editId && (
                <div className="notice notice-warning"><AlertCircle />
                  <span>{t('booking_already', { date: formatDate(card.data.next_booking.day, lang, false), time: formatTime(card.data.next_booking.time, lang) })}</span>
                </div>
              )}
            </section>

            <section className="stack">
              <h2 className="section-title">{t('booking_when')}</h2>
              <div className="card stack">
                <Field label={t('date')} htmlFor="bk-d">
                  <input id="bk-d" type="date" className="input" value={day} min={editId ? undefined : today} onChange={(e) => setDay(e.target.value)} />
                </Field>
                <Field label={t('booking_time')} htmlFor="bk-t">
                  <input id="bk-t" type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
                </Field>
                <div className="chips">
                  {TIMES.map((x) => (
                    <button key={x} type="button" className="chip num" aria-pressed={time === x} onClick={() => setTime(x)}>{formatTime(x, lang)}</button>
                  ))}
                </div>
                <span className="field-label">{t('booking_duration')}</span>
                <div className="chips">
                  {DURATIONS.map((d) => (
                    <button key={d} type="button" className="chip num" aria-pressed={duration === d} onClick={() => setDuration(d)}>
                      {t('duration_short', { n: d })}
                    </button>
                  ))}
                </div>
                {others.length > 0 && (
                  <div className="stack" style={{ gap: 4 }}>
                    <span className="muted small">{t('booking_same_day')}</span>
                    {others.map((b) => (
                      <span key={b.id} className={`small num${clash.includes(b) ? ' text-warning' : ''}`} style={{ fontWeight: clash.includes(b) ? 700 : 400 }}>
                        {formatTime(b.start_time, lang)} · {b.client_name}{b.staff_id ? ` · ${teamName(b.staff_id)}` : ''}
                      </span>
                    ))}
                  </div>
                )}
                {clash.length > 0 && <div className="notice notice-warning"><AlertCircle /><span>{t('booking_clash')}</span></div>}
              </div>
            </section>

            <section className="stack">
              <h2 className="section-title">{t('log_services')}</h2>
              <div className="card stack">
                {services.length > 0 && (
                  <div className="chips" style={{ flexWrap: 'wrap' }}>
                    {services.map((s) => (
                      <button key={s.id} type="button" className="chip" aria-pressed onClick={() => setServiceIds(serviceIds.filter((x) => x !== s.id))}>
                        {nameOf(s, lang)} <X size={16} />
                      </button>
                    ))}
                  </div>
                )}
                <button type="button" className="btn btn-secondary btn-block" onClick={() => setPicking(true)}><Plus /> {t('booking_pick_services')}</button>
                <span className="field-label">{t('log_done_by')}</span>
                <div className="chips" style={{ flexWrap: 'wrap' }}>
                  <button type="button" className="chip" aria-pressed={staffId == null} onClick={() => setStaffId(null)}>{t('booking_anyone')}</button>
                  {doers.map((d) => (
                    <button key={d.id} type="button" className="chip" aria-pressed={staffId === d.id} onClick={() => setStaffId(d.id)}>
                      {d.display_name}{d.id === me.id ? ` (${t('me')})` : ''}
                    </button>
                  ))}
                </div>
                <Field label={`${t('booking_quoted')} (${t('optional')})`} htmlFor="bk-q"
                  hint={services.length && quoted !== suggested ? t('booking_menu_total', { amount: formatINR(suggested) }) : undefined}>
                  <MoneyInput id="bk-q" value={quoted} onChange={(n) => { setQuoted(n); setQuotedTouched(true); }} />
                </Field>
              </div>
            </section>

            {!editId && (
              <section className="stack">
                <h2 className="section-title">{t('booking_advance_now')} <span style={{ fontWeight: 500 }}>({t('optional')})</span></h2>
                <div className="card stack">
                  <MoneyInput aria-label={t('amount')} value={advance} onChange={setAdvance} />
                  {!!advance && <Choices<PayMode> label={t('mode')} value={advanceMode} onChange={setAdvanceMode} options={payModeOptions(t)} />}
                </div>
              </section>
            )}

            <Field label={`${t('note')} (${t('optional')})`} htmlFor="bk-no">
              <textarea id="bk-no" className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('booking_note_example')} />
            </Field>

            {save.error && <ErrorBox error={save.error} />}
            <div className="sticky-actions">
              <button className="btn btn-primary btn-lg btn-block" disabled={!valid || save.isPending} aria-busy={save.isPending} onClick={() => save.mutate()}>
                <Check /> {editId ? t('save') : t('booking_save')}
              </button>
            </div>
          </>
        )}
      </Page>

      {picking && <ServicePicker selected={serviceIds} onDone={(ids) => { setServiceIds(ids); setPicking(false); }} onClose={() => setPicking(false)} />}
    </>
  );
}

/** Tick the services a booking is for. */
function ServicePicker({ selected, onDone, onClose }: { selected: string[]; onDone: (ids: string[]) => void; onClose: () => void }) {
  const { t, lang } = useI18n();
  const catalog = useServiceCatalog();
  const [ids, setIds] = useState(selected);
  const [q, setQ] = useState('');
  const toggle = (id: string) => { haptic(); setIds(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]); };
  return (
    <Sheet open onClose={onClose} title={t('booking_pick_services')}>
      <div className="stack">
        <SearchInput value={q} onChange={setQ} placeholder={t('log_search')} />
        <Loaded q={catalog}>
          {({ categories, services }) => {
            const query = q.trim().toLowerCase();
            const match = (s: Service) => !query || s.name_en.toLowerCase().includes(query) || (s.name_hi ?? '').includes(q.trim());
            return (
              <div className="stack" style={{ gap: 14 }}>
                {categories.map((c) => {
                  const items = services.filter((s) => s.category_id === c.id && match(s));
                  if (!items.length) return null;
                  return (
                    <div key={c.id} className="stack" style={{ gap: 6 }}>
                      <h3 className="section-title" style={{ margin: 0 }}>{nameOf(c, lang)}</h3>
                      <div className="list">
                        {items.map((s) => (
                          <label key={s.id} className="list-item" style={{ cursor: 'pointer' }}>
                            <input type="checkbox" checked={ids.includes(s.id)} onChange={() => toggle(s.id)} />
                            <span className="grow">{nameOf(s, lang)}</span>
                            <span className="end num muted small">{priceLabel(s, t('from'))}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          }}
        </Loaded>
        <div className="sticky-actions no-nav-in-sheet stack" style={{ gap: 8 }}>
          <button className="btn btn-primary btn-lg btn-block" onClick={() => onDone(ids)}>
            <Check /> {t('booking_pick_done', { n: ids.length })}
          </button>
          <SheetCloseButton />
        </div>
      </div>
    </Sheet>
  );
}

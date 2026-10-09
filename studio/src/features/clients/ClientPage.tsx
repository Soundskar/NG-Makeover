import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, Cake, Check, MessageCircle, Pencil, Phone, Star, StickyNote } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTeamNames } from '../../auth/auth';
import { Count, ErrorBox, Field, Loaded, Money, Page, Sheet, TopBar, useToast } from '../../components/ui';
import { useI18n } from '../../i18n/i18n';
import { daysUntilBirthday, formatDate, formatTime, todayIST } from '../../lib/dates';
import { formatINR, sum } from '../../lib/money';
import { must, supabase } from '../../lib/supabase';
import type { Client } from '../../lib/types';
import { formatPhone, telLink, waLink } from '../../lib/whatsapp';
import { useUdhaarStatus } from '../salon/data';
import { useSettings } from '../students/data';
import { birthdayMessage, useClientProfile } from './data';
import { ReviewSheet } from './ReviewSheet';

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

/** Owner: one client's story: visits, spend, favourite services, notes, birthday, bookings. */
export default function ClientPage() {
  const { phone = '' } = useParams();
  const { t, lang } = useI18n();
  const q = useClientProfile(phone);
  const udhaar = useUdhaarStatus();
  const settings = useSettings();
  const nameOf = useTeamNames();
  const today = todayIST();
  const studio = settings.data?.settings.studio_name ?? 'Namita Garg Makeover';
  const [editing, setEditing] = useState(false);
  const [asking, setAsking] = useState(false);

  return (
    <>
      <TopBar title={q.data?.client?.name ?? formatPhone(phone)} back="/clients" />
      <Page>
        <Loaded q={q} skeleton="cards">
          {({ client, visits, bookings }) => {
            const name = client?.name ?? visits.find((v) => v.client_name)?.client_name ?? null;
            const live = visits.filter((v) => !v.voided);
            const spent = sum(live.map((v) => v.total));
            const owed = sum((udhaar.data ?? []).filter((u) => u.client_phone === phone).map((u) => u.outstanding));
            const upcoming = bookings.filter((b) => b.status === 'booked' && b.day >= today).sort((a, b) => a.day.localeCompare(b.day));
            // Favourite services: the ones she comes back for most.
            const counts = new Map<string, number>();
            for (const v of live) for (const l of v.visit_lines) counts.set(l.service_name, (counts.get(l.service_name) ?? 0) + 1);
            const favourites = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
            const bdayIn = client?.birth_day && client.birth_month ? daysUntilBirthday(client.birth_day, client.birth_month, today) : null;
            const call = telLink(phone);
            const wa = waLink(phone, '');
            const wish = waLink(phone, birthdayMessage({ t, studio, name }));

            return (
              <>
                <div className="card stack" style={{ gap: 10 }}>
                  <div className="row-between">
                    <span className="muted num">{formatPhone(phone)}</span>
                    {live.length > 0 && <span className="muted small">{t('client_since', { date: formatDate(live[live.length - 1]!.visit_date, lang, false) })}</span>}
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    {call && <a className="btn btn-secondary grow" href={call}><Phone /> {t('call')}</a>}
                    {wa && <a className="btn btn-whatsapp grow" href={wa} target="_blank" rel="noopener"><MessageCircle /> WhatsApp</a>}
                  </div>
                </div>

                <div className="stat-grid">
                  <div className="card stack" style={{ gap: 2 }}>
                    <span className="stat-label">{t('client_visits')}</span>
                    <Count n={live.length} className="stat-value" />
                  </div>
                  <div className="card stack" style={{ gap: 2 }}>
                    <span className="stat-label">{t('client_spent')}</span>
                    <Money n={spent} className="stat-value" animate />
                    {live.length > 1 && <span className="stat-sub num">{t('client_avg', { amount: formatINR(Math.round(spent / live.length)) })}</span>}
                  </div>
                </div>

                {owed > 0 && (
                  <Link to="/salon/udhaar" className="notice notice-warning"><span className="grow">{t('udhaar_owed', { amount: formatINR(owed) })}</span></Link>
                )}

                {/* ----- what to remember about her ----- */}
                <section className="card stack" style={{ gap: 10 }}>
                  <div className="row-between">
                    <h2 className="card-title row" style={{ gap: 8 }}><StickyNote size={20} /> {t('client_notes')}</h2>
                    <button className="btn btn-sm btn-soft" onClick={() => setEditing(true)}><Pencil /> {t('edit')}</button>
                  </div>
                  <p style={{ whiteSpace: 'pre-wrap' }} className={client?.notes ? undefined : 'muted'}>{client?.notes || t('client_notes_empty')}</p>
                  <div className="row-between">
                    <span className="row" style={{ gap: 8 }}>
                      <Cake size={20} className="muted" />
                      {client?.birth_day && client.birth_month
                        ? <span>{formatDate(`2000-${String(client.birth_month).padStart(2, '0')}-${String(client.birth_day).padStart(2, '0')}`, lang, false)}
                          {bdayIn != null && bdayIn <= 7 && <span className="badge badge-primary" style={{ marginLeft: 8 }}>{bdayIn === 0 ? t('birthday_today') : t('birthday_in', { n: bdayIn })}</span>}</span>
                        : <span className="muted">{t('client_no_birthday')}</span>}
                    </span>
                    {bdayIn != null && bdayIn <= 7 && wish && (
                      <a className="btn btn-sm btn-whatsapp" href={wish} target="_blank" rel="noopener"><Cake /> {t('birthday_wish')}</a>
                    )}
                  </div>
                </section>

                {favourites.length > 0 && (
                  <section className="card stack" style={{ gap: 6 }}>
                    <h2 className="card-title">{t('client_favourites')}</h2>
                    {favourites.map(([s, n]) => (
                      <div key={s} className="row-between"><span>{s}</span><span className="muted num">× {n}</span></div>
                    ))}
                  </section>
                )}

                <div className="stack">
                  <Link to={`/bookings/new?phone=${phone}`} className="btn btn-primary btn-lg btn-block"><CalendarPlus /> {t('booking_new')}</Link>
                  <button className="btn btn-soft btn-block" onClick={() => setAsking(true)}>
                    <Star /> {t('review_title')}
                    {client?.review_asked_on && <span className="small" style={{ fontWeight: 500 }}>· {t('review_asked_on', { date: formatDate(client.review_asked_on, lang, false) })}</span>}
                  </button>
                </div>

                {upcoming.length > 0 && (
                  <section className="stack">
                    <h2 className="section-title">{t('client_upcoming')}</h2>
                    <div className="list">
                      {upcoming.map((b) => (
                        <Link key={b.id} to={`/bookings?d=${b.day}`} className="list-item">
                          <span className="grow">
                            <span className="title" style={{ display: 'block' }}>{formatDate(b.day, lang)} · {formatTime(b.start_time, lang)}</span>
                            <span className="sub">{b.services_text ?? ''}</span>
                          </span>
                        </Link>
                      ))}
                    </div>
                  </section>
                )}

                <section className="stack">
                  <h2 className="section-title">{t('client_history')}</h2>
                  {visits.length === 0 ? <p className="muted">{t('client_no_visits')}</p> : (
                    <div className="list">
                      {visits.map((v) => (
                        <div key={v.id} className="list-item" style={{ alignItems: 'flex-start', opacity: v.voided ? 0.55 : 1 }}>
                          <span className="grow">
                            <span className="title" style={{ display: 'block', textDecoration: v.voided ? 'line-through' : undefined }}>
                              {[...v.visit_lines].sort((a, b) => a.sort - b.sort).map((l) => l.service_name).join(', ')}
                            </span>
                            <span className="sub">
                              {formatDate(v.visit_date, lang)} · {[...new Set(v.visit_lines.map((l) => nameOf(l.staff_id)))].join(', ')}
                              {v.discount > 0 ? ` · ${t('entry_discount_badge', { amount: formatINR(v.discount) })}` : ''}
                            </span>
                          </span>
                          <span className="end num title">{formatINR(v.total)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {editing && <EditClientSheet phone={phone} client={client} fallbackName={name} onClose={() => setEditing(false)} />}
                {asking && <ReviewSheet phone={phone} name={name} onClose={() => setAsking(false)} />}
              </>
            );
          }}
        </Loaded>
      </Page>
    </>
  );
}

function EditClientSheet({ phone, client, fallbackName, onClose }: {
  phone: string; client: Client | null; fallbackName: string | null; onClose: () => void;
}) {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState(client?.name ?? fallbackName ?? '');
  const [notes, setNotes] = useState(client?.notes ?? '');
  const [day, setDay] = useState(client?.birth_day ? String(client.birth_day) : '');
  const [month, setMonth] = useState(client?.birth_month ? String(client.birth_month) : '');
  const bdayOk = (day === '') === (month === '');
  const m = useMutation({
    mutationFn: async () => must(await supabase.from('clients').upsert({
      phone, name: name.trim() || null, notes: notes.trim() || null,
      birth_day: day ? Number(day) : null, birth_month: month ? Number(month) : null, updated_at: new Date().toISOString(),
    })),
    onSuccess: () => {
      for (const k of ['client', 'clients', 'client-card']) qc.invalidateQueries({ queryKey: [k] });
      toast({ kind: 'success', text: t('saved') });
      onClose();
    },
  });
  const monthName = (n: number) => new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', { month: 'long', timeZone: 'UTC' })
    .format(new Date(Date.UTC(2000, n - 1, 1)));
  return (
    <Sheet open onClose={onClose} title={t('client_edit')}>
      <div className="stack">
        <Field label={t('name')} htmlFor="cl-n"><input id="cl-n" className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label={t('client_notes')} htmlFor="cl-no" hint={t('client_notes_hint')}>
          <textarea id="cl-no" className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <span className="field-label">{t('client_birthday')} ({t('optional')})</span>
        <div className="row" style={{ gap: 8 }}>
          <select className="select" aria-label={t('client_birthday_day')} value={day} onChange={(e) => setDay(e.target.value)} style={{ maxWidth: 110 }}>
            <option value="">—</option>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select className="select grow" aria-label={t('client_birthday_month')} value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="">—</option>
            {MONTHS.map((mo) => <option key={mo} value={mo}>{monthName(mo)}</option>)}
          </select>
        </div>
        {!bdayOk && <div className="field"><p className="error">{t('client_birthday_both')}</p></div>}
        {m.error && <ErrorBox error={m.error} />}
        <button className="btn btn-primary btn-lg btn-block" disabled={!bdayOk || m.isPending} aria-busy={m.isPending} onClick={() => m.mutate()}>
          <Check /> {t('save')}
        </button>
      </div>
    </Sheet>
  );
}

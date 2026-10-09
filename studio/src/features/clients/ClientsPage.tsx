import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Cake, ChevronRight, StickyNote, Users } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { Empty, Initials, Loaded, Page, SearchInput, TopBar, useToast } from '../../components/ui';
import { errorText, useI18n } from '../../i18n/i18n';
import { daysUntilBirthday, formatDate, todayIST } from '../../lib/dates';
import { haptic } from '../../lib/haptics';
import { formatINR } from '../../lib/money';
import { must, supabase } from '../../lib/supabase';
import { formatPhone, normalizePhone, waLink } from '../../lib/whatsapp';
import { useSettings } from '../students/data';
import { birthdayMessage, useClientList } from './data';

/** Owner: everyone who has visited or booked, with birthdays coming up. */
export default function ClientsPage() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const list = useClientList();
  const settings = useSettings();
  const studio = settings.data?.settings.studio_name ?? 'Namita Garg Makeover';
  const today = todayIST();
  const [params, setParams] = useSearchParams();
  const search = params.get('q') ?? '';
  // Birthday wishes sent this year, so a wished client drops off the list.
  const wished = useQuery({
    queryKey: ['birthday-wishes', today.slice(0, 4)],
    queryFn: async () => new Set((must(await supabase.from('client_followups').select('client_phone')
      .eq('kind', 'birthday').gte('noted_on', `${today.slice(0, 4)}-01-01`)) as { client_phone: string }[]).map((r) => r.client_phone)),
  });
  const wish = useMutation({
    mutationFn: async (phone: string) => must(await supabase.from('client_followups').insert({ client_phone: phone, kind: 'birthday' })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['birthday-wishes'] }),
    onError: (e) => toast({ kind: 'error', text: errorText(e, t) }),
  });

  return (
    <>
      <TopBar title={t('clients_title')} back="/salon" />
      <Page>
        <SearchInput value={search} onChange={(q) => setParams(q ? { q } : {}, { replace: true })} placeholder={t('students_search')} />
        <Loaded q={list}>
          {(all) => {
            const q = search.trim().toLowerCase();
            const digits = search.replace(/\D/g, '');
            const rows = all.filter((c) => !q || (c.name ?? '').toLowerCase().includes(q)
              || (digits.length >= 3 && c.phone.includes(normalizePhone(search) ?? digits)));
            const birthdays = all
              .filter((c) => c.birth_day && c.birth_month)
              .map((c) => ({ c, days: daysUntilBirthday(c.birth_day!, c.birth_month!, today) }))
              .filter((b) => b.days <= 7 && !wished.data?.has(b.c.phone))
              .sort((a, b) => a.days - b.days);
            return (
              <>
                {!q && birthdays.length > 0 && (
                  <section className="card stack" style={{ gap: 10 }}>
                    <h2 className="card-title row" style={{ gap: 8 }}><Cake size={22} /> {t('birthdays_week')}</h2>
                    {birthdays.map(({ c, days }) => {
                      const wa = waLink(c.phone, birthdayMessage({ t, studio, name: c.name }));
                      return (
                        <div key={c.phone} className="row-between">
                          <span className="grow">
                            <span style={{ fontWeight: 650, display: 'block' }}>{c.name ?? formatPhone(c.phone)}</span>
                            <span className="muted small">{days === 0 ? t('birthday_today') : t('birthday_in', { n: days })}</span>
                          </span>
                          {wa && (
                            <a className="btn btn-sm btn-whatsapp" href={wa} target="_blank" rel="noopener"
                              onClick={() => { haptic('success'); wish.mutate(c.phone); }}>
                              <Cake /> {t('birthday_wish')}
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </section>
                )}

                <p className="muted small">{t('clients_count', { n: rows.length })}</p>
                {rows.length === 0 ? <Empty icon={<Users />} title={q ? t('students_none_match') : t('clients_none')} sub={q ? undefined : t('clients_none_sub')} /> : (
                  <div className="list">
                    {rows.slice(0, 300).map((c) => (
                      <Link key={c.phone} to={`/clients/${c.phone}`} className="list-item">
                        <Initials name={c.name ?? c.phone} />
                        <span className="grow">
                          <span className="title" style={{ display: 'block' }}>
                            {c.name ?? formatPhone(c.phone)}
                            {c.has_notes && <StickyNote size={15} className="muted" style={{ marginLeft: 6, verticalAlign: '-2px' }} aria-label={t('client_notes')} />}
                          </span>
                          <span className="sub num" style={{ display: 'block' }}>
                            {c.visit_count ? t('callback_visits', { n: c.visit_count }) : t('client_new')}
                            {c.last_visit ? ` · ${formatDate(c.last_visit, lang, false)}` : ''}
                          </span>
                          {c.next_booking && (
                            <span className="badge badge-primary" style={{ marginTop: 4 }}>{t('client_booked_on', { date: formatDate(c.next_booking, lang, false) })}</span>
                          )}
                        </span>
                        {c.spent > 0 && <span className="end num title">{formatINR(c.spent)}</span>}
                        <ChevronRight className="chev" />
                      </Link>
                    ))}
                  </div>
                )}
              </>
            );
          }}
        </Loaded>
      </Page>
    </>
  );
}

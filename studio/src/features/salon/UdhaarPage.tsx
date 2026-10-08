import { useQuery } from '@tanstack/react-query';
import { Ban, Bell, HandCoins, Phone } from 'lucide-react';
import { useState } from 'react';
import { useTeamNames } from '../../auth/auth';
import { Empty, Initials, Loaded, Money, Page, TopBar } from '../../components/ui';
import { useI18n } from '../../i18n/i18n';
import { addDays, formatDate, todayIST } from '../../lib/dates';
import { formatINR, sum } from '../../lib/money';
import { must, supabase } from '../../lib/supabase';
import type { UdhaarCollection, UdhaarStatus } from '../../lib/types';
import { formatPhone, telLink, waLink } from '../../lib/whatsapp';
import { useSettings } from '../students/data';
import { useUdhaarStatus } from './data';
import { CancelCollectionSheet } from './MyDayPage';
import { CollectSheet } from './UdhaarSheets';

interface ClientOwes {
  phone: string;
  name: string | null;
  owed: number;
  since: string;
  entries: number;
}

/** Owner: who owes udhaar, reminders, and collecting it. */
export default function UdhaarPage() {
  const { t, lang } = useI18n();
  const status = useUdhaarStatus();
  const settings = useSettings();
  const nameOf = useTeamNames();
  const today = todayIST();
  const recent = useQuery({
    queryKey: ['udhaar', 'recent'],
    queryFn: async () => must(await supabase.from('udhaar_collections').select('*, visits(client_name, client_phone)')
      .gte('collected_on', addDays(today, -30)).order('created_at', { ascending: false }).limit(50)) as
      (UdhaarCollection & { visits: { client_name: string | null; client_phone: string | null } | null })[],
  });
  const [collecting, setCollecting] = useState<ClientOwes | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const studio = settings.data?.settings.studio_name ?? 'Namita Garg Makeover';

  return (
    <>
      <TopBar title={t('udhaar_title')} back="/salon" />
      <Page>
        <Loaded q={status} skeleton="cards">
          {(rows) => {
            const clients = groupByClient(rows);
            const total = sum(clients.map((c) => c.owed));
            return (
              <>
                <div className="card hero stack" style={{ gap: 2 }}>
                  <span className="stat-label">{t('udhaar_to_collect')}</span>
                  <Money n={total} className="stat-value" animate />
                  <span className="stat-sub">{t('udhaar_clients', { n: clients.length })}</span>
                </div>
                {clients.length === 0 ? <Empty icon={<HandCoins />} title={t('udhaar_none')} /> : (
                  <div className="stack stagger">
                    {clients.map((c) => {
                      const remind = waLink(c.phone, t('udhaar_remind_msg', {
                        name: (c.name ?? '').split(' ')[0] || '', studio, amount: formatINR(c.owed), date: formatDate(c.since, lang),
                      }));
                      const call = telLink(c.phone);
                      return (
                        <div key={c.phone} className="card stack" style={{ gap: 10 }}>
                          <div className="row">
                            <Initials name={c.name ?? c.phone} />
                            <span className="grow">
                              <span style={{ fontWeight: 700, display: 'block' }}>{c.name ?? formatPhone(c.phone)}</span>
                              <span className="muted small num">
                                {formatPhone(c.phone)} · {t('since', { date: formatDate(c.since, lang, false) })}
                              </span>
                            </span>
                            <Money n={c.owed} className="stat-label text-warning" />
                          </div>
                          <div className="row" style={{ gap: 8 }}>
                            {call && <a className="btn btn-sm btn-secondary" href={call} aria-label={t('call')}><Phone /></a>}
                            {remind && (
                              <a className="btn btn-sm btn-whatsapp grow" href={remind} target="_blank" rel="noopener"><Bell /> {t('remind')}</a>
                            )}
                            <button className="btn btn-sm btn-primary grow" onClick={() => setCollecting(c)}>
                              <HandCoins /> {t('udhaar_collect')}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            );
          }}
        </Loaded>

        {(recent.data?.length ?? 0) > 0 && (
          <section className="stack">
            <h2 className="section-title">{t('udhaar_recent')}</h2>
            <div className="list">
              {recent.data!.map((c) => (
                <div key={c.id} className="list-item" style={{ opacity: c.voided ? 0.55 : 1 }}>
                  <span className="grow">
                    <span className="title" style={{ display: 'block', textDecoration: c.voided ? 'line-through' : undefined }}>
                      {c.visits?.client_name ?? formatPhone(c.visits?.client_phone ?? '')}
                    </span>
                    <span className="sub num">
                      {formatDate(c.collected_on, lang, false)} · {t(c.mode)} · {nameOf(c.collected_by)}
                      {c.voided ? ` · ${t('entry_cancelled')}` : ''}
                    </span>
                  </span>
                  <Money n={c.amount} className="title" />
                  {!c.voided && (
                    <button className="icon-btn" aria-label={t('udhaar_cancel')} onClick={() => setCancelling(c.id)}><Ban /></button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {collecting && (
          <CollectSheet phone={collecting.phone} name={collecting.name} owed={collecting.owed} onClose={() => setCollecting(null)} />
        )}
        {cancelling && <CancelCollectionSheet id={cancelling} onClose={() => setCancelling(null)} />}
      </Page>
    </>
  );
}

/** One row per client (by phone), oldest debt first. */
function groupByClient(rows: UdhaarStatus[]): ClientOwes[] {
  const by = new Map<string, ClientOwes>();
  for (const r of rows) {
    if (r.outstanding <= 0 || !r.client_phone) continue;
    const c = by.get(r.client_phone) ?? { phone: r.client_phone, name: r.client_name, owed: 0, since: r.visit_date, entries: 0 };
    c.owed += r.outstanding;
    c.entries += 1;
    if (r.visit_date < c.since) c.since = r.visit_date;
    c.name = c.name ?? r.client_name;
    by.set(r.client_phone, c);
  }
  return [...by.values()].sort((a, b) => a.since.localeCompare(b.since));
}

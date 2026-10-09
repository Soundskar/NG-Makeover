import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellOff, Heart, MessageCircle, Phone } from 'lucide-react';
import { useState } from 'react';
import { Confirm, Empty, Initials, Loaded, Page, TopBar, useToast } from '../../components/ui';
import { errorText, useI18n } from '../../i18n/i18n';
import { daysBetween, formatDate, todayIST } from '../../lib/dates';
import { haptic } from '../../lib/haptics';
import { must, supabase } from '../../lib/supabase';
import { formatPhone, telLink, waLink } from '../../lib/whatsapp';
import { useSettings } from '../students/data';

export interface DueClient {
  client_phone: string;
  client_name: string | null;
  last_visit: string;
  last_services: string;
  visit_count: number;
  due_on: string;
  last_reminded: string | null;
}

export function useClientsDue() {
  return useQuery({
    queryKey: ['clients-due'],
    queryFn: async () => must(await supabase.rpc('clients_due')) as DueClient[],
  });
}

/** Owner: clients whose usual gap since their last visit has passed, with a friendly reminder ready to send. */
export default function CallbackPage() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const due = useClientsDue();
  const settings = useSettings();
  const studio = settings.data?.settings.studio_name ?? 'Namita Garg Makeover';
  const today = todayIST();
  const [stopping, setStopping] = useState<DueClient | null>(null);

  const note = useMutation({
    mutationFn: async ({ phone, kind }: { phone: string; kind: 'reminded' | 'stop' }) =>
      (must(await supabase.from('client_followups').insert({ client_phone: phone, kind }).select('id').single()) as { id: string }).id,
    onSuccess: (id, { kind }) => {
      qc.invalidateQueries({ queryKey: ['clients-due'] });
      toast({
        kind: 'success',
        text: kind === 'reminded' ? t('callback_marked') : t('callback_stopped'),
        action: {
          label: t('undo'),
          run: async () => {
            const { error } = await supabase.from('client_followups').delete().eq('id', id);
            if (error) toast({ kind: 'error', text: errorText(error, t) });
            qc.invalidateQueries({ queryKey: ['clients-due'] });
          },
        },
      });
      setStopping(null);
    },
    onError: (e) => toast({ kind: 'error', text: errorText(e, t) }),
  });

  return (
    <>
      <TopBar title={t('callback_title')} back="/salon" />
      <Page>
        <Loaded q={due} skeleton="cards">
          {(rows) => (
            <>
              {rows.length > 0 && <p className="muted">{t('callback_hint')}</p>}
              {rows.length === 0 ? <Empty icon={<Heart />} title={t('callback_none')} sub={t('callback_none_sub')} /> : (
                <div className="list">
                  {rows.map((c) => {
                    const name = c.client_name ?? formatPhone(c.client_phone);
                    const first = (c.client_name ?? '').trim().split(/\s+/)[0] ?? '';
                    const service = c.last_services.split(', ')[0] ?? c.last_services;
                    const ago = daysBetween(c.last_visit, today);
                    const msg = t('callback_msg', { name: first, service, studio });
                    const wa = waLink(c.client_phone, msg);
                    const call = telLink(c.client_phone);
                    return (
                      <div key={c.client_phone} className="list-item" style={{ flexWrap: 'wrap', rowGap: 8, alignItems: 'flex-start' }}>
                        <Initials name={name} />
                        <span className="grow">
                          <span className="title" style={{ display: 'block' }}>{name}</span>
                          <span className="sub" style={{ display: 'block' }}>{c.last_services}</span>
                          <span className="sub num">
                            {t('callback_last', { date: formatDate(c.last_visit, lang, false), n: ago })}
                            {c.visit_count > 1 ? ` · ${t('callback_visits', { n: c.visit_count })}` : ''}
                          </span>
                        </span>
                        <div className="row" style={{ gap: 6, width: '100%', paddingLeft: 52 }}>
                          {call && <a className="icon-btn icon-btn-sm icon-btn-fill" href={call} aria-label={t('call')}><Phone /></a>}
                          <button className="icon-btn icon-btn-sm icon-btn-fill" aria-label={t('callback_stop')} onClick={() => setStopping(c)}>
                            <BellOff />
                          </button>
                          {wa && (
                            <a className="btn btn-sm btn-whatsapp" style={{ marginLeft: 'auto' }} href={wa} target="_blank" rel="noopener"
                              onClick={() => { haptic(); note.mutate({ phone: c.client_phone, kind: 'reminded' }); }}>
                              <MessageCircle /> {t('callback_remind')}
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </Loaded>
        <p className="muted small center">{t('callback_how')}</p>
        <Confirm open={stopping != null} onClose={() => setStopping(null)} busy={note.isPending}
          title={t('callback_stop_confirm', { name: stopping?.client_name ?? formatPhone(stopping?.client_phone ?? '') })}
          body={t('callback_stop_body')} confirmLabel={t('callback_stop')}
          onConfirm={() => stopping && note.mutate({ phone: stopping.client_phone, kind: 'stop' })} />
      </Page>
    </>
  );
}

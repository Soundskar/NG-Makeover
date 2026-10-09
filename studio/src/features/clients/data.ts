import { useQuery } from '@tanstack/react-query';
import type { TFn } from '../../i18n/i18n';
import { formatDate, formatTime, type ISODate } from '../../lib/dates';
import { formatINR } from '../../lib/money';
import { must, supabase } from '../../lib/supabase';
import type { Booking, Client, ClientCard, ClientRow, Lang, VisitWithLines } from '../../lib/types';
import { normalizePhone } from '../../lib/whatsapp';

/** Notes, last visit and next booking for a phone number: owner and staff. */
export function useClientCard(phone: string) {
  const ten = normalizePhone(phone);
  return useQuery({
    queryKey: ['client-card', ten],
    enabled: !!ten,
    queryFn: async () => must(await supabase.rpc('client_card', { p_phone: ten })) as ClientCard,
  });
}

/** Owner: every client with visits and spend. */
export function useClientList() {
  return useQuery({
    queryKey: ['clients'],
    queryFn: async () => (must(await supabase.rpc('client_list')) as ClientRow[])
      .map((c) => ({ ...c, spent: Number(c.spent) })),
  });
}

/** Owner: one client's card, visits and bookings. */
export function useClientProfile(phone: string) {
  return useQuery({
    queryKey: ['client', phone],
    queryFn: async () => {
      const [c, v, b] = await Promise.all([
        supabase.from('clients').select('*').eq('phone', phone).maybeSingle(),
        supabase.from('visits').select('*, visit_lines(*)').eq('client_phone', phone)
          .order('visit_date', { ascending: false }).order('created_at', { ascending: false }).limit(200),
        supabase.from('appointments').select('*').eq('client_phone', phone).order('day', { ascending: false }).limit(50),
      ]);
      return { client: must(c) as Client | null, visits: must(v) as VisitWithLines[], bookings: must(b) as Booking[] };
    },
  });
}

const first = (name: string | null | undefined) => (name ?? '').trim().split(/\s+/)[0] ?? '';

export function reviewMessage(o: { t: TFn; studio: string; name: string | null; link: string }): string {
  return o.t('review_msg', { name: first(o.name), studio: o.studio, link: o.link });
}

export function birthdayMessage(o: { t: TFn; studio: string; name: string | null }): string {
  return o.t('birthday_msg', { name: first(o.name), studio: o.studio });
}

export function bookingMessage(o: {
  t: TFn; lang: Lang; studio: string; kind: 'confirm' | 'remind'; name: string; day: ISODate; time: string;
  services: string | null; advance: number;
}): string {
  const lines = [o.t(o.kind === 'confirm' ? 'booking_confirm_msg' : 'booking_remind_msg', {
    name: first(o.name), studio: o.studio, date: formatDate(o.day, o.lang), time: formatTime(o.time, o.lang),
    services: o.services || o.t('booking_your_visit'),
  })];
  if (o.advance > 0) lines.push(o.t('booking_msg_advance', { amount: formatINR(o.advance) }));
  lines.push(o.t('booking_msg_change'));
  return lines.join('\n');
}

import { useQuery } from '@tanstack/react-query';
import { formatINR } from '../../lib/money';
import { must, supabase } from '../../lib/supabase';
import type {
  DayClosing, Service, ServiceCategory, UdhaarCollection, UdhaarStatus, VisitWithLines, WorkLine,
} from '../../lib/types';
import { normalizePhone } from '../../lib/whatsapp';

export function useServiceCatalog(includeHidden = false) {
  return useQuery({
    queryKey: ['catalog', includeHidden],
    queryFn: async () => {
      let cq = supabase.from('service_categories').select('*').order('sort');
      let sq = supabase.from('services').select('*').order('sort');
      if (!includeHidden) {
        cq = cq.eq('active', true);
        sq = sq.eq('active', true);
      }
      const [cats, services] = await Promise.all([cq, sq]);
      return { categories: must(cats) as ServiceCategory[], services: must(services) as Service[] };
    },
    staleTime: 10 * 60_000,
  });
}

export function useFrequentServices() {
  return useQuery({
    queryKey: ['frequent-services'],
    queryFn: async () =>
      (must(await supabase.rpc('frequent_services', { p_limit: 6 })) as { service_id: string }[]).map((r) => r.service_id),
    staleTime: 30 * 60_000,
  });
}

/** Visits for one day. RLS decides: the owner gets everyone's, staff get their own. */
export function useVisits(day: string) {
  return useQuery({
    queryKey: ['visits', day],
    queryFn: async () =>
      must(await supabase.from('visits').select('*, visit_lines(*)').eq('visit_date', day)
        .order('created_at', { ascending: false })) as VisitWithLines[],
  });
}

export function useClosing(day: string) {
  return useQuery({
    queryKey: ['closing', day],
    queryFn: async () => must(await supabase.from('day_closings').select('*').eq('day', day).maybeSingle()) as DayClosing | null,
  });
}

/** Udhaar collected on one day (owner: everyone's; staff: their own, today). */
export function useUdhaarCollections(day: string) {
  return useQuery({
    queryKey: ['udhaar', 'collections', day],
    queryFn: async () => must(await supabase.from('udhaar_collections').select('*').eq('collected_on', day)
      .order('created_at', { ascending: false })) as UdhaarCollection[],
  });
}

/** Owner: every udhaar entry, with what is still owed. */
export function useUdhaarStatus(enabled = true) {
  return useQuery({
    queryKey: ['udhaar', 'status'],
    enabled,
    queryFn: async () => must(await supabase.from('udhaar_status').select('*').order('visit_date')) as UdhaarStatus[],
  });
}

/** What a client still owes, looked up from her phone number at the counter. */
export function useUdhaarForPhone(phone: string) {
  const ten = normalizePhone(phone);
  return useQuery({
    queryKey: ['udhaar', 'phone', ten],
    enabled: !!ten,
    queryFn: async () => must(await supabase.rpc('udhaar_for_phone', { p_phone: ten })) as
      { visit_id: string; visit_date: string; client_name: string | null; outstanding: number }[],
  });
}

/** The services I did myself over a period (the basis for my commission). */
export function useMyWork(from: string, to: string) {
  return useQuery({
    queryKey: ['work', 'mine', from, to],
    queryFn: async () => must(await supabase.rpc('my_work', { p_from: from, p_to: to })) as WorkLine[],
  });
}

export interface StaffWork {
  staff_id: string;
  services: number;
  menu_value: number;
  charged: number;
  discount: number;
  net: number;
}

/** Owner: everyone's work over a period, one row per person. */
export function useWorkByStaff(from: string, to: string) {
  return useQuery({
    queryKey: ['work', 'staff', from, to],
    queryFn: async () => (must(await supabase.rpc('work_by_staff', { p_from: from, p_to: to })) as Record<string, number | string>[])
      .map((r) => ({
        staff_id: String(r.staff_id), services: Number(r.services), menu_value: Number(r.menu_value),
        charged: Number(r.charged), discount: Number(r.discount), net: Number(r.net),
      }) satisfies StaffWork)
      .sort((a, b) => b.net - a.net),
  });
}

/** '₹350', '₹450–₹1,150' or 'From ₹550' */
export function priceLabel(s: Service, fromWord: string): string {
  if (s.is_variable) return `${fromWord} ${formatINR(s.price)}`;
  if (s.price_min != null && s.price_max != null && s.price_min !== s.price_max) {
    return `${formatINR(s.price_min)}–${formatINR(s.price_max)}`;
  }
  return formatINR(s.price);
}

/** Services whose price staff must type in (ranges and 'From' prices). */
export const needsPrice = (s: Service) =>
  s.is_variable || (s.price_min != null && s.price_max != null && s.price_min !== s.price_max);

export interface DaySummary {
  /** Billed after discounts (includes udhaar). */
  total: number;
  cash: number;
  upi: number;
  card: number;
  udhaar: number;
  discount: number;
  count: number;
  /** Work per person: what their services were charged at, after their share of discounts. */
  byStaff: Map<string, { amount: number; services: number }>;
}

export function summarizeDay(visits: VisitWithLines[]): DaySummary {
  const s: DaySummary = { total: 0, cash: 0, upi: 0, card: 0, udhaar: 0, discount: 0, count: 0, byStaff: new Map() };
  for (const v of visits) {
    if (v.voided) continue;
    s.total += v.total;
    s.cash += v.paid_cash;
    s.upi += v.paid_upi;
    s.card += v.paid_card;
    s.udhaar += v.paid_udhaar ?? 0;
    s.discount += v.discount ?? 0;
    s.count += 1;
    for (const l of v.visit_lines) {
      const cur = s.byStaff.get(l.staff_id) ?? { amount: 0, services: 0 };
      cur.amount += l.price - (l.discount ?? 0);
      cur.services += 1;
      s.byStaff.set(l.staff_id, cur);
    }
  }
  return s;
}

export function payModeLabel(
  v: { paid_cash: number; paid_upi: number; paid_card: number; paid_udhaar?: number },
  t: (k: 'cash' | 'upi' | 'card' | 'udhaar') => string,
): string {
  const parts: string[] = [];
  if (v.paid_cash) parts.push(t('cash'));
  if (v.paid_upi) parts.push(t('upi'));
  if (v.paid_card) parts.push(t('card'));
  if (v.paid_udhaar) parts.push(t('udhaar'));
  return parts.join(' + ');
}

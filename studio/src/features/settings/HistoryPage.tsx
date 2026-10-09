import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTeamNames } from '../../auth/auth';
import { Empty, Initials, Loaded, Page, TopBar } from '../../components/ui';
import { useI18n, type TFn, type TKey } from '../../i18n/i18n';
import { formatDate, formatDateTime } from '../../lib/dates';
import { formatINR } from '../../lib/money';
import { must, supabase } from '../../lib/supabase';
import { diffText } from '../salon/SalonDayPage';

interface AuditRow {
  id: number;
  table_name: string;
  row_id: string | null;
  action: 'insert' | 'update' | 'delete';
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  actor: string | null;
  at: string;
}

const FILTERS = ['all', 'payments', 'visits', 'udhaar_collections', 'installments', 'services', 'profiles'] as const;
type Filter = typeof FILTERS[number];
const PAGE = 100;
const IGNORED = new Set(['updated_at', 'marked_at', 'closed_at', 'voided_at', 'voided_by', 'created_at', 'id', 'sort']);
const MONEY = new Set(['amount', 'total', 'price', 'price_min', 'price_max', 'list_fee', 'agreed_fee', 'paid_cash', 'paid_upi', 'paid_card', 'paid_udhaar', 'discount', 'expected_cash', 'counted_cash']);

type Row = Record<string, unknown>;
const str = (v: unknown) => (v == null ? '' : String(v));

/** A value as people read it: rupees, dates, words instead of codes. */
function show(key: string, v: unknown, t: TFn, lang: 'en' | 'hi'): string {
  if (v == null || v === '') return '—';
  if (MONEY.has(key) && typeof v === 'number') return formatINR(v);
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return formatDate(v, lang);
  if (typeof v === 'boolean') return v ? t('yes') : t('no');
  if (key === 'mode' || ['present', 'absent', 'leave'].includes(String(v))) return t(String(v) as TKey);
  return String(v);
}

/** One line saying what happened, in the reader's language. */
function describe(r: AuditRow, t: TFn, lang: 'en' | 'hi'): string {
  const n = (r.new_data ?? {}) as Row;
  const o = (r.old_data ?? {}) as Row;
  const d = r.action === 'delete' ? o : n;
  const cancelled = r.action === 'update' && n.voided === true && o.voided === false;

  switch (r.table_name) {
    case 'payments':
      return [cancelled ? t('history_cancelled', { reason: str(n.void_reason) }) : null,
        formatINR(Number(d.amount)), d.mode ? t(String(d.mode) as TKey) : null, str(d.receipt_no)]
        .filter(Boolean).join(' · ');
    case 'visits':
      return [cancelled ? t('history_cancelled', { reason: str(n.void_reason) }) : null,
        formatINR(Number(d.total)), str(d.client_name) || null, d.visit_date ? formatDate(String(d.visit_date), lang) : null,
        Number(d.discount) > 0 ? t('entry_discount_badge', { amount: formatINR(Number(d.discount)) }) : null,
        Number(d.paid_udhaar) > 0 ? t('entry_udhaar_badge', { amount: formatINR(Number(d.paid_udhaar)) }) : null]
        .filter(Boolean).join(' · ');
    case 'udhaar_collections':
      return [cancelled ? t('history_cancelled', { reason: str(n.void_reason) }) : null,
        formatINR(Number(d.amount)), d.mode ? t(String(d.mode) as TKey) : null, formatDate(String(d.collected_on), lang)]
        .filter(Boolean).join(' · ');
    case 'day_closings':
      return `${formatDate(String(d.day), lang)} · ${diffText(Number(d.counted_cash) - Number(d.expected_cash), t)}`;
    case 'attendance':
      return `${formatDate(String(d.day), lang)} · ${t(String(d.status) as TKey)}`;
  }

  const label = str(d.full_name || d.display_name || d.client_name || d.name || d.name_en || d.title_en);
  if (r.table_name === 'profiles' && r.action === 'update' && o.active !== n.active) {
    return `${label} · ${n.active ? t('login_switched_on') : t('login_switched_off')}`;
  }
  if (r.action !== 'update') {
    const extra = ['amount', 'price', 'list_fee', 'agreed_fee', 'due_date']
      .filter((k) => d[k] != null).map((k) => show(k, d[k], t, lang));
    return [label, ...extra].filter(Boolean).join(' · ');
  }
  const changes = Object.keys(n)
    .filter((k) => !IGNORED.has(k) && JSON.stringify(o[k]) !== JSON.stringify(n[k]))
    .map((k) => `${k.replace(/_/g, ' ')}: ${show(k, o[k], t, lang)} → ${show(k, n[k], t, lang)}`);
  return [label, ...changes].filter(Boolean).join(' · ');
}

/** Owner: who changed what, newest first. */
export default function HistoryPage() {
  const { t, lang } = useI18n();
  const nameOf = useTeamNames();
  const [filter, setFilter] = useState<Filter>('all');
  const [limit, setLimit] = useState(PAGE);
  const q = useQuery({
    queryKey: ['audit', filter, limit],
    queryFn: async () => {
      let req = supabase.from('audit_log').select('*').order('at', { ascending: false }).limit(limit);
      if (filter !== 'all') req = req.eq('table_name', filter);
      return must(await req) as AuditRow[];
    },
    placeholderData: (prev) => prev,
  });

  const tableLabel = (name: string) => {
    const key = `history_t_${name}` as TKey;
    const s = t(key);
    return s === key ? name : s;
  };

  return (
    <>
      <TopBar title={t('history_title')} back="/more" />
      <Page>
        <div className="chips" role="toolbar">
          {FILTERS.map((f) => (
            <button key={f} className="chip" aria-pressed={filter === f} onClick={() => { setFilter(f); setLimit(PAGE); }}>
              {t(`history_${f}`)}
            </button>
          ))}
        </div>
        <Loaded q={q}>
          {(rows) => rows.length === 0 ? <Empty title={t('history_none')} /> : (
            <>
              <div className="list">
                {rows.map((r) => {
                  // Logins are changed through a server function only the owner can use, so
                  // those rows carry no person; anything else without one came from setup.
                  const who = r.actor ? nameOf(r.actor) : r.table_name === 'profiles' ? t('role_owner') : t('history_system');
                  const cancelled = r.action === 'update' && r.new_data?.voided === true && r.old_data?.voided === false;
                  return (
                    <div key={r.id} className="list-item" style={{ alignItems: 'flex-start' }}>
                      <Initials name={who} />
                      <span className="grow">
                        <span className="title" style={{ display: 'block' }}>
                          {t(`history_action_${r.action}`)} · {tableLabel(r.table_name)}
                          {cancelled && <> <span className="badge badge-danger">{t('payment_cancelled')}</span></>}
                        </span>
                        <span className="sub" style={{ display: 'block', wordBreak: 'break-word' }}>{describe(r, t, lang)}</span>
                        <span className="sub small">{who} · {formatDateTime(r.at, lang)}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
              {rows.length >= limit && (
                <button className="btn btn-secondary btn-block" aria-busy={q.isFetching} disabled={q.isFetching}
                  onClick={() => setLimit((n) => n + PAGE)}>
                  {t('history_load_more')}
                </button>
              )}
            </>
          )}
        </Loaded>
      </Page>
    </>
  );
}

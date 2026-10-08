import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTeamNames } from '../../auth/auth';
import { Empty, Loaded, Page, TopBar } from '../../components/ui';
import { useI18n } from '../../i18n/i18n';
import { formatDateTime } from '../../lib/dates';
import { must, supabase } from '../../lib/supabase';

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

const FILTERS = ['all', 'payments', 'visits', 'installments', 'services', 'profiles'] as const;
type Filter = typeof FILTERS[number];
const IGNORED = new Set(['updated_at', 'marked_at', 'closed_at', 'voided_at']);

function changes(r: AuditRow): string {
  if (r.action !== 'update' || !r.old_data || !r.new_data) {
    const d = r.new_data ?? r.old_data ?? {};
    return ['full_name', 'display_name', 'name_en', 'receipt_no', 'amount', 'total', 'status']
      .filter((k) => d[k] != null).map((k) => `${k}: ${String(d[k])}`).join(' · ');
  }
  return Object.keys(r.new_data)
    .filter((k) => !IGNORED.has(k) && JSON.stringify(r.old_data![k]) !== JSON.stringify(r.new_data![k]))
    .map((k) => `${k}: ${String(r.old_data![k] ?? '—')} → ${String(r.new_data![k] ?? '—')}`)
    .join(' · ');
}

/** Owner: who changed what, newest first. */
export default function HistoryPage() {
  const { t, lang } = useI18n();
  const nameOf = useTeamNames();
  const [filter, setFilter] = useState<Filter>('all');
  const q = useQuery({
    queryKey: ['audit', filter],
    queryFn: async () => {
      let req = supabase.from('audit_log').select('*').order('at', { ascending: false }).limit(150);
      if (filter !== 'all') req = req.eq('table_name', filter);
      return must(await req) as AuditRow[];
    },
  });

  return (
    <>
      <TopBar title={t('history_title')} back="/more" />
      <Page>
        <div className="chips" role="toolbar">
          {FILTERS.map((f) => (
            <button key={f} className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>{t(`history_${f}`)}</button>
          ))}
        </div>
        <Loaded q={q}>
          {(rows) => rows.length === 0 ? <Empty title={t('history_none')} /> : (
            <div className="list">
              {rows.map((r) => (
                <div key={r.id} className="list-item" style={{ alignItems: 'flex-start' }}>
                  <span className="grow">
                    <span className="title" style={{ display: 'block' }}>
                      {t(`history_action_${r.action}`)} · {r.table_name}
                    </span>
                    <span className="sub" style={{ display: 'block', wordBreak: 'break-word' }}>{changes(r)}</span>
                    <span className="sub small">{nameOf(r.actor)} · {formatDateTime(r.at, lang)}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Loaded>
      </Page>
    </>
  );
}

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ban, Phone } from 'lucide-react';
import { useState } from 'react';
import { useTeamNames } from '../../auth/auth';
import { ErrorBox, Field, Money, Sheet, useToast } from '../../components/ui';
import { useI18n } from '../../i18n/i18n';
import { formatClock } from '../../lib/dates';
import { formatINR } from '../../lib/money';
import { must, supabase } from '../../lib/supabase';
import type { VisitWithLines } from '../../lib/types';
import { formatPhone } from '../../lib/whatsapp';
import { payModeLabel } from './data';

const CANCEL_WINDOW_MS = 15 * 60_000;

/** One logged visit. `canCancel` decides whether the cancel button shows. */
export function VisitCard({ v, showCreator, canCancel }: {
  v: VisitWithLines; showCreator?: boolean; canCancel: boolean;
}) {
  const { t, lang } = useI18n();
  const nameOf = useTeamNames();
  const [cancelOpen, setCancelOpen] = useState(false);
  const lines = [...v.visit_lines].sort((a, b) => a.sort - b.sort);

  return (
    <article className="card stack" style={{ gap: 8, opacity: v.voided ? 0.6 : 1 }}>
      <div className="row-between" style={{ alignItems: 'flex-start' }}>
        <div className="stack grow" style={{ gap: 0 }}>
          <span className="muted small num">{formatClock(v.created_at, lang)}{showCreator ? ` · ${t('entered_by', { name: nameOf(v.created_by) })}` : ''}</span>
          {v.client_name && <span style={{ fontWeight: 650 }}>{v.client_name}</span>}
          {v.client_phone && (
            <span className="muted small num" style={{ whiteSpace: 'nowrap' }}>
              <Phone size={14} style={{ verticalAlign: '-2px' }} /> {formatPhone(v.client_phone)}
            </span>
          )}
        </div>
        <div className="stack" style={{ gap: 0, alignItems: 'flex-end', textAlign: 'right', maxWidth: '45%' }}>
          <Money n={v.total} className={v.voided ? '' : 'stat-label'} />
          <span className="muted small">{payModeLabel(v, t)}</span>
        </div>
      </div>
      <ul className="stack" style={{ gap: 4, listStyle: 'none' }}>
        {lines.map((l) => (
          <li key={l.id} className="row-between small">
            <span className="grow">
              {l.service_name}
              <span className="muted"> · {nameOf(l.staff_id)}</span>
            </span>
            <span className="num" style={{ textAlign: 'right' }}>
              {formatINR(l.price)}
              {l.price < l.list_price && (
                <><br /><span className="badge badge-warning">{t('log_menu_price', { price: formatINR(l.list_price) })}</span></>
              )}
            </span>
          </li>
        ))}
      </ul>
      {(v.discount > 0 || v.paid_udhaar > 0) && (
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {v.discount > 0 && (
            <span className="badge badge-success">
              {t('entry_discount_badge', { amount: formatINR(v.discount) })}{v.discount_note ? ` · ${v.discount_note}` : ''}
            </span>
          )}
          {v.paid_udhaar > 0 && <span className="badge badge-warning">{t('entry_udhaar_badge', { amount: formatINR(v.paid_udhaar) })}</span>}
        </div>
      )}
      {v.voided ? (
        <span className="badge badge-danger" style={{ alignSelf: 'flex-start' }}>
          {t('entry_cancelled')}{v.void_reason ? `: ${v.void_reason}` : ''}
        </span>
      ) : canCancel && (
        <button className="btn btn-sm btn-danger" style={{ alignSelf: 'flex-start' }} onClick={() => setCancelOpen(true)}>
          <Ban /> {t('entry_cancel')}
        </button>
      )}
      {cancelOpen && <CancelSheet visitId={v.id} onClose={() => setCancelOpen(false)} />}
    </article>
  );
}

export function withinCancelWindow(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < CANCEL_WINDOW_MS;
}

function CancelSheet({ visitId, onClose }: { visitId: string; onClose: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const m = useMutation({
    mutationFn: async () => must(await supabase.rpc('void_visit', { p_id: visitId, p_reason: reason })),
    onSuccess: () => {
      for (const k of ['visits', 'work', 'udhaar']) qc.invalidateQueries({ queryKey: [k] });
      toast({ kind: 'info', text: t('entry_cancelled') });
      onClose();
    },
  });
  return (
    <Sheet open onClose={onClose} title={t('entry_cancel')}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
        <Field label={t('entry_cancel_reason')} htmlFor="cr">
          <input id="cr" className="input" value={reason} onChange={(e) => setReason(e.target.value)} required autoFocus />
        </Field>
        {m.error && <ErrorBox error={m.error} />}
        <button className="btn btn-danger btn-lg btn-block" disabled={!reason.trim() || m.isPending} aria-busy={m.isPending}>
          <Ban /> {t('entry_cancel')}
        </button>
      </form>
    </Sheet>
  );
}

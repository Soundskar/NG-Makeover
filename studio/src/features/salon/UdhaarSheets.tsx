import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ban, Banknote, Check, CreditCard, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { Choices, ErrorBox, Field, MoneyInput, Sheet, SheetCloseButton, useToast } from '../../components/ui';
import { useI18n } from '../../i18n/i18n';
import { formatINR } from '../../lib/money';
import { must, supabase } from '../../lib/supabase';
import type { CollectMode } from '../../lib/types';
import { formatPhone } from '../../lib/whatsapp';

/** A client pays back udhaar (all or part). It settles her oldest udhaar first. */
export function CollectSheet({ phone, name, owed, onClose }: {
  phone: string; name: string | null; owed: number; onClose: () => void;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [amount, setAmount] = useState<number | null>(owed);
  const [mode, setMode] = useState<CollectMode>('cash');
  const over = amount != null && amount > owed;
  const m = useMutation({
    mutationFn: async () => must(await supabase.rpc('collect_udhaar_for_phone', { p_phone: phone, p_amount: amount, p_mode: mode })),
    onSuccess: () => {
      for (const k of ['udhaar', 'visits', 'closing']) qc.invalidateQueries({ queryKey: [k] });
      toast({ kind: 'success', text: t('udhaar_collected_toast', { amount: formatINR(amount ?? 0) }) });
      onClose();
    },
  });
  return (
    <Sheet open onClose={onClose} title={t('udhaar_collect_title', { name: name || formatPhone(phone) })}>
      <div className="stack">
        <div className="notice notice-warning">
          <span className="grow">{t('udhaar_owed_total', { amount: formatINR(owed) })}</span>
        </div>
        <Field label={t('amount')} htmlFor="uc-a" error={over ? t('payment_over', { amount: formatINR(owed) }) : null}>
          <MoneyInput id="uc-a" value={amount} onChange={setAmount} invalid={over} autoFocus />
        </Field>
        <Field label={t('mode')}>
          <Choices<CollectMode> label={t('mode')} value={mode} onChange={setMode} options={[
            { value: 'cash', label: t('cash'), icon: <Banknote /> },
            { value: 'upi', label: t('upi'), icon: <Smartphone /> },
            { value: 'card', label: t('card'), icon: <CreditCard /> },
          ]} />
        </Field>
        {m.error && <ErrorBox error={m.error} />}
        <button className="btn btn-primary btn-lg btn-block" disabled={!amount || over || m.isPending} aria-busy={m.isPending}
          onClick={() => m.mutate()}>
          <Check /> {t('udhaar_collect_amount', { amount: formatINR(amount ?? 0) })}
        </button>
        <SheetCloseButton />
      </div>
    </Sheet>
  );
}

/** Undo a udhaar collection (cancelled with a reason, never deleted). */
export function CancelCollectionSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [reason, setReason] = useState('');
  const m = useMutation({
    mutationFn: async () => must(await supabase.rpc('void_udhaar_collection', { p_id: id, p_reason: reason })),
    onSuccess: () => {
      for (const k of ['udhaar', 'closing']) qc.invalidateQueries({ queryKey: [k] });
      toast({ kind: 'info', text: t('entry_cancelled') });
      onClose();
    },
  });
  return (
    <Sheet open onClose={onClose} title={t('udhaar_cancel')}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
        <Field label={t('entry_cancel_reason')} htmlFor="ucr">
          <input id="ucr" className="input" value={reason} onChange={(e) => setReason(e.target.value)} required autoFocus />
        </Field>
        {m.error && <ErrorBox error={m.error} />}
        <button className="btn btn-danger btn-lg btn-block" disabled={!reason.trim() || m.isPending} aria-busy={m.isPending}>
          <Ban /> {t('udhaar_cancel')}
        </button>
      </form>
    </Sheet>
  );
}

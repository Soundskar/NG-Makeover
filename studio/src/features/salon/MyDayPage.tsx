import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ban, HandCoins, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMe } from '../../auth/auth';
import { Empty, ErrorBox, Field, Loaded, Money, Page, Sheet, TopBar, useToast } from '../../components/ui';
import { useI18n } from '../../i18n/i18n';
import { formatClock, formatDate, formatWeekday, monthStart, todayIST } from '../../lib/dates';
import { formatINR, sum } from '../../lib/money';
import { must, supabase } from '../../lib/supabase';
import type { UdhaarCollection, WorkLine } from '../../lib/types';
import { useMyWork, useUdhaarCollections, useVisits } from './data';
import { VisitCard, withinCancelWindow } from './VisitCard';

type Period = 'today' | 'month';

/** Staff: the work I did (the basis for my commission) and the entries I logged today. */
export default function MyDayPage() {
  const me = useMe();
  const { t, lang } = useI18n();
  const today = todayIST();
  const [period, setPeriod] = useState<Period>('today');
  const work = useMyWork(period === 'today' ? today : monthStart(today), today);
  const visits = useVisits(today);
  const collections = useUdhaarCollections(today);

  return (
    <>
      <TopBar title={t('my_day_title')} />
      <Page>
        <div className="tabs" role="tablist">
          {(['today', 'month'] as const).map((p) => (
            <button key={p} role="tab" className="tab" aria-selected={period === p} onClick={() => setPeriod(p)}>
              {p === 'today' ? t('today') : t('this_month')}
            </button>
          ))}
        </div>

        <Loaded q={work} skeleton="cards">
          {(lines) => {
            const net = sum(lines.map((l) => l.price - l.discount));
            const discounts = sum(lines.map((l) => l.discount));
            return (
              <>
                <div className="card hero stack" style={{ gap: 2 }}>
                  <span className="stat-label">{t('work_net')}</span>
                  <Money n={net} className="stat-value" animate />
                  <span className="stat-sub">
                    {t('salon_services_n', { n: lines.length })}
                    {discounts > 0 ? ` · ${t('work_discounts', { amount: formatINR(discounts) })}` : ''}
                  </span>
                </div>
                <p className="muted small">{t('work_commission_note')}</p>

                <section className="stack">
                  <h2 className="section-title">{t('my_work_done')}</h2>
                  {lines.length === 0 ? <Empty title={t('my_day_empty')} sub={t('my_day_empty_sub')} /> : <WorkList lines={lines} byDay={period === 'month'} />}
                </section>
              </>
            );
          }}
        </Loaded>

        {period === 'today' && (
          <Loaded q={visits} skeleton="cards">
            {(all) => {
              const mine = all.filter((v) => v.created_by === me.id);
              const myCollections = (collections.data ?? []).filter((c) => c.collected_by === me.id);
              if (!mine.length && !myCollections.length) return null;
              return (
                <section className="stack">
                  <h2 className="section-title">{t('my_work_logged')}</h2>
                  <p className="muted small">{t('entry_cancel_window')}</p>
                  <div className="stack stagger">
                    {mine.map((v) => <VisitCard key={v.id} v={v} canCancel={withinCancelWindow(v.created_at)} />)}
                    {myCollections.map((c) => <CollectionCard key={c.id} c={c} />)}
                  </div>
                </section>
              );
            }}
          </Loaded>
        )}

        <Link to="/salon/new" className="btn btn-primary btn-lg btn-block"><Plus /> {t('nav_new_entry')}</Link>
        <p className="muted small center">{formatWeekday(today, lang)}, {formatDate(today, lang)}</p>
      </Page>
    </>
  );
}

/** Services done, newest first; for a month, grouped under each day with its total. */
export function WorkList({ lines, byDay }: { lines: WorkLine[]; byDay: boolean }) {
  const { t, lang } = useI18n();
  const days = byDay ? [...new Set(lines.map((l) => l.day))] : [null];
  return (
    <div className="stack">
      {days.map((d) => {
        const rows = d ? lines.filter((l) => l.day === d) : lines;
        return (
          <div key={d ?? 'all'} className="stack" style={{ gap: 6 }}>
            {d && (
              <div className="row-between small" style={{ padding: '0 4px' }}>
                <strong>{formatWeekday(d, lang, 'short')}, {formatDate(d, lang, false)}</strong>
                <span className="muted num">{formatINR(sum(rows.map((l) => l.price - l.discount)))}</span>
              </div>
            )}
            <div className="list">
              {rows.map((l, i) => (
                <div key={i} className="list-item" style={{ minHeight: 56 }}>
                  <span className="grow">
                    <span className="title" style={{ display: 'block', fontWeight: 550 }}>{l.service_name}</span>
                    <span className="sub num">
                      {formatClock(l.logged_at, lang)}
                      {l.discount > 0 ? ` · ${t('entry_discount_badge', { amount: formatINR(l.discount) })}` : ''}
                      {l.price < l.list_price ? ` · ${t('log_menu_price', { price: formatINR(l.list_price) })}` : ''}
                    </span>
                  </span>
                  <span className="end num title">{formatINR(l.price - l.discount)}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Udhaar I collected today, which I can undo within 15 minutes. */
function CollectionCard({ c }: { c: UdhaarCollection }) {
  const { t, lang } = useI18n();
  const [cancel, setCancel] = useState(false);
  return (
    <article className="card stack" style={{ gap: 8, opacity: c.voided ? 0.6 : 1 }}>
      <div className="row-between">
        <span className="row" style={{ gap: 8 }}>
          <HandCoins size={20} className="text-success" />
          <span>
            <span style={{ fontWeight: 650, display: 'block' }}>{t('udhaar_collected')}</span>
            <span className="muted small num">{formatClock(c.created_at, lang)} · {t(c.mode)}</span>
          </span>
        </span>
        <Money n={c.amount} className="stat-label" />
      </div>
      {c.voided ? (
        <span className="badge badge-danger" style={{ alignSelf: 'flex-start' }}>{t('entry_cancelled')}: {c.void_reason}</span>
      ) : withinCancelWindow(c.created_at) && (
        <button className="btn btn-sm btn-danger" style={{ alignSelf: 'flex-start' }} onClick={() => setCancel(true)}>
          <Ban /> {t('udhaar_cancel')}
        </button>
      )}
      {cancel && <CancelCollectionSheet id={c.id} onClose={() => setCancel(false)} />}
    </article>
  );
}

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

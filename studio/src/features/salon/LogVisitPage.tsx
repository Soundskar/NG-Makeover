import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Banknote, Check, ChevronDown, CreditCard, Pencil, Plus, Smartphone, Split, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMe, useTeam } from '../../auth/auth';
import {
  Choices, Empty, ErrorBox, Field, Loaded, Money, MoneyInput, Page, PhoneInput, SearchInput, Sheet, TopBar, useToast,
} from '../../components/ui';
import { errorText, useI18n } from '../../i18n/i18n';
import { formatDate, todayIST } from '../../lib/dates';
import { formatINR, sum } from '../../lib/money';
import { must, supabase } from '../../lib/supabase';
import { nameOf, type Service } from '../../lib/types';
import { normalizePhone } from '../../lib/whatsapp';
import { needsPrice, priceLabel, useFrequentServices, useServiceCatalog } from './data';

interface Line {
  key: number;
  service: Service;
  price: number;
  staffId: string;
}

type Mode = 'cash' | 'upi' | 'card' | 'split';

let nextKey = 1;

export default function LogVisitPage() {
  const me = useMe();
  const { t, lang } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const today = todayIST();
  // The owner can add a missed entry for an earlier day (from the salon day screen).
  const date = me.is_owner && params.get('date') ? params.get('date')! : today;

  const catalog = useServiceCatalog();
  const frequent = useFrequentServices();
  const team = useTeam();

  const [step, setStep] = useState<'pick' | 'review'>('pick');
  const [lines, setLines] = useState<Line[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [priceFor, setPriceFor] = useState<{ service: Service; lineKey?: number; current?: number } | null>(null);
  const [staffFor, setStaffFor] = useState<number | null>(null);
  const [phone, setPhone] = useState('');
  const [client, setClient] = useState('');
  const [mode, setMode] = useState<Mode>('cash');
  const [split, setSplit] = useState<{ cash: number | null; upi: number | null; card: number | null }>({ cash: null, upi: null, card: null });

  const doers = useMemo(
    () => (team.data ?? []).filter((p) => p.active && (p.is_staff || p.is_owner)),
    [team.data],
  );
  const defaultStaff = me.is_staff || me.is_owner ? me.id : doers[0]?.id ?? me.id;
  const total = sum(lines.map((l) => l.price));
  const splitTotal = (split.cash ?? 0) + (split.upi ?? 0) + (split.card ?? 0);

  // Known client: fill in her name from the phone number.
  const tenDigits = normalizePhone(phone);
  useEffect(() => {
    if (!tenDigits || client) return;
    let live = true;
    supabase.rpc('client_name_for_phone', { p_phone: tenDigits }).then(({ data }) => {
      if (live && typeof data === 'string' && data) setClient(data);
    });
    return () => {
      live = false;
    };
    // Only look up when the number changes, not when the name is edited.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenDigits]);

  function addService(s: Service, price: number) {
    setLines((ls) => [...ls, { key: nextKey++, service: s, price, staffId: defaultStaff }]);
    setSearch('');
    setStep('review');
  }

  function tapService(s: Service) {
    if (needsPrice(s)) setPriceFor({ service: s });
    else addService(s, s.price);
  }

  function reset() {
    setLines([]);
    setPhone('');
    setClient('');
    setMode('cash');
    setSplit({ cash: null, upi: null, card: null });
    setStep('pick');
  }

  const save = useMutation({
    mutationFn: async () => {
      const pay = mode === 'split'
        ? { paid_cash: split.cash ?? 0, paid_upi: split.upi ?? 0, paid_card: split.card ?? 0 }
        : { paid_cash: mode === 'cash' ? total : 0, paid_upi: mode === 'upi' ? total : 0, paid_card: mode === 'card' ? total : 0 };
      const id = must(await supabase.rpc('log_visit', {
        p: {
          ...pay,
          visit_date: date,
          client_name: client.trim() || null,
          client_phone: tenDigits ?? (phone.trim() || null),
          lines: lines.map((l) => ({ service_id: l.service.id, price: l.price, staff_id: l.staffId })),
        },
      })) as string;
      return id;
    },
    onSuccess: (id) => {
      const amount = formatINR(total);
      reset();
      qc.invalidateQueries({ queryKey: ['visits'] });
      toast({
        kind: 'success',
        text: t('log_saved', { amount }),
        action: {
          label: t('undo'),
          run: async () => {
            const { error } = await supabase.rpc('void_visit', { p_id: id, p_reason: 'Undo' });
            if (error) toast({ kind: 'error', text: errorText(error, t) });
            else {
              toast({ kind: 'info', text: t('log_undone') });
              qc.invalidateQueries({ queryKey: ['visits'] });
            }
          },
        },
      });
    },
  });

  const canSave = lines.length > 0 && (mode !== 'split' || splitTotal === total) && !save.isPending;
  const dateBanner = date !== today && (
    <div className="notice notice-warning">{t('log_for_date', { date: formatDate(date, lang) })}</div>
  );

  // ---------- step 1: pick services ----------
  if (step === 'pick') {
    return (
      <>
        <TopBar title={t('log_title')} back={lines.length > 0 ? undefined : me.is_owner ? '/salon' : undefined} />
        <Page>
          {dateBanner}
          <SearchInput value={search} onChange={setSearch} placeholder={t('log_search')} />
          <Loaded q={catalog}>
            {({ categories, services }) => {
              const q = search.trim().toLowerCase();
              if (q) {
                const hits = services.filter((s) =>
                  s.name_en.toLowerCase().includes(q) || (s.name_hi ?? '').includes(search.trim()));
                return hits.length
                  ? <ServiceList services={hits} onTap={tapService} />
                  : <Empty title={t('log_no_match')} />;
              }
              const freq = (frequent.data ?? []).map((id) => services.find((s) => s.id === id)).filter(Boolean) as Service[];
              const activeCat = category ?? categories[0]?.id ?? null;
              return (
                <>
                  {freq.length > 0 && (
                    <section className="stack">
                      <h2 className="section-title">{t('log_frequent')}</h2>
                      <div className="stat-grid">
                        {freq.map((s) => (
                          <button key={s.id} className="card-link" onClick={() => tapService(s)} style={{ padding: 14 }}>
                            <div style={{ fontWeight: 700, lineHeight: 1.3 }}>{nameOf(s, lang)}</div>
                            <div className="muted small num" style={{ marginTop: 4 }}>{priceLabel(s, t('from'))}</div>
                          </button>
                        ))}
                      </div>
                    </section>
                  )}
                  <section className="stack">
                    <h2 className="section-title">{t('log_all_services')}</h2>
                    <div className="chips" role="toolbar" aria-label={t('category')}>
                      {categories.map((c) => (
                        <button key={c.id} className="chip" aria-pressed={c.id === activeCat} onClick={() => setCategory(c.id)}>
                          {nameOf(c, lang)}
                        </button>
                      ))}
                    </div>
                    <ServiceList services={services.filter((s) => s.category_id === activeCat)} onTap={tapService} />
                  </section>
                </>
              );
            }}
          </Loaded>
          {lines.length > 0 && (
            <div className="sticky-actions">
              <button className="btn btn-primary btn-lg btn-block" onClick={() => setStep('review')}>
                {t('log_continue', { n: lines.length, amount: formatINR(total) })}
              </button>
            </div>
          )}
        </Page>
        <PriceSheet
          target={priceFor}
          onClose={() => setPriceFor(null)}
          onDone={(s, price) => {
            if (priceFor?.lineKey != null) {
              setLines((ls) => ls.map((l) => (l.key === priceFor.lineKey ? { ...l, price } : l)));
            } else addService(s, price);
            setPriceFor(null);
          }}
        />
      </>
    );
  }

  // ---------- step 2: who did it, client, payment ----------
  return (
    <>
      <TopBar title={t('log_title')} back={false} actions={
        <button className="icon-btn" aria-label={t('log_discard')} onClick={reset}><X /></button>
      } />
      <Page>
        {dateBanner}
        <section className="stack">
          <h2 className="section-title">{t('log_services')}</h2>
          <div className="list">
            {lines.map((l) => (
              <div key={l.key} className="list-item" style={{ alignItems: 'flex-start' }}>
                <div className="grow stack" style={{ gap: 6 }}>
                  <span className="title">{nameOf(l.service, lang)}</span>
                  <button className="btn btn-soft btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setStaffFor(l.key)}>
                    {t('log_done_by')}: {doers.find((d) => d.id === l.staffId)?.display_name ?? '—'} <ChevronDown />
                  </button>
                </div>
                <div className="end stack" style={{ gap: 4, alignItems: 'flex-end' }}>
                  <button className="btn btn-secondary btn-sm num" onClick={() => setPriceFor({ service: l.service, lineKey: l.key, current: l.price })}
                    aria-label={t('log_change_price')}>
                    {formatINR(l.price)} <Pencil />
                  </button>
                  {l.price < l.service.price && (
                    <span className="badge badge-warning">{t('log_menu_price', { price: formatINR(l.service.price) })}</span>
                  )}
                </div>
                <button className="icon-btn" aria-label={t('remove')}
                  onClick={() => setLines((ls) => {
                    const rest = ls.filter((x) => x.key !== l.key);
                    if (rest.length === 0) setStep('pick');
                    return rest;
                  })}>
                  <X />
                </button>
              </div>
            ))}
          </div>
          <button className="btn btn-secondary btn-block" onClick={() => setStep('pick')}>
            <Plus /> {t('log_add_another')}
          </button>
        </section>

        <div className="card row-between">
          <span className="stat-label">{t('total')}</span>
          <Money n={total} className="stat-value" />
        </div>

        <section className="stack">
          <h2 className="section-title">{t('log_client')} <span style={{ textTransform: 'none', fontWeight: 500 }}>({t('optional')})</span></h2>
          <div className="card stack">
            <Field label={t('phone')} htmlFor="cp">
              <PhoneInput id="cp" value={phone} onChange={setPhone} />
            </Field>
            <Field label={t('name')} htmlFor="cn">
              <input id="cn" className="input" value={client} onChange={(e) => setClient(e.target.value)} autoComplete="off" />
            </Field>
          </div>
        </section>

        <section className="stack">
          <h2 className="section-title">{t('log_payment')}</h2>
          <Choices<Mode>
            label={t('log_payment')}
            value={mode}
            onChange={setMode}
            options={[
              { value: 'cash', label: t('cash'), icon: <Banknote /> },
              { value: 'upi', label: t('upi'), icon: <Smartphone /> },
              { value: 'card', label: t('card'), icon: <CreditCard /> },
              { value: 'split', label: t('split'), icon: <Split /> },
            ]}
          />
          {mode === 'split' && (
            <div className="card stack">
              {(['cash', 'upi', 'card'] as const).map((k) => (
                <Field key={k} label={t(k)} htmlFor={`sp-${k}`}>
                  <MoneyInput id={`sp-${k}`} value={split[k]} onChange={(n) => setSplit((s) => ({ ...s, [k]: n }))} />
                </Field>
              ))}
              <p className={splitTotal === total ? 'text-success' : 'text-warning'} style={{ fontWeight: 700 }}>
                {splitTotal === total
                  ? <><Check size={18} style={{ verticalAlign: '-3px' }} /> {t('log_split_ok')}</>
                  : t('log_split_left', { amount: formatINR(total - splitTotal) })}
              </p>
            </div>
          )}
        </section>

        {save.error && <ErrorBox error={save.error} />}

        <div className="sticky-actions">
          <button className="btn btn-primary btn-lg btn-block" disabled={!canSave} onClick={() => save.mutate()}>
            <Check /> {t('log_save', { amount: formatINR(total) })}
          </button>
        </div>
      </Page>

      <PriceSheet
        target={priceFor}
        onClose={() => setPriceFor(null)}
        onDone={(_, price) => {
          setLines((ls) => ls.map((l) => (l.key === priceFor?.lineKey ? { ...l, price } : l)));
          setPriceFor(null);
        }}
      />

      <Sheet open={staffFor != null} onClose={() => setStaffFor(null)} title={t('log_done_by')}>
        <div className="list">
          {doers.map((d) => {
            const selected = lines.find((l) => l.key === staffFor)?.staffId === d.id;
            return (
              <button key={d.id} className="list-item" aria-pressed={selected}
                onClick={() => {
                  setLines((ls) => ls.map((l) => (l.key === staffFor ? { ...l, staffId: d.id } : l)));
                  setStaffFor(null);
                }}>
                <span className="grow title">{d.display_name}{d.id === me.id ? ` (${t('me')})` : ''}</span>
                {selected && <Check className="text-success" />}
              </button>
            );
          })}
        </div>
      </Sheet>
    </>
  );
}

function ServiceList({ services, onTap }: { services: Service[]; onTap: (s: Service) => void }) {
  const { t, lang } = useI18n();
  return (
    <div className="list">
      {services.map((s) => (
        <button key={s.id} className="list-item" onClick={() => onTap(s)}>
          <span className="grow title" style={{ fontWeight: 500 }}>{nameOf(s, lang)}</span>
          <span className="end num muted">{priceLabel(s, t('from'))}</span>
        </button>
      ))}
    </div>
  );
}

/** Ask for (or change) the price of one service. */
function PriceSheet({ target, onClose, onDone }: {
  target: { service: Service; lineKey?: number; current?: number } | null;
  onClose: () => void;
  onDone: (s: Service, price: number) => void;
}) {
  const { t, lang } = useI18n();
  const [value, setValue] = useState<number | null>(null);
  useEffect(() => {
    if (target) setValue(target.current ?? target.service.price);
  }, [target]);
  if (!target) return null;
  const s = target.service;
  const ranged = s.price_min != null && s.price_max != null;
  const low = value != null && value < (ranged ? s.price_min! : s.price);
  return (
    <Sheet open onClose={onClose} title={nameOf(s, lang)}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); if (value != null) onDone(s, value); }}>
        <Field
          label={t('price')}
          htmlFor="ps"
          hint={s.is_variable ? t('log_from_hint', { price: formatINR(s.price) })
            : ranged ? t('log_range_hint', { min: formatINR(s.price_min!), max: formatINR(s.price_max!) })
              : t('log_menu_price', { price: formatINR(s.price) })}
        >
          <MoneyInput id="ps" value={value} onChange={setValue} autoFocus />
        </Field>
        {low && <div className="notice notice-warning">{t('log_price_low')}</div>}
        <button className="btn btn-primary btn-lg btn-block" disabled={value == null}>
          <Check /> {t('done')}
        </button>
      </form>
    </Sheet>
  );
}

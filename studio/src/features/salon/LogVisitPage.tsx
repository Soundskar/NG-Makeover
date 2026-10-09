import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle, Banknote, CalendarCheck, Check, ChevronDown, CreditCard, HandCoins, Pencil, Plus, Smartphone, Split, StickyNote, Tag, X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMe, useTeam } from '../../auth/auth';
import {
  Choices, Empty, ErrorBox, Field, Greeting, Loaded, Money, MoneyInput, Page, PhoneInput, SearchInput, Sheet, TopBar, useToast,
} from '../../components/ui';
import { errorText, useI18n } from '../../i18n/i18n';
import { formatDate, todayIST } from '../../lib/dates';
import { haptic } from '../../lib/haptics';
import { discountFrom, formatINR, payParts, sum, type PayParts } from '../../lib/money';
import { must, supabase } from '../../lib/supabase';
import { nameOf, type Service, type ServiceCategory } from '../../lib/types';
import { normalizePhone } from '../../lib/whatsapp';
import { advancePaid, useBooking } from '../bookings/data';
import { useClientCard } from '../clients/data';
import { ReviewSheet, shouldAskReview } from '../clients/ReviewSheet';
import { useSettings } from '../students/data';
import { needsPrice, priceLabel, useFrequentServices, useServiceCatalog, useUdhaarForPhone } from './data';
import { CollectSheet } from './UdhaarSheets';

interface Line {
  key: number;
  service: Service;
  price: number;
  staffId: string;
}

type PayKind = keyof PayParts;
type DiscountKind = 'amount' | 'percent';
type Split = Record<PayKind, number | null>;
const NO_SPLIT: Split = { cash: null, upi: null, card: null, udhaar: null };

let nextKey = 1;

interface Draft {
  step: 'pick' | 'review';
  lines: Line[];
  phone: string;
  client: string;
  pay: PayKind;
  splitOn: boolean;
  split: Split;
  discountOn: boolean;
  discountKind: DiscountKind;
  discountValue: number | null;
  discountNote: string;
}

// A client walks up mid-entry, or the phone closes the app: the half-done
// entry is kept on this phone until it's saved or discarded. One per person per day.
const DRAFT_PREFIX = 'ngstudio-draft:';
const draftKey = (userId: string, date: string) => `${DRAFT_PREFIX}${userId}:${date}`;

function loadDraft(key: string): Partial<Draft> | null {
  try {
    // Drafts left from earlier days are stale: drop them.
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(DRAFT_PREFIX) && k !== key && k.slice(k.lastIndexOf(':') + 1) < todayIST()) localStorage.removeItem(k);
    }
    const d = JSON.parse(localStorage.getItem(key) ?? 'null') as Partial<Draft> | null;
    if (!d?.lines?.length) return null;
    nextKey = Math.max(nextKey, ...d.lines.map((l) => l.key + 1));
    return d;
  } catch {
    return null;
  }
}

/** Lowest and highest price in a list of services, for the category headers. */
function priceSpan(services: Service[]): [number, number] {
  const lows = services.map((s) => s.price_min ?? s.price);
  const highs = services.map((s) => s.price_max ?? s.price);
  return [Math.min(...lows), Math.max(...highs)];
}

export default function LogVisitPage() {
  const me = useMe();
  const { t, lang } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const today = todayIST();
  // The owner can add a missed entry for an earlier day (from the salon day screen).
  const date = me.is_owner && params.get('date') ? params.get('date')! : today;
  // Started from a booking: services, client and advance come from it.
  const bookingId = params.get('booking');
  const bookingQ = useBooking(bookingId);
  const navigate = useNavigate();
  const settings = useSettings();
  const [prefilled, setPrefilled] = useState(false);
  const [reviewFor, setReviewFor] = useState<{ phone: string; name: string | null; then?: string } | null>(null);

  const catalog = useServiceCatalog();
  const frequent = useFrequentServices();
  const team = useTeam();

  const storeKey = draftKey(me.id, date);
  const [draft] = useState(() => (bookingId ? null : loadDraft(storeKey)));
  const [step, setStep] = useState<'pick' | 'review'>(draft?.step ?? 'pick');
  const [lines, setLines] = useState<Line[]>(draft?.lines ?? []);
  const [search, setSearch] = useState('');
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [priceFor, setPriceFor] = useState<{ service: Service; lineKey?: number; current?: number } | null>(null);
  const [staffFor, setStaffFor] = useState<number | null>(null);
  const [phone, setPhone] = useState(draft?.phone ?? '');
  const [client, setClient] = useState(draft?.client ?? '');
  const [pay, setPay] = useState<PayKind>(draft?.pay ?? 'cash');
  const [splitOn, setSplitOn] = useState(draft?.splitOn ?? false);
  // Merged over the defaults: a draft saved by an older version may lack some parts.
  const [split, setSplit] = useState<Split>({ ...NO_SPLIT, ...draft?.split });
  const [discountOn, setDiscountOn] = useState(draft?.discountOn ?? false);
  const [discountKind, setDiscountKind] = useState<DiscountKind>(draft?.discountKind ?? 'amount');
  const [discountValue, setDiscountValue] = useState<number | null>(draft?.discountValue ?? null);
  const [discountNote, setDiscountNote] = useState(draft?.discountNote ?? '');
  const [collectOpen, setCollectOpen] = useState(false);
  const [bump, setBump] = useState(0);

  useEffect(() => {
    if (bookingId) return; // a booking is its own draft
    try {
      if (lines.length) {
        const d: Draft = { step, lines, phone, client, pay, splitOn, split, discountOn, discountKind, discountValue, discountNote };
        localStorage.setItem(storeKey, JSON.stringify(d));
      } else localStorage.removeItem(storeKey);
    } catch {
      // No storage: the entry just isn't kept between visits.
    }
  }, [bookingId, storeKey, step, lines, phone, client, pay, splitOn, split, discountOn, discountKind, discountValue, discountNote]);

  const doers = useMemo(
    () => (team.data ?? []).filter((p) => p.active && (p.is_staff || p.is_owner)),
    [team.data],
  );
  const defaultStaff = me.is_staff || me.is_owner ? me.id : doers[0]?.id ?? me.id;

  const subtotal = sum(lines.map((l) => l.price));
  const discount = discountOn ? discountFrom(subtotal, discountKind, discountValue) : 0;
  const total = subtotal - discount;
  // An advance taken at booking counts as already paid.
  const advanceAvail = bookingQ.data && bookingId ? advancePaid(bookingQ.data.advances, bookingId) : 0;
  const advanceUsed = Math.min(advanceAvail, total);
  const toCollect = total - advanceUsed;
  const parts = payParts(splitOn ? 'split' : pay, toCollect, split);
  const partsSum = parts.cash + parts.upi + parts.card + parts.udhaar;

  // Each step starts at the top, so the services just picked are in view.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

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

  useEffect(() => {
    const b = bookingQ.data?.booking;
    const all = catalog.data?.services;
    if (!b || !all || prefilled) return;
    const picked = b.service_ids.map((id) => all.find((s) => s.id === id)).filter(Boolean) as Service[];
    // One service with an agreed price (a bridal package, say): bill it at that price.
    setLines(picked.map((s) => ({
      key: nextKey++, service: s, price: picked.length === 1 && b.quoted != null ? b.quoted : s.price, staffId: b.staff_id ?? defaultStaff,
    })));
    setPhone(b.client_phone);
    setClient(b.client_name);
    if (picked.length) setStep('review');
    setPrefilled(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingQ.data, catalog.data, prefilled]);

  // Notes about her (allergies, preferences) and when she last asked for a review.
  const card = useClientCard(phone);

  // Does this client already owe udhaar from an earlier visit?
  const owedRows = useUdhaarForPhone(phone).data ?? [];
  const owed = sum(owedRows.map((r) => r.outstanding));

  function addService(s: Service, price: number) {
    haptic();
    setLines((ls) => [...ls, { key: nextKey++, service: s, price, staffId: defaultStaff }]);
    setSearch('');
    setBump((n) => n + 1);
  }

  function tapService(s: Service) {
    if (needsPrice(s)) setPriceFor({ service: s });
    else addService(s, s.price);
  }

  function reset() {
    setLines([]);
    setPhone('');
    setClient('');
    setPay('cash');
    setSplitOn(false);
    setSplit(NO_SPLIT);
    setDiscountOn(false);
    setDiscountKind('amount');
    setDiscountValue(null);
    setDiscountNote('');
    setStep('pick');
  }

  const save = useMutation({
    mutationFn: async () => must(await supabase.rpc('log_visit', {
      p: {
        paid_cash: parts.cash,
        paid_upi: parts.upi,
        paid_card: parts.card,
        paid_udhaar: parts.udhaar,
        paid_advance: advanceUsed,
        appointment_id: bookingId,
        discount,
        discount_note: discount > 0 ? discountNote.trim() || null : null,
        visit_date: date,
        client_name: client.trim() || null,
        client_phone: tenDigits ?? (phone.trim() || null),
        lines: lines.map((l) => ({ service_id: l.service.id, price: l.price, staff_id: l.staffId })),
      },
    })) as string,
    onSuccess: (id) => {
      const amount = formatINR(total);
      // A happy client with a phone number, not asked lately: offer the Google review request.
      const ask = tenDigits && settings.data?.settings.google_review_url && shouldAskReview(card.data?.review_asked_on, today)
        ? { phone: tenDigits, name: client.trim() || null } : null;
      const back = bookingId ? `/bookings?d=${bookingQ.data?.booking.day ?? today}` : undefined;
      reset();
      for (const k of ['visits', 'work', 'udhaar', 'bookings', 'booking', 'client', 'clients', 'client-card', 'clients-due', 'report']) {
        qc.invalidateQueries({ queryKey: [k] });
      }
      if (ask) setReviewFor({ ...ask, then: back });
      else if (back) navigate(back, { replace: true });
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
              for (const k of ['visits', 'work', 'udhaar']) qc.invalidateQueries({ queryKey: [k] });
            }
          },
        },
      });
    },
  });

  // What still stands between Mom's staff and the Save button, in words.
  const needsClient = parts.udhaar > 0 && (!client.trim() || !tenDigits);
  const blocker = partsSum !== toCollect ? t('log_split_left', { amount: formatINR(toCollect - partsSum) })
    : needsClient ? t('udhaar_needs_client') : null;
  const canSave = lines.length > 0 && !blocker && !save.isPending;

  const dateBanner = date !== today && (
    <div className="notice notice-warning">{t('log_for_date', { date: formatDate(date, lang) })}</div>
  );
  const countOf = (id: string) => lines.filter((l) => l.service.id === id).length;
  // Shown after saving, on whichever step the screen is back on.
  const reviewPrompt = reviewFor && (
    <ReviewPrompt r={reviewFor} onDone={() => { const to = reviewFor.then; setReviewFor(null); if (to) navigate(to, { replace: true }); }} />
  );

  // ---------- step 1: pick services ----------
  if (step === 'pick') {
    return (
      <>
        <TopBar title={t('log_title')} back={lines.length > 0 ? undefined : me.is_owner ? '/salon' : undefined} />
        <Page>
          {/* Staff start their day here, so this is where they're greeted. */}
          {!me.is_owner && lines.length === 0 && date === today && !bookingId && <Greeting name={me.display_name} />}
          {dateBanner}
          {bookingQ.data && <BookingBanner name={bookingQ.data.booking.client_name} services={bookingQ.data.booking.services_text} />}
          <SearchInput value={search} onChange={setSearch} placeholder={t('log_search')} />
          <Loaded q={catalog}>
            {({ categories, services }) => {
              const q = search.trim().toLowerCase();
              if (q) {
                const hits = services.filter((s) =>
                  s.name_en.toLowerCase().includes(q) || (s.name_hi ?? '').includes(search.trim()));
                return hits.length
                  ? <div className="list">{hits.map((s) => (
                    <ServiceRow key={s.id} s={s} count={countOf(s.id)} onTap={tapService}
                      category={categories.find((c) => c.id === s.category_id)} />
                  ))}</div>
                  : <Empty title={t('log_no_match')} />;
              }
              const freq = (frequent.data ?? []).map((id) => services.find((s) => s.id === id)).filter(Boolean) as Service[];
              return (
                <>
                  {freq.length > 0 && (
                    <section className="stack">
                      <h2 className="section-title">{t('log_frequent')}</h2>
                      <div className="stat-grid">
                        {freq.map((s) => {
                          const n = countOf(s.id);
                          return (
                            <button key={s.id} className={`card-link tile${n ? ' picked' : ''}`} onClick={() => tapService(s)}>
                              <div style={{ fontWeight: 700, lineHeight: 1.3 }}>{nameOf(s, lang)}</div>
                              <div className="muted small num" style={{ marginTop: 4 }}>{priceLabel(s, t('from'))}</div>
                              {n > 0 && <span className="tile-check" key={n}><Check size={14} />{n > 1 ? n : ''}</span>}
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  )}
                  <section className="stack">
                    <h2 className="section-title">{t('log_categories')}</h2>
                    <div className="accordion">
                      {categories.map((c) => {
                        const items = services.filter((s) => s.category_id === c.id);
                        if (!items.length) return null;
                        const [lo, hi] = priceSpan(items);
                        const picked = items.reduce((n, s) => n + countOf(s.id), 0);
                        return (
                          <CategoryGroup key={c.id} open={openCat === c.id}
                            onToggle={() => setOpenCat(openCat === c.id ? null : c.id)}
                            title={nameOf(c, lang)} picked={picked}
                            sub={`${t('log_services_n', { n: items.length })} · ${lo === hi ? formatINR(lo) : `${formatINR(lo)}–${formatINR(hi)}`}`}>
                            {items.map((s) => <ServiceRow key={s.id} s={s} count={countOf(s.id)} onTap={tapService} />)}
                          </CategoryGroup>
                        );
                      })}
                    </div>
                  </section>
                </>
              );
            }}
          </Loaded>
          {lines.length > 0 ? (
            <div className="sticky-actions">
              <button key={bump} className="btn btn-primary btn-lg btn-block bump" onClick={() => setStep('review')}>
                {t('log_continue', { n: lines.length, amount: formatINR(subtotal) })}
              </button>
            </div>
          ) : (
            <p className="muted small center">{t('log_tap_to_add')}</p>
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
        {reviewPrompt}
      </>
    );
  }

  // ---------- step 2: the bill ----------
  const pctShown = subtotal > 0 && discount > 0 ? Math.round((discount / subtotal) * 100) : 0;
  return (
    <>
      <TopBar title={t('log_bill')} back={false} actions={
        <button className="icon-btn" aria-label={t('log_discard')} onClick={reset}><X /></button>
      } />
      <Page>
        {dateBanner}
        {bookingQ.data && <BookingBanner name={bookingQ.data.booking.client_name} services={bookingQ.data.booking.services_text} />}
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

        {/* ----- discount ----- */}
        {!discountOn ? (
          <button className="btn btn-soft btn-block" onClick={() => { setDiscountOn(true); haptic(); }}>
            <Tag /> {t('discount_add')}
          </button>
        ) : (
          <section className="card stack" style={{ animation: 'row-in 0.25s' }}>
            <div className="row-between">
              <span className="field-label row" style={{ gap: 8 }}><Tag size={20} /> {t('discount')}</span>
              <button className="btn btn-link" style={{ minHeight: 36 }}
                onClick={() => { setDiscountOn(false); setDiscountValue(null); setDiscountNote(''); }}>
                {t('discount_remove')}
              </button>
            </div>
            <div className="row" style={{ gap: 8, alignItems: 'stretch' }}>
              <div className="tabs" role="tablist" style={{ flexShrink: 0 }}>
                {(['amount', 'percent'] as const).map((k) => (
                  <button key={k} role="tab" className="tab" style={{ minWidth: 52 }} aria-selected={discountKind === k}
                    onClick={() => { setDiscountKind(k); setDiscountValue(null); }}>
                    {k === 'amount' ? '₹' : '%'}
                  </button>
                ))}
              </div>
              <div className="grow">
                {discountKind === 'amount'
                  ? <MoneyInput aria-label={t('discount')} value={discountValue} onChange={setDiscountValue} autoFocus />
                  : (
                    <div className="money-input pct-input">
                      <input className="input num" inputMode="numeric" aria-label={t('discount')} autoFocus
                        value={discountValue ?? ''} placeholder="0"
                        onChange={(e) => {
                          const d = e.target.value.replace(/\D/g, '').slice(0, 3);
                          setDiscountValue(d === '' ? null : Math.min(100, Number(d)));
                        }} />
                      <span className="rupee" aria-hidden="true">%</span>
                    </div>
                  )}
              </div>
            </div>
            <div className="chips">
              {(discountKind === 'amount' ? [50, 100, 200, 500].filter((n) => n < subtotal) : [5, 10, 15, 20]).map((n) => (
                <button key={n} type="button" className="chip num" aria-pressed={discountValue === n}
                  onClick={() => { haptic(); setDiscountValue(n); }}>
                  {discountKind === 'amount' ? formatINR(n) : `${n}%`}
                </button>
              ))}
            </div>
            <Field label={`${t('discount_note')} (${t('optional')})`} htmlFor="dn">
              <input id="dn" className="input" value={discountNote} onChange={(e) => setDiscountNote(e.target.value)}
                placeholder={t('discount_note_example')} />
            </Field>
          </section>
        )}

        {/* ----- the bill ----- */}
        <div className="card bill">
          {discount > 0 && (
            <>
              <div className="row-between"><span className="muted">{t('subtotal')}</span><Money n={subtotal} /></div>
              <div className="row-between text-success" style={{ animation: 'row-in 0.2s' }}>
                <span>{t('discount')}{pctShown ? ` (${pctShown}%)` : ''}</span>
                <span className="num">−{formatINR(discount)}</span>
              </div>
            </>
          )}
          <div className={`row-between${discount > 0 ? ' bill-total' : ''}`}>
            <span className="stat-label">{t('total')}</span>
            <Money n={total} className="stat-value" animate />
          </div>
          {advanceUsed > 0 && (
            <>
              <div className="row-between text-success"><span>{t('log_advance_paid')}</span><span className="num">−{formatINR(advanceUsed)}</span></div>
              <div className="bill-total row-between"><span className="stat-label">{t('log_to_collect')}</span><Money n={toCollect} className="stat-value" animate /></div>
            </>
          )}
        </div>

        {/* ----- client ----- */}
        <section className="stack">
          <h2 className="section-title">
            {t('log_client')}{' '}
            <span style={{ textTransform: 'none', fontWeight: 500 }}>({parts.udhaar > 0 ? t('needed_for_udhaar') : t('optional')})</span>
          </h2>
          <div className="card stack">
            <Field label={t('phone')} htmlFor="cp" error={needsClient && !tenDigits && phone ? t('phone_invalid') : null}>
              <PhoneInput id="cp" value={phone} onChange={setPhone} />
            </Field>
            <Field label={t('name')} htmlFor="cn">
              <input id="cn" className="input" value={client} onChange={(e) => setClient(e.target.value)} autoComplete="off"
                aria-invalid={needsClient && !client.trim() ? true : undefined} />
            </Field>
            {card.data?.notes && (
              <div className="notice notice-info" style={{ animation: 'row-in 0.25s' }}><StickyNote /><span>{card.data.notes}</span></div>
            )}
            {owed > 0 && (
              <div className="notice notice-warning" style={{ alignItems: 'center', animation: 'row-in 0.25s' }}>
                <AlertCircle />
                <span className="grow">
                  {t('udhaar_owed', { amount: formatINR(owed) })}
                  <span className="small" style={{ display: 'block' }}>{t('since', { date: formatDate(owedRows[0]!.visit_date, lang, false) })}</span>
                </span>
                <button className="btn btn-sm btn-secondary" onClick={() => setCollectOpen(true)}>{t('udhaar_collect')}</button>
              </div>
            )}
          </div>
        </section>

        {/* ----- payment ----- */}
        <section className="stack">
          <h2 className="section-title">{t('log_payment')}</h2>
          {!splitOn && (
            <div className="pay-modes">
              <Choices<PayKind>
                label={t('log_payment')}
                value={pay}
                onChange={setPay}
                options={[
                  { value: 'cash', label: t('cash'), icon: <Banknote /> },
                  { value: 'upi', label: t('upi'), icon: <Smartphone /> },
                  { value: 'card', label: t('card'), icon: <CreditCard /> },
                  { value: 'udhaar', label: t('udhaar'), icon: <HandCoins /> },
                ]}
              />
            </div>
          )}
          <button className="btn btn-link" style={{ alignSelf: 'flex-start' }} onClick={() => {
            haptic();
            if (!splitOn) setSplit({ ...NO_SPLIT, [pay]: toCollect });
            setSplitOn(!splitOn);
          }}>
            <Split size={18} /> {splitOn ? t('split_off') : t('split_on')}
          </button>
          {splitOn && (
            <div className="card stack" style={{ animation: 'row-in 0.25s' }}>
              {(['cash', 'upi', 'card', 'udhaar'] as const).map((k) => (
                <Field key={k} label={t(k)} htmlFor={`sp-${k}`}>
                  <MoneyInput id={`sp-${k}`} value={split[k]} onChange={(n) => setSplit((s) => ({ ...s, [k]: n }))} />
                </Field>
              ))}
              <p className={partsSum === toCollect ? 'text-success' : 'text-warning'} style={{ fontWeight: 700 }}>
                {partsSum === toCollect
                  ? <><Check size={18} style={{ verticalAlign: '-3px' }} /> {t('log_split_ok')}</>
                  : partsSum < toCollect ? t('log_split_left', { amount: formatINR(toCollect - partsSum) })
                    : t('log_split_over', { amount: formatINR(partsSum - toCollect) })}
              </p>
            </div>
          )}
          {parts.udhaar > 0 && (
            <div className="notice notice-warning" style={{ animation: 'row-in 0.25s' }}>
              <HandCoins />
              <span>{client.trim()
                ? t('udhaar_note', { amount: formatINR(parts.udhaar), name: client.trim() })
                : t('udhaar_note_noname', { amount: formatINR(parts.udhaar) })}</span>
            </div>
          )}
        </section>

        {save.error && <ErrorBox error={save.error} />}

        <div className="sticky-actions stack" style={{ gap: 8 }}>
          {blocker && lines.length > 0 && <p className="save-hint">{blocker}</p>}
          <button className="btn btn-primary btn-lg btn-block" disabled={!canSave} aria-busy={save.isPending} onClick={() => save.mutate()}>
            <Check /> {advanceUsed > 0 ? t('log_save_collect', { amount: formatINR(toCollect) }) : t('log_save', { amount: formatINR(total) })}
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
                  haptic();
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

      {collectOpen && tenDigits && (
        <CollectSheet phone={tenDigits} name={client.trim() || owedRows[0]?.client_name || null} owed={owed}
          onClose={() => setCollectOpen(false)} />
      )}
      {reviewPrompt}
    </>
  );
}

function BookingBanner({ name, services }: { name: string; services: string | null }) {
  const { t } = useI18n();
  return (
    <div className="notice notice-info"><CalendarCheck /><span>{t('log_from_booking', { name })}{services ? ` · ${services}` : ''}</span></div>
  );
}

/** Straight after saving: "Ask her for a Google review?" */
function ReviewPrompt({ r, onDone }: { r: { phone: string; name: string | null }; onDone: () => void }) {
  const { t } = useI18n();
  return <ReviewSheet phone={r.phone} name={r.name} title={t('review_after_title', { name: r.name || t('client') })} onClose={onDone} />;
}

/** A category that opens to show its services, so the whole menu fits on one screen. */
function CategoryGroup({ open, onToggle, title, sub, picked, children }: {
  open: boolean; onToggle: () => void; title: string; sub: string; picked: number; children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Bring a newly opened category's services into view.
    if (open) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [open]);
  return (
    <div ref={ref} className={`acc${open ? ' open' : ''}`}>
      <button className="acc-head" aria-expanded={open} onClick={() => { haptic(); onToggle(); }}>
        <span className="grow">
          <span className="title" style={{ display: 'block' }}>{title}</span>
          <span className="sub num">{sub}</span>
        </span>
        {picked > 0 && <span className="badge badge-primary num" key={picked} style={{ animation: 'pop-in 0.3s' }}>{picked}</span>}
        <ChevronDown className="acc-chev" />
      </button>
      {open && <div className="acc-body">{children}</div>}
    </div>
  );
}

function ServiceRow({ s, count, onTap, category }: {
  s: Service; count: number; onTap: (s: Service) => void; category?: ServiceCategory;
}) {
  const { t, lang } = useI18n();
  return (
    <button className="list-item svc" onClick={() => onTap(s)}>
      <span className="grow">
        <span className="title" style={{ display: 'block', fontWeight: 550 }}>{nameOf(s, lang)}</span>
        {category && <span className="sub">{nameOf(category, lang)}</span>}
      </span>
      <span className="end num muted">{priceLabel(s, t('from'))}</span>
      <span className={`svc-add${count ? ' on' : ''}`} key={count} aria-label={count ? t('log_added') : undefined}>
        {count ? <>{count > 1 ? <span className="num">{count}</span> : <Check />}</> : <Plus />}
      </span>
    </button>
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
        {ranged && (
          <div className="chips">
            {[...new Set([s.price_min!, Math.round((s.price_min! + s.price_max!) / 2 / 10) * 10, s.price_max!])].map((p) => (
              <button key={p} type="button" className="chip num" aria-pressed={value === p} onClick={() => setValue(p)}>{formatINR(p)}</button>
            ))}
          </div>
        )}
        {low && <div className="notice notice-warning">{t('log_price_low')}</div>}
        <button className="btn btn-primary btn-lg btn-block" disabled={value == null}>
          <Check /> {t('done')}
        </button>
      </form>
    </Sheet>
  );
}

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronRight, EyeOff, Plus } from 'lucide-react';
import { useState } from 'react';
import { CheckRow, ErrorBox, Field, Loaded, MoneyInput, Page, Sheet, TopBar, useToast } from '../../components/ui';
import { useI18n } from '../../i18n/i18n';
import { must, supabase } from '../../lib/supabase';
import { nameOf, type Service, type ServiceCategory } from '../../lib/types';
import { priceLabel, useServiceCatalog } from '../salon/data';

/** Owner: salon services and prices. Changes apply to new entries only. */
export default function CatalogPage() {
  const { t, lang } = useI18n();
  const catalog = useServiceCatalog(true);
  const [cat, setCat] = useState<string | null>(null);
  const [editing, setEditing] = useState<Service | 'new' | null>(null);
  const [newCat, setNewCat] = useState(false);

  return (
    <>
      <TopBar title={t('catalog_title')} back="/more" />
      <Page>
        <p className="muted small">{t('catalog_hint')}</p>
        <Loaded q={catalog}>
          {({ categories, services }) => {
            const active = cat ?? categories[0]?.id ?? null;
            const list = services.filter((s) => s.category_id === active);
            return (
              <>
                <div className="chips" role="toolbar" aria-label={t('category')}>
                  {categories.map((c) => (
                    <button key={c.id} className="chip" aria-pressed={c.id === active} onClick={() => setCat(c.id)}>{nameOf(c, lang)}</button>
                  ))}
                  <button className="chip" onClick={() => setNewCat(true)}><Plus size={18} /> {t('category_add')}</button>
                </div>
                <div className="list">
                  {list.map((s) => (
                    <button key={s.id} className="list-item" onClick={() => setEditing(s)} style={{ opacity: s.active ? 1 : 0.55 }}>
                      <span className="grow">
                        <span className="title" style={{ display: 'block', fontWeight: 500 }}>{nameOf(s, lang)}</span>
                        {!s.active && <span className="badge badge-neutral"><EyeOff size={14} /> {t('service_hidden')}</span>}
                      </span>
                      <span className="end num">{priceLabel(s, t('from'))}</span>
                      <ChevronRight className="chev" />
                    </button>
                  ))}
                </div>
                <button className="btn btn-primary btn-block" onClick={() => setEditing('new')}><Plus /> {t('service_add')}</button>
                {editing && (
                  <ServiceSheet service={editing === 'new' ? null : editing} categories={categories}
                    defaultCategory={active} onClose={() => setEditing(null)} />
                )}
                {newCat && <CategorySheet count={categories.length} onClose={(id) => { setNewCat(false); if (id) setCat(id); }} />}
              </>
            );
          }}
        </Loaded>
      </Page>
    </>
  );
}

function ServiceSheet({ service, categories, defaultCategory, onClose }: {
  service: Service | null; categories: ServiceCategory[]; defaultCategory: string | null; onClose: () => void;
}) {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [nameEn, setNameEn] = useState(service?.name_en ?? '');
  const [nameHi, setNameHi] = useState(service?.name_hi ?? '');
  const [categoryId, setCategoryId] = useState(service?.category_id ?? defaultCategory ?? categories[0]?.id ?? '');
  const [price, setPrice] = useState<number | null>(service?.price ?? null);
  const [ranged, setRanged] = useState(service?.price_min != null && service?.price_max != null);
  const [min, setMin] = useState<number | null>(service?.price_min ?? null);
  const [max, setMax] = useState<number | null>(service?.price_max ?? null);
  const [variable, setVariable] = useState(service?.is_variable ?? false);
  const [active, setActive] = useState(service?.active ?? true);

  const rangeOk = !ranged || (min != null && max != null && min <= max);
  const m = useMutation({
    mutationFn: async () => {
      const row = {
        name_en: nameEn.trim(), name_hi: nameHi.trim() || null, category_id: categoryId,
        price: ranged ? min! : price!, price_min: ranged ? min : null, price_max: ranged ? max : null,
        is_variable: !ranged && variable, active,
      };
      if (service) must(await supabase.from('services').update(row).eq('id', service.id));
      else must(await supabase.from('services').insert({ ...row, sort: 999 }));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalog'] });
      toast({ kind: 'success', text: t('saved') });
      onClose();
    },
  });

  const check = (checked: boolean, set: (v: boolean) => void, label: string) => (
    <CheckRow checked={checked} onChange={set} label={label} />
  );

  return (
    <Sheet open onClose={onClose} title={service ? t('service_edit') : t('service_add')}>
      <div className="stack">
        <Field label={t('name_en')} htmlFor="s-en"><input id="s-en" className="input" value={nameEn} onChange={(e) => setNameEn(e.target.value)} /></Field>
        <Field label={t('name_hi')} htmlFor="s-hi"><input id="s-hi" className="input" lang="hi" value={nameHi} onChange={(e) => setNameHi(e.target.value)} /></Field>
        <Field label={t('category')} htmlFor="s-c">
          <select id="s-c" className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.map((c) => <option key={c.id} value={c.id}>{nameOf(c, lang)}</option>)}
          </select>
        </Field>
        {check(ranged, setRanged, t('service_ranged'))}
        {ranged ? (
          <div className="row">
            <Field label={t('price_min')} htmlFor="s-min"><MoneyInput id="s-min" value={min} onChange={setMin} /></Field>
            <Field label={t('price_max')} htmlFor="s-max"><MoneyInput id="s-max" value={max} onChange={setMax} /></Field>
          </div>
        ) : (
          <>
            <Field label={t('price')} htmlFor="s-p"><MoneyInput id="s-p" value={price} onChange={setPrice} /></Field>
            {check(variable, setVariable, t('service_variable'))}
          </>
        )}
        {check(active, setActive, t('service_active'))}
        {m.error && <ErrorBox error={m.error} />}
        <button className="btn btn-primary btn-lg btn-block"
          disabled={!nameEn.trim() || !categoryId || (ranged ? !rangeOk : price == null) || m.isPending} aria-busy={m.isPending}
          onClick={() => m.mutate()}>
          <Check /> {t('save')}
        </button>
      </div>
    </Sheet>
  );
}

function CategorySheet({ count, onClose }: { count: number; onClose: (id?: string) => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [en, setEn] = useState('');
  const [hi, setHi] = useState('');
  const m = useMutation({
    mutationFn: async () => (must(await supabase.from('service_categories')
      .insert({ name_en: en.trim(), name_hi: hi.trim() || null, sort: count + 1 }).select('id').single()) as { id: string }).id,
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['catalog'] });
      toast({ kind: 'success', text: t('saved') });
      onClose(id);
    },
  });
  return (
    <Sheet open onClose={() => onClose()} title={t('category_add')}>
      <div className="stack">
        <Field label={t('name_en')} htmlFor="c-en"><input id="c-en" className="input" value={en} onChange={(e) => setEn(e.target.value)} /></Field>
        <Field label={t('name_hi')} htmlFor="c-hi"><input id="c-hi" className="input" lang="hi" value={hi} onChange={(e) => setHi(e.target.value)} /></Field>
        {m.error && <ErrorBox error={m.error} />}
        <button className="btn btn-primary btn-lg btn-block" disabled={!en.trim() || m.isPending} aria-busy={m.isPending} onClick={() => m.mutate()}>
          <Check /> {t('save')}
        </button>
      </div>
    </Sheet>
  );
}

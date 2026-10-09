import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, ExternalLink, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ErrorBox, Field, Loaded, Page, PhoneInput, TopBar, useToast } from '../../components/ui';
import { useI18n } from '../../i18n/i18n';
import { must, supabase } from '../../lib/supabase';
import { normalizePhone } from '../../lib/whatsapp';
import { useSettings } from '../students/data';

/** Owner: the studio's name and phone as clients see them, and the Google review link. */
export default function StudioPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const settings = useSettings();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [review, setReview] = useState('');
  useEffect(() => {
    const s = settings.data?.settings;
    if (!s) return;
    setName(s.studio_name);
    setPhone(s.studio_phone ?? '');
    setReview(s.google_review_url ?? '');
  }, [settings.data]);

  const reviewOk = !review.trim() || /^https:\/\/\S+$/.test(review.trim());
  const save = useMutation({
    mutationFn: async () => must(await supabase.from('settings').update({
      studio_name: name.trim(), studio_phone: normalizePhone(phone) ?? (phone.trim() || null),
      google_review_url: review.trim() || null,
    }).eq('id', true)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      toast({ kind: 'success', text: t('saved') });
    },
  });

  return (
    <>
      <TopBar title={t('studio_title')} back="/more" />
      <Page>
        <Loaded q={settings} skeleton="cards">
          {() => (
            <>
              <section className="card stack">
                <Field label={t('studio_name')} htmlFor="st-n" hint={t('studio_name_hint')}>
                  <input id="st-n" className="input" value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
                <Field label={t('studio_phone')} htmlFor="st-p">
                  <PhoneInput id="st-p" value={phone} onChange={setPhone} />
                </Field>
              </section>

              <section className="card stack">
                <h2 className="card-title row" style={{ gap: 8 }}><Star size={20} /> {t('studio_review')}</h2>
                <p className="muted small">{t('studio_review_why')}</p>
                <Field label={t('studio_review_link')} htmlFor="st-r" error={reviewOk ? null : t('studio_review_bad')}>
                  <input id="st-r" className="input" inputMode="url" autoCapitalize="none" spellCheck={false}
                    placeholder="https://g.page/r/…/review" value={review} onChange={(e) => setReview(e.target.value)} />
                </Field>
                <ol className="howto">
                  <li>{t('studio_review_step1')}</li>
                  <li>{t('studio_review_step2')}</li>
                  <li>{t('studio_review_step3')}</li>
                </ol>
                <a className="btn btn-link" href="https://business.google.com/" target="_blank" rel="noopener" style={{ alignSelf: 'flex-start' }}>
                  {t('studio_review_open')} <ExternalLink size={16} />
                </a>
              </section>

              {save.error && <ErrorBox error={save.error} />}
              <button className="btn btn-primary btn-lg btn-block" disabled={!name.trim() || !reviewOk || save.isPending}
                aria-busy={save.isPending} onClick={() => save.mutate()}>
                <Check /> {t('save')}
              </button>
            </>
          )}
        </Loaded>
      </Page>
    </>
  );
}

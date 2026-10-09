import { useQueryClient } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMe } from '../../auth/auth';
import { Sheet, SheetCloseButton } from '../../components/ui';
import { useI18n } from '../../i18n/i18n';
import { haptic } from '../../lib/haptics';
import { supabase } from '../../lib/supabase';
import { waLink } from '../../lib/whatsapp';
import { useSettings } from '../students/data';
import { reviewMessage } from './data';

/**
 * "Would you leave us a Google review?" ready to send on WhatsApp. Sending
 * remembers the date, so the same client isn't asked again for 90 days.
 */
export function ReviewSheet({ phone, name, title, onClose }: { phone: string; name: string | null; title?: string; onClose: () => void }) {
  const me = useMe();
  const { t } = useI18n();
  const qc = useQueryClient();
  const settings = useSettings();
  const s = settings.data?.settings;
  const link = s?.google_review_url;
  const wa = link ? waLink(phone, reviewMessage({ t, studio: s?.studio_name ?? 'Namita Garg Makeover', name, link })) : null;

  return (
    <Sheet open onClose={onClose} title={title ?? t('review_title')}>
      <div className="stack">
        {wa ? (
          <>
            <p className="muted">{t('review_sub', { name: name || t('client') })}</p>
            <a className="btn btn-whatsapp btn-lg btn-block" href={wa} target="_blank" rel="noopener" onClick={() => {
              haptic('success');
              void supabase.rpc('mark_review_asked', { p_phone: phone }).then(() => {
                qc.invalidateQueries({ queryKey: ['client-card'] });
                qc.invalidateQueries({ queryKey: ['client', phone] });
              });
              onClose();
            }}>
              <Star /> {t('review_send')}
            </a>
          </>
        ) : (
          <div className="notice notice-info">
            <span className="grow">
              {t('review_no_link')}{' '}
              {me.is_owner && <Link to="/more/studio" onClick={onClose}>{t('review_add_link')}</Link>}
            </span>
          </div>
        )}
        <SheetCloseButton label={t('review_not_now')} />
      </div>
    </Sheet>
  );
}

/** Ask again only after 90 days, and only when there is a phone to send to. */
export function shouldAskReview(reviewAskedOn: string | null | undefined, today: string): boolean {
  if (!reviewAskedOn) return true;
  const days = (Date.parse(today) - Date.parse(reviewAskedOn)) / 86_400_000;
  return days >= 90;
}

import { LogOut } from 'lucide-react';
import { useAuth, useMe } from '../../auth/auth';
import { Choices, Initials, Page, TopBar } from '../../components/ui';
import { useI18n } from '../../i18n/i18n';
import { supabase } from '../../lib/supabase';
import type { Lang } from '../../lib/types';

export default function AccountPage() {
  const me = useMe();
  const { signOut } = useAuth();
  const { t, lang, setLang } = useI18n();

  const roles = [me.is_owner && t('role_owner'), me.is_trainer && t('role_trainer'), me.is_staff && t('role_staff')].filter(Boolean);

  function choose(l: Lang) {
    setLang(l);
    // Remembered on the account, so it follows her to another phone.
    void supabase.rpc('set_my_language', { p_lang: l });
  }

  return (
    <>
      <TopBar title={t('account_title')} back={me.is_owner ? '/more' : undefined} />
      <Page>
        <div className="card row">
          <Initials name={me.display_name} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.125rem' }}>{me.display_name}</div>
            <div className="muted small">@{me.username} · {roles.join(', ')}</div>
          </div>
        </div>

        <section className="stack">
          <h2 className="section-title">{t('language')}</h2>
          <Choices<Lang> label={t('language')} value={lang} onChange={choose}
            options={[{ value: 'en', label: 'English' }, { value: 'hi', label: 'हिंदी' }]} />
        </section>

        <button className="btn btn-secondary btn-block" onClick={signOut}><LogOut /> {t('logout')}</button>
        <p className="muted small center">NG Studio · v{__APP_VERSION__}</p>
      </Page>
    </>
  );
}

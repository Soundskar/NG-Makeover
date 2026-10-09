import { Lock, LogOut, RotateCw, WifiOff } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { ErrorBox, Field } from '../components/ui';
import { useI18n } from '../i18n/i18n';
import { useAuth } from './auth';
import { ArchMark } from '../components/ArchMark';

function LanguageSwitch() {
  const { lang, setLang } = useI18n();
  return (
    <div className="tabs" role="tablist" aria-label="Language / भाषा" style={{ width: '100%', maxWidth: 260, margin: '0 auto' }}>
      <button className="tab" role="tab" aria-selected={lang === 'en'} onClick={() => setLang('en')}>English</button>
      <button className="tab" role="tab" aria-selected={lang === 'hi'} onClick={() => setLang('hi')}>हिंदी</button>
    </div>
  );
}

export function LoginPage() {
  const { t } = useI18n();
  const { signIn } = useAuth();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [letters, setLetters] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!username.trim() || !pin) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(username, pin);
    } catch (err) {
      setError(err);
      setPin('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell no-nav">
      <main className="page stack-lg" style={{ paddingTop: 28 }}>
        <LanguageSwitch />
        <div className="center stack" style={{ gap: 4 }}>
          <ArchMark width={104} monogram className="brand-mark" />
          <h1 className="greeting">{t('login_title')}</h1>
          <p className="muted">{t('login_sub')}</p>
        </div>
        <form className="card stack" onSubmit={submit}>
          <Field label={t('login_user')} htmlFor="u">
            <input
              id="u"
              className="input"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
            />
          </Field>
          <Field label={t('pin')} htmlFor="p">
            <input
              id="p"
              className="input num"
              type="password"
              inputMode={letters ? 'text' : 'numeric'}
              autoComplete="current-password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
          </Field>
          <button type="button" className="btn btn-link" style={{ alignSelf: 'flex-start' }}
            onClick={() => setLetters((v) => !v)}>
            {letters ? t('login_use_numbers') : t('login_use_letters')}
          </button>
          {error != null && <ErrorBox error={error} />}
          <button className="btn btn-primary btn-lg btn-block" disabled={busy || !username || !pin} aria-busy={busy}>
            <Lock /> {t('login_button')}
          </button>
        </form>
        <p className="center muted small">{t('login_help')}</p>
      </main>
    </div>
  );
}

export function InactivePage() {
  const { t } = useI18n();
  const { signOut } = useAuth();
  return (
    <div className="shell no-nav">
      <main className="page stack-lg" style={{ paddingTop: 64 }}>
        <div className="notice notice-warning"><Lock /><span>{t('account_inactive')}</span></div>
        <button className="btn btn-secondary btn-block" onClick={signOut}><LogOut /> {t('logout')}</button>
      </main>
    </div>
  );
}

/** Logged in, but the profile couldn't be loaded (usually no internet). */
export function BootErrorPage() {
  const { t } = useI18n();
  const { retry, signOut } = useAuth();
  return (
    <div className="shell no-nav">
      <main className="page stack-lg center" style={{ paddingTop: 96 }}>
        <span className="empty-icon" style={{ margin: '0 auto' }}><WifiOff /></span>
        <p style={{ fontWeight: 700, fontSize: '1.125rem' }}>{t('err_network')}</p>
        <button className="btn btn-primary btn-lg btn-block" onClick={retry}><RotateCw /> {t('retry')}</button>
        <button className="btn btn-link" style={{ alignSelf: 'center' }} onClick={signOut}>{t('logout')}</button>
      </main>
    </div>
  );
}

export function NotConfiguredPage() {
  return (
    <main className="page stack" style={{ paddingTop: 64 }}>
      <h1>NG Studio</h1>
      <p className="muted">
        The app isn't connected to its database yet. Copy <code>.env.example</code> to <code>.env.local</code> and
        fill in the Supabase URL and publishable key, then restart the dev server.
      </p>
    </main>
  );
}

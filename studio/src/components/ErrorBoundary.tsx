import { RotateCw } from 'lucide-react';
import { Component, type ReactNode } from 'react';
import { useI18n } from '../i18n/i18n';

const RELOADED = 'ngstudio-reloaded-at';

/**
 * After a new version goes live, a phone that still has the old app open asks
 * for screens that no longer exist. Reloading once picks up the new version.
 * The timestamp stops a reload loop if something else is wrong.
 */
export function reloadForNewVersion(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOADED) ?? 0);
    if (Date.now() - last < 15_000) return false;
    sessionStorage.setItem(RELOADED, String(Date.now()));
  } catch {
    // No storage: reload anyway; worst case the crash screen shows next time.
  }
  window.location.reload();
  return true;
}

const isStaleChunk = (e: unknown) =>
  /dynamically imported module|Importing a module script failed|error loading dynamically|ChunkLoadError/i
    .test(e instanceof Error ? e.message : String(e));

function CrashScreen() {
  const { t } = useI18n();
  return (
    <main className="page stack-lg center" style={{ paddingTop: 96 }}>
      <img src="/favicon.svg" alt="" width={64} height={64} style={{ margin: '0 auto', borderRadius: 16 }} />
      <div className="stack" style={{ gap: 4 }}>
        <h1 style={{ fontSize: '1.375rem', fontWeight: 800 }}>{t('crash_title')}</h1>
        <p className="muted">{t('crash_sub')}</p>
      </div>
      <button className="btn btn-primary btn-lg btn-block" onClick={() => window.location.reload()}>
        <RotateCw /> {t('reload')}
      </button>
    </main>
  );
}

/** Catches a screen that fails to draw, instead of leaving a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    if (isStaleChunk(error) && reloadForNewVersion()) return;
    console.error(error);
  }

  render() {
    return this.state.failed ? <CrashScreen /> : this.props.children;
  }
}

/** First screen while the app checks who is logged in. */
export function Splash() {
  return (
    <div className="splash" role="status" aria-label="NG Studio">
      <img src="/favicon.svg" alt="" width={72} height={72} />
      <div className="splash-bar"><span /></div>
    </div>
  );
}

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Lang } from '../lib/types';
import { en, type TKey } from './en';
import { hi } from './hi';

export type { TKey };
type Vars = Record<string, string | number>;
export type TFn = (key: TKey, vars?: Vars) => string;

const dicts: Record<Lang, Record<TKey, string>> = { en, hi };
const STORE = 'ngstudio-lang';

function stored(): Lang {
  try {
    return localStorage.getItem(STORE) === 'hi' ? 'hi' : 'en';
  } catch {
    return 'en';
  }
}

interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: TFn;
}

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(stored);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORE, l);
    } catch {
      // Private mode: the choice still applies until the app is closed.
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback<TFn>((key, vars) => {
    let s: string = dicts[lang][key] ?? en[key];
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n outside I18nProvider');
  return v;
}

/** Turns database error text into something friendly, in the user's language. */
export function errorText(err: unknown, t: TFn): string {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return t('err_network');
  if (/Invalid login credentials/i.test(msg)) return t('login_failed');
  if (/only be added for today/i.test(msg)) return t('err_today_only');
  if (/within 15 minutes/i.test(msg)) return t('err_cancel_window');
  if (/does not match the total/i.test(msg)) return t('err_split_mismatch');
  if (/must add up/i.test(msg)) return t('err_plan_mismatch');
  if (/Not allowed|row-level security|permission denied/i.test(msg)) return t('err_not_allowed');
  if (/duplicate key.*username/i.test(msg) || /already been registered/i.test(msg)) return t('err_username_taken');
  // Messages written in the database functions are already plain English.
  if (/^[A-Z][^{}]{3,120}\.$/.test(msg)) return msg;
  return t('err_generic');
}

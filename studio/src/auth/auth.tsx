import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useI18n } from '../i18n/i18n';
import { emailFor, must, supabase } from '../lib/supabase';
import type { Profile } from '../lib/types';

type Status = 'loading' | 'signed_out' | 'ready' | 'inactive' | 'error';

interface Auth {
  status: Status;
  profile: Profile | null;
  signIn: (username: string, pin: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Try loading the profile again after a network failure. */
  retry: () => void;
}

const Ctx = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const { setLang } = useI18n();
  const qc = useQueryClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const uid = session?.user.id;
  const sessionKnown = session !== undefined;
  useEffect(() => {
    if (!uid) {
      setProfile(sessionKnown ? null : undefined);
      return;
    }
    let live = true;
    setLoadFailed(false);
    // A different person signed in: don't show the last person's screens meanwhile.
    setProfile((p) => (p && p.id === uid ? p : undefined));
    supabase.from('profiles').select('*').eq('id', uid).maybeSingle().then(({ data, error }) => {
      if (!live) return;
      // An error is a network problem, not a verdict on the account: offer a retry.
      if (error) {
        setLoadFailed(true);
        return;
      }
      // No row back means the account was never set up or has been switched off.
      setProfile(data as Profile | null);
      if (data) setLang((data as Profile).language);
    });
    return () => {
      live = false;
    };
  }, [uid, sessionKnown, attempt, setLang]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  // Back online while stuck on the "couldn't connect" screen: try again by itself.
  useEffect(() => {
    if (!loadFailed) return;
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [loadFailed, retry]);

  const signIn = useCallback(async (username: string, pin: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: emailFor(username), password: pin });
    if (error) throw new Error(error.message);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    qc.clear();
  }, [qc]);

  const status: Status =
    session && loadFailed && profile === undefined ? 'error'
      : session === undefined || (session && profile === undefined) ? 'loading'
        : !session ? 'signed_out'
          : profile && profile.active ? 'ready'
            : 'inactive';

  const value = useMemo(
    () => ({ status, profile: profile ?? null, signIn, signOut, retry }),
    [status, profile, signIn, signOut, retry],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): Auth {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}

/** The signed-in person. Only use below the login gate. */
export function useMe(): Profile {
  const { profile } = useAuth();
  if (!profile) throw new Error('useMe before sign-in');
  return profile;
}

/** Everyone on the team (names for "Done by", trainer pickers, history). */
export function useTeam() {
  return useQuery({
    queryKey: ['team'],
    queryFn: async () => must(await supabase.from('profiles').select('*').order('display_name')) as Profile[],
    staleTime: 5 * 60_000,
  });
}

export function useTeamNames(): (id: string | null | undefined) => string {
  const { data } = useTeam();
  return useCallback((id) => data?.find((p) => p.id === id)?.display_name ?? '—', [data]);
}

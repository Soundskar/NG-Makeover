import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** False until studio/.env.local (or the Vercel env vars) are filled in. */
export const configured = Boolean(url && key);

export const supabase = createClient(url ?? 'http://localhost:54321', key ?? 'not-configured', {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'ngstudio-auth' },
});

// Logins are a username + PIN. Supabase needs an email, so each username maps
// to an address on a reserved domain that can never receive mail.
export const LOGIN_DOMAIN = 'ngstudio.invalid';
export const emailFor = (username: string) => `${username.trim().toLowerCase()}@${LOGIN_DOMAIN}`;

/** Unwraps a Supabase result, throwing its error so React Query can show it. */
export function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

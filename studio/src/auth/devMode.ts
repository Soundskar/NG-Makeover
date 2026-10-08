// Test mode: while building, the dev server skips the login screen and signs in
// as one of three test accounts (devowner / devtrainer / devstaff). It needs
// VITE_DEV_PASSWORD in .env.development.local, which Vite only reads for the
// dev server, and everything here is behind import.meta.env.DEV, so a
// production build contains none of it. Delete the test accounts before go-live.

import { supabase } from '../lib/supabase';

export type DevRole = 'owner' | 'trainer' | 'staff';
export const DEV_ROLES: DevRole[] = ['owner', 'trainer', 'staff'];

const password: string | undefined = import.meta.env.DEV ? import.meta.env.VITE_DEV_PASSWORD : undefined;
export const devMode = import.meta.env.DEV && Boolean(password);

const STORE = 'ngstudio-dev-role';
const PAUSED = 'ngstudio-dev-paused';

/** Test mode switched off for now, to try the real login screen. */
export function devPaused(): boolean {
  try {
    return localStorage.getItem(PAUSED) === '1';
  } catch {
    return false;
  }
}

/** Show the real login screen (on = true) or go back to test mode. Reloads the app. */
export async function setDevPaused(on: boolean): Promise<void> {
  try {
    if (on) localStorage.setItem(PAUSED, '1');
    else localStorage.removeItem(PAUSED);
  } catch {
    // Without storage the choice can't stick; test mode stays on.
  }
  await supabase.auth.signOut();
  window.location.assign('/');
}

export function devRole(): DevRole {
  try {
    const r = localStorage.getItem(STORE);
    return r === 'trainer' || r === 'staff' ? r : 'owner';
  } catch {
    return 'owner';
  }
}

export async function devSignIn(role: DevRole): Promise<void> {
  if (!devMode) return;
  try {
    localStorage.setItem(STORE, role);
  } catch {
    // Not remembered; the default role is used next time.
  }
  await supabase.auth.signOut();
  const { error } = await supabase.auth.signInWithPassword({ email: `dev${role}@ngstudio.invalid`, password: password! });
  if (error) console.error('[test mode] sign-in failed:', error.message);
}

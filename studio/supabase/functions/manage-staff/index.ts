// Owner-only account management: create logins, reset PINs, change roles,
// switch logins off and on. Runs on Supabase with the service-role key, which
// never reaches the app. Every request must carry the owner's own session.

import { createClient } from 'npm:@supabase/supabase-js@2';

const LOGIN_DOMAIN = 'ngstudio.invalid';
const BANNED_FOREVER = '876000h';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

class Refusal extends Error {}

const usernameOk = (u: unknown): u is string => typeof u === 'string' && /^[a-z0-9]{3,20}$/.test(u);
const pinOk = (p: unknown): p is string => typeof p === 'string' && p.length >= 6 && p.length <= 72;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Not allowed.' }, 405);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: auth } = await admin.auth.getUser(token);
    if (!auth.user) return json({ error: 'Please log in again.' }, 401);
    const { data: caller } = await admin.from('profiles').select('is_owner, active').eq('id', auth.user.id).maybeSingle();
    if (!caller?.is_owner || !caller.active) return json({ error: 'Not allowed.' }, 403);

    const body = await req.json();

    switch (body.action) {
      case 'create': {
        const { username, pin, display_name, is_owner, is_trainer, is_staff, language, phone } = body;
        if (!usernameOk(username)) throw new Refusal('Username must be 3 to 20 small letters or numbers.');
        if (!pinOk(pin)) throw new Refusal('PIN must be at least 6 digits.');
        if (typeof display_name !== 'string' || !display_name.trim()) throw new Refusal('Please enter a name.');
        if (!is_owner && !is_trainer && !is_staff) throw new Refusal('Choose at least one role.');

        const { data: taken } = await admin.from('profiles').select('id').eq('username', username).maybeSingle();
        if (taken) throw new Refusal('That username is already taken.');

        const { data: created, error } = await admin.auth.admin.createUser({
          email: `${username}@${LOGIN_DOMAIN}`, password: pin, email_confirm: true, user_metadata: { username },
        });
        if (error || !created.user) throw new Refusal(error?.message ?? 'Could not create the login.');

        const { error: pErr } = await admin.from('profiles').insert({
          id: created.user.id, username, display_name: display_name.trim(),
          is_owner: !!is_owner, is_trainer: !!is_trainer, is_staff: !!is_staff,
          language: language === 'hi' ? 'hi' : 'en', phone: phone || null,
        });
        if (pErr) {
          await admin.auth.admin.deleteUser(created.user.id);
          throw new Refusal(pErr.message);
        }
        return json({ id: created.user.id });
      }

      case 'reset_pin': {
        const { user_id, pin } = body;
        if (!pinOk(pin)) throw new Refusal('PIN must be at least 6 digits.');
        const { error } = await admin.auth.admin.updateUserById(user_id, { password: pin });
        if (error) throw new Refusal(error.message);
        return json({ ok: true });
      }

      case 'update': {
        const { user_id, display_name, is_owner, is_trainer, is_staff, active, phone } = body;
        if (user_id === auth.user.id && (active === false || is_owner === false)) {
          throw new Refusal("You can't switch off or remove your own owner login.");
        }
        const patch: Record<string, unknown> = {};
        if (typeof display_name === 'string' && display_name.trim()) patch.display_name = display_name.trim();
        for (const [k, v] of Object.entries({ is_owner, is_trainer, is_staff, active })) {
          if (typeof v === 'boolean') patch[k] = v;
        }
        if (phone !== undefined) patch.phone = phone || null;
        const { error } = await admin.from('profiles').update(patch).eq('id', user_id);
        if (error) throw new Refusal(error.message);
        if (typeof active === 'boolean') {
          // A switched-off login can't refresh its session on any phone.
          const { error: banErr } = await admin.auth.admin.updateUserById(user_id, {
            ban_duration: active ? 'none' : BANNED_FOREVER,
          });
          if (banErr) throw new Refusal(banErr.message);
        }
        return json({ ok: true });
      }

      default:
        throw new Refusal('Unknown action.');
    }
  } catch (e) {
    if (e instanceof Refusal) return json({ error: e.message }, 400);
    console.error(e);
    return json({ error: 'Something went wrong.' }, 500);
  }
});

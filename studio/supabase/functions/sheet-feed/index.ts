// Feeds the Google Sheet of records. Each tab of the sheet has
//   =IMPORTDATA("https://<project>.supabase.co/functions/v1/sheet-feed?tab=students&key=…")
// and gets back CSV. IMPORTDATA can't send headers, so the secret key rides in
// the address; it is a long random value set with
//   npx supabase secrets set SHEET_FEED_KEY=…
// To shut every copy of the sheet out, set a new key (and update the sheet).

import { createClient } from 'npm:@supabase/supabase-js@2';

const TABS = new Set(['students', 'daily', 'monthly', 'clients', 'employees']);

/** Compares without leaking how much of the key matched. */
function sameKey(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

function csvCell(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const secret = Deno.env.get('SHEET_FEED_KEY') ?? '';
  // Without a key set on the server, nothing is served.
  if (secret.length < 32 || !sameKey(url.searchParams.get('key') ?? '', secret)) {
    return new Response('Not found', { status: 404 });
  }
  const tab = url.searchParams.get('tab') ?? '';
  if (!TABS.has(tab)) return new Response('Unknown tab', { status: 400 });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await admin.rpc('sheet_feed', { p_tab: tab });
  if (error) return new Response('Could not read the data', { status: 500 });

  const csv = (data as unknown[][]).map((row) => row.map(csvCell).join(',')).join('\r\n');
  return new Response(csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'no-store' },
  });
});

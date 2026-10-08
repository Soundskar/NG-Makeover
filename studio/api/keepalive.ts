// Daily Vercel cron (see vercel.json). Free Supabase projects pause after 7
// days without activity, which would happen over a long studio holiday. One
// tiny database call a day keeps it awake. It reads no data.

export async function GET(): Promise<Response> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return new Response('Supabase env vars missing', { status: 500 });

  const res = await fetch(`${url}/rest/v1/rpc/ping`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: '{}',
  });
  return new Response(res.ok ? 'ok' : `supabase answered ${res.status}`, { status: res.ok ? 200 : 502 });
}

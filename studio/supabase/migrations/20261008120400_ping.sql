-- The only thing anonymous callers may run: a no-data heartbeat for the daily
-- keep-alive cron (studio/api/keepalive.ts).
create or replace function public.ping() returns text
language sql stable as $$ select 'ok'::text $$;

grant execute on function public.ping() to anon, authenticated;

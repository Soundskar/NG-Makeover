-- New Supabase projects can be created with "Automatically expose new tables"
-- switched off, in which case signed-in users get no table rights at all.
-- Grant them explicitly. Row-level security (security migration) still
-- decides which rows each person sees; anonymous visitors get nothing.

grant usage on schema public to authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Tables only the database functions may write.
revoke insert, update, delete on public.audit_log, public.receipt_counters from authenticated;

grant execute on function public.ping() to anon;

-- The manage-staff Edge Function works as service_role. That role skips
-- row-level security, but in a project created without "Automatically expose
-- new tables" it still needs plain table rights, or every check it makes fails
-- and it refuses even the owner. It never reaches the app or the browser.

grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;

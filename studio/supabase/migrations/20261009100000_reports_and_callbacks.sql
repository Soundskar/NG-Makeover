-- Reports for any period, and reminding clients who are due for a visit again.

-- ============================================================
-- How soon a client usually comes back for a service.
-- Empty = no reminder (one-off things like bridal makeup or styling).
-- ============================================================
alter table public.services
  add column rebook_days smallint check (rebook_days between 1 and 365);

update public.services s set rebook_days = d.days
from (
  select s2.id,
    case
      when c.name_en = 'Waxing & Threading' and (s2.name_en ilike '%thread%' or s2.name_en ilike 'face wax%' or s2.name_en ilike 'full face wax%') then 21
      when c.name_en = 'Waxing & Threading' then 28
      when c.name_en = 'Facials & Cleanups' then 30
      when c.name_en = 'Hair' and (s2.name_en ilike '%spa%' or s2.name_en ilike '%conditioning%') then 30
      when c.name_en = 'Hair' and (s2.name_en ilike '%cut%' or s2.name_en ilike '%trim%') then 45
      when c.name_en = 'Bleach & Mani-Pedi' and (s2.name_en ilike 'body bleach%' or s2.name_en ilike 'full body bleach%') then 45
      when c.name_en = 'Bleach & Mani-Pedi' then 30
    end as days
  from public.services s2
  join public.service_categories c on c.id = s2.category_id
) d
where d.id = s.id and d.days is not null;

-- ============================================================
-- Reminders sent, and clients who asked not to be reminded.
-- ============================================================
create table public.client_followups (
  id uuid primary key default gen_random_uuid(),
  client_phone text not null,
  kind text not null check (kind in ('reminded', 'stop')),
  noted_on date not null default public.today_ist(),
  noted_by uuid default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);
create index on public.client_followups (client_phone);

alter table public.client_followups enable row level security;
create policy followups_owner on public.client_followups for all to authenticated
  using (public.is_owner()) with check (public.is_owner());
grant select, insert, delete on public.client_followups to authenticated;
grant all on public.client_followups to service_role;

-- Clients whose usual gap since their last visit has passed: one row per phone.
-- Hidden once reminded (for 14 days, or until they come back), or if they said no.
create or replace function public.clients_due()
returns table (client_phone text, client_name text, last_visit date, last_services text,
               visit_count integer, due_on date, last_reminded date)
language plpgsql stable security invoker set search_path = public as $$
#variable_conflict use_column
begin
  if not public.is_owner() then raise exception 'Not allowed.'; end if;
  return query
  with last_visit as (
    select distinct on (v.client_phone) v.id, v.client_phone, v.visit_date
    from public.visits v
    where not v.voided and v.client_phone is not null
    order by v.client_phone, v.visit_date desc, v.created_at desc
  ), visit_counts as (
    select v.client_phone, count(*)::int as n
    from public.visits v where not v.voided and v.client_phone is not null
    group by v.client_phone
  ), latest_name as (
    select distinct on (v.client_phone) v.client_phone, v.client_name
    from public.visits v
    where not v.voided and v.client_phone is not null and v.client_name is not null
    order by v.client_phone, v.visit_date desc, v.created_at desc
  ), due as (
    -- The soonest-due service in the last visit decides.
    select lv.client_phone, lv.visit_date, min(s.rebook_days)::int as days,
      string_agg(distinct vl.service_name, ', ') as services
    from last_visit lv
    join public.visit_lines vl on vl.visit_id = lv.id
    left join public.services s on s.id = vl.service_id
    group by lv.client_phone, lv.visit_date
  ), followups as (
    select f.client_phone,
      max(f.noted_on) filter (where f.kind = 'reminded') as reminded,
      bool_or(f.kind = 'stop') as stopped
    from public.client_followups f
    group by f.client_phone
  )
  select d.client_phone, ln.client_name, d.visit_date, d.services, vc.n,
         (d.visit_date + d.days)::date, fu.reminded
  from due d
  join visit_counts vc on vc.client_phone = d.client_phone
  left join latest_name ln on ln.client_phone = d.client_phone
  left join followups fu on fu.client_phone = d.client_phone
  where d.days is not null
    and d.visit_date + d.days <= public.today_ist()
    and not coalesce(fu.stopped, false)
    and (fu.reminded is null or fu.reminded < d.visit_date or fu.reminded <= public.today_ist() - 14)
  order by (d.visit_date + d.days) desc, d.client_phone;
end $$;

-- ============================================================
-- One report for any period (a day, a week, a month).
-- ============================================================
create or replace function public.studio_report(p_from date, p_to date) returns jsonb
language plpgsql stable security invoker set search_path = public as $$
declare r jsonb;
begin
  if not public.is_owner() then raise exception 'Not allowed.'; end if;
  if p_to < p_from or p_to - p_from > 400 then raise exception 'Choose a shorter period.'; end if;

  with v as (
    select * from public.visits where visit_date between p_from and p_to and not voided
  ), l as (
    select vl.* from public.visit_lines vl join v on v.id = vl.visit_id
  ), pay as (
    select * from public.payments where paid_on between p_from and p_to and not voided
  ), col as (
    select * from public.udhaar_collections where collected_on between p_from and p_to and not voided
  ), first_seen as (
    select client_phone, min(visit_date) as first_day
    from public.visits where not voided and client_phone is not null group by client_phone
  ), days as (
    select d::date as day from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') d
  )
  select jsonb_build_object(
    'salon', (select jsonb_build_object(
        'billed', coalesce(sum(total), 0), 'visits', count(*), 'discount', coalesce(sum(discount), 0),
        'cash', coalesce(sum(paid_cash), 0), 'upi', coalesce(sum(paid_upi), 0),
        'card', coalesce(sum(paid_card), 0), 'udhaar', coalesce(sum(paid_udhaar), 0),
        'clients', count(distinct client_phone), 'no_phone', count(*) filter (where client_phone is null))
      from v),
    'services', (select count(*) from l),
    'clients_new', (select count(distinct v.client_phone) from v join first_seen f using (client_phone) where f.first_day >= p_from),
    'clients_returning', (select count(distinct v.client_phone) from v join first_seen f using (client_phone) where f.first_day < p_from),
    'by_day', (select jsonb_agg(jsonb_build_object('day', d.day, 'salon', coalesce(s.amount, 0),
                 'fees', coalesce(f.amount, 0), 'visits', coalesce(s.n, 0)) order by d.day)
               from days d
               left join (select visit_date, sum(total) as amount, count(*) as n from v group by visit_date) s on s.visit_date = d.day
               left join (select paid_on, sum(amount) as amount from pay group by paid_on) f on f.paid_on = d.day),
    'by_hour', (select coalesce(jsonb_agg(jsonb_build_object('hour', h, 'visits', n, 'amount', amount) order by h), '[]'::jsonb)
                from (select extract(hour from created_at at time zone 'Asia/Kolkata')::int as h, count(*) as n, sum(total) as amount
                      from v group by 1) x),
    'top_services', (select coalesce(jsonb_agg(jsonb_build_object('name', name, 'count', n, 'amount', amount) order by amount desc, name), '[]'::jsonb)
                     from (select service_name as name, count(*) as n, sum(price - discount) as amount
                           from l group by service_name order by sum(price - discount) desc, service_name limit 8) x),
    'by_staff', (select coalesce(jsonb_agg(jsonb_build_object('staff_id', staff_id, 'count', n, 'amount', amount) order by amount desc), '[]'::jsonb)
                 from (select staff_id, count(*) as n, sum(price - discount) as amount from l group by staff_id) x),
    'fees', (select jsonb_build_object('collected', coalesce(sum(amount), 0), 'payments', count(*)) from pay),
    'admissions', (select count(*) from public.enrollments
                   where (created_at at time zone 'Asia/Kolkata')::date between p_from and p_to),
    'attendance', (select jsonb_build_object(
        'present', count(*) filter (where status = 'present'),
        'absent', count(*) filter (where status = 'absent'),
        'leave', count(*) filter (where status = 'leave'))
      from public.attendance where day between p_from and p_to),
    'udhaar', jsonb_build_object(
        'given', (select coalesce(sum(paid_udhaar), 0) from v),
        'collected', (select coalesce(sum(amount), 0) from col))
  ) into r;
  return r;
end $$;

revoke execute on function public.clients_due(), public.studio_report(date, date) from public, anon;
grant execute on function public.clients_due(), public.studio_report(date, date) to authenticated, service_role;

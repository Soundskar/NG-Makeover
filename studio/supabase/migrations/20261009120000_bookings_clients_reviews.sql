-- Client profiles, bookings with advances, and Google review requests.

-- ============================================================
-- Clients: one card per phone number
-- ============================================================
create table public.clients (
  phone text primary key check (phone ~ '^[6-9][0-9]{9}$'),
  name text,
  birth_day smallint check (birth_day between 1 and 31),
  birth_month smallint check (birth_month between 1 and 12),
  notes text,
  review_asked_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((birth_day is null) = (birth_month is null))
);

alter table public.clients enable row level security;
-- The owner sees and edits everything; staff get a short card through client_card().
create policy clients_owner on public.clients for all to authenticated
  using (public.is_owner()) with check (public.is_owner());
grant select, insert, update on public.clients to authenticated;
grant all on public.clients to service_role;
create trigger audit_clients after insert or update or delete on public.clients
  for each row execute function public.audit_row();

-- Everyone who has visited with a proper mobile number, with the latest name we have.
insert into public.clients (phone, name)
select distinct on (client_phone) client_phone, client_name
from public.visits
where not voided and client_phone ~ '^[6-9][0-9]{9}$'
order by client_phone, (client_name is null), visit_date desc, created_at desc
on conflict (phone) do nothing;

-- Adds a client, or fills in her name if we didn't have it. Used by entries and bookings.
create or replace function public.remember_client(p_phone text, p_name text) returns void
language sql security definer set search_path = public as $$
  insert into public.clients (phone, name)
  select p_phone, nullif(trim(p_name), '')
  where p_phone ~ '^[6-9][0-9]{9}$'
  on conflict (phone) do update
    set name = coalesce(excluded.name, clients.name), updated_at = now()
$$;

alter table public.client_followups drop constraint client_followups_kind_check;
alter table public.client_followups add constraint client_followups_kind_check
  check (kind in ('reminded', 'stop', 'birthday'));

alter table public.settings add column google_review_url text;

-- ============================================================
-- Bookings
-- ============================================================
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  client_phone text not null check (client_phone ~ '^[6-9][0-9]{9}$'),
  client_name text not null check (length(trim(client_name)) > 0),
  day date not null,
  start_time time not null,
  duration_minutes smallint not null default 60 check (duration_minutes between 15 and 720),
  service_ids uuid[] not null default '{}',
  -- Names copied at booking time, so a renamed service doesn't change old bookings.
  services_text text,
  staff_id uuid references public.profiles (id),
  quoted integer check (quoted >= 0),
  note text,
  status text not null default 'booked' check (status in ('booked', 'done', 'cancelled', 'no_show')),
  cancel_reason text,
  visit_id uuid references public.visits (id),
  reminded_on date,
  created_by uuid default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  check (status <> 'cancelled' or cancel_reason is not null)
);
create index on public.appointments (day, start_time);
create index on public.appointments (client_phone);

alter table public.appointments enable row level security;
-- Staff take bookings at the counter and on the phone, so they see and edit them too.
create policy appointments_read on public.appointments for select to authenticated
  using (public.is_owner() or public.is_staff());
create policy appointments_insert on public.appointments for insert to authenticated
  with check (public.is_owner() or public.is_staff());
create policy appointments_update on public.appointments for update to authenticated
  using (public.is_owner() or public.is_staff()) with check (public.is_owner() or public.is_staff());
grant select, insert, update on public.appointments to authenticated;
grant all on public.appointments to service_role;
create trigger audit_appointments after insert or update or delete on public.appointments
  for each row execute function public.audit_row();

create or replace function public.appointment_remember_client() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.remember_client(new.client_phone, new.client_name);
  return new;
end $$;
create trigger appointments_client after insert on public.appointments
  for each row execute function public.appointment_remember_client();

-- Advances: money, so never deleted, only cancelled with a reason.
create table public.appointment_advances (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete restrict,
  amount integer not null check (amount > 0),
  mode text not null check (mode in ('cash', 'upi', 'card', 'bank')),
  paid_on date not null default public.today_ist(),
  received_by uuid default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  voided boolean not null default false,
  void_reason text,
  voided_at timestamptz,
  voided_by uuid references public.profiles (id),
  check (not voided or void_reason is not null)
);
create index on public.appointment_advances (appointment_id);
create index on public.appointment_advances (paid_on);

alter table public.appointment_advances enable row level security;
create policy advances_read on public.appointment_advances for select to authenticated
  using (public.is_owner() or public.is_staff());
grant select on public.appointment_advances to authenticated;
grant all on public.appointment_advances to service_role;
create trigger audit_appointment_advances after insert or update or delete on public.appointment_advances
  for each row execute function public.audit_row();

create or replace function public.add_advance(p_appointment uuid, p_amount integer, p_mode text) returns uuid
language plpgsql security definer set search_path = public as $$
declare a record; v_id uuid;
begin
  if not (public.is_owner() or public.is_staff()) then raise exception 'Not allowed.'; end if;
  select * into a from public.appointments where id = p_appointment;
  if not found or a.status <> 'booked' then raise exception 'This booking is already closed.'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Enter an amount.'; end if;
  if p_mode is null or p_mode not in ('cash', 'upi', 'card', 'bank') then raise exception 'Choose how it was paid.'; end if;
  insert into public.appointment_advances (appointment_id, amount, mode, received_by)
  values (p_appointment, p_amount, p_mode, auth.uid()) returning id into v_id;
  return v_id;
end $$;

create or replace function public.void_advance(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare c record; a record;
begin
  select * into c from public.appointment_advances where id = p_id;
  if not found then raise exception 'Entry not found.'; end if;
  if c.voided then raise exception 'This was already cancelled.'; end if;
  select * into a from public.appointments where id = c.appointment_id;
  if a.status = 'done' then raise exception 'This advance was used in the bill. Cancel that entry first.'; end if;
  if not public.is_owner() then
    if not public.is_staff() or c.received_by <> auth.uid() then raise exception 'Not allowed.'; end if;
    if c.created_at < now() - interval '15 minutes' then
      raise exception 'Entries can only be cancelled within 15 minutes. Ask Namita ma''am.';
    end if;
  end if;
  update public.appointment_advances
     set voided = true, void_reason = coalesce(nullif(trim(p_reason), ''), 'Cancelled'),
         voided_at = now(), voided_by = auth.uid()
   where id = p_id;
end $$;

-- ============================================================
-- Salon entries can be started from a booking; its advance counts as paid.
-- ============================================================
alter table public.visits
  add column paid_advance integer not null default 0 check (paid_advance >= 0),
  add column appointment_id uuid references public.appointments (id);
alter table public.visits drop constraint visits_paid_matches_total;
alter table public.visits add constraint visits_paid_matches_total
  check (paid_cash + paid_upi + paid_card + paid_udhaar + paid_advance = total);

-- p: as before, plus appointment_id? and paid_advance?
create or replace function public.log_visit(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_date date := coalesce((p ->> 'visit_date')::date, public.today_ist());
  v_subtotal integer;
  v_discount integer := coalesce((p ->> 'discount')::int, 0);
  v_total integer;
  v_cash integer := coalesce((p ->> 'paid_cash')::int, 0);
  v_upi integer := coalesce((p ->> 'paid_upi')::int, 0);
  v_card integer := coalesce((p ->> 'paid_card')::int, 0);
  v_udhaar integer := coalesce((p ->> 'paid_udhaar')::int, 0);
  v_advance integer := coalesce((p ->> 'paid_advance')::int, 0);
  v_appt uuid := nullif(p ->> 'appointment_id', '')::uuid;
  v_avail integer;
  v_name text := nullif(trim(p ->> 'client_name'), '');
  v_phone text := nullif(trim(p ->> 'client_phone'), '');
  a record;
  l jsonb;
  s record;
  i integer := 0;
begin
  if not (public.is_owner() or public.is_staff()) then
    raise exception 'Not allowed.';
  end if;
  if not public.is_owner() and v_date <> public.today_ist() then
    raise exception 'Entries can only be added for today.';
  end if;
  if jsonb_typeof(p -> 'lines') <> 'array' or jsonb_array_length(p -> 'lines') = 0 then
    raise exception 'Add at least one service.';
  end if;
  if v_cash < 0 or v_upi < 0 or v_card < 0 or v_udhaar < 0 or v_advance < 0 then
    raise exception 'Payment amounts can''t be negative.';
  end if;

  if v_appt is not null then
    select * into a from public.appointments where id = v_appt for update;
    if not found or a.status <> 'booked' then raise exception 'This booking is already closed.'; end if;
    select coalesce(sum(amount), 0) into v_avail
      from public.appointment_advances where appointment_id = v_appt and not voided;
    if v_advance > v_avail then raise exception 'Only % was paid in advance.', v_avail; end if;
  elsif v_advance > 0 then
    raise exception 'An advance must come from a booking.';
  end if;

  select coalesce(sum((x ->> 'price')::int), 0) into v_subtotal from jsonb_array_elements(p -> 'lines') x;
  if v_discount < 0 or v_discount > v_subtotal then
    raise exception 'The discount can''t be more than the bill.';
  end if;
  v_total := v_subtotal - v_discount;
  if v_cash + v_upi + v_card + v_udhaar + v_advance <> v_total then
    raise exception 'Payment (%) does not match the total (%).', v_cash + v_upi + v_card + v_udhaar + v_advance, v_total;
  end if;
  if v_udhaar > 0 and (v_name is null or v_phone is null) then
    raise exception 'Udhaar needs the client''s name and phone.';
  end if;

  insert into public.visits (visit_date, client_name, client_phone, total, discount, discount_note,
                             paid_cash, paid_upi, paid_card, paid_udhaar, paid_advance, appointment_id, note, created_by)
  values (v_date, v_name, v_phone, v_total, v_discount,
          case when v_discount > 0 then nullif(trim(p ->> 'discount_note'), '') end,
          v_cash, v_upi, v_card, v_udhaar, v_advance, v_appt, nullif(trim(p ->> 'note'), ''), auth.uid())
  returning id into v_id;

  for l in select * from jsonb_array_elements(p -> 'lines') loop
    select id, name_en, price into s from public.services where id = (l ->> 'service_id')::uuid;
    if not found then
      raise exception 'Unknown service.';
    end if;
    if not exists (
      select 1 from public.profiles
      where id = (l ->> 'staff_id')::uuid and active and (is_staff or is_owner)
    ) then
      raise exception 'Unknown staff member.';
    end if;
    if (l ->> 'price')::int < 0 then
      raise exception 'Price can''t be negative.';
    end if;
    insert into public.visit_lines (visit_id, service_id, service_name, list_price, price, staff_id, sort)
    values (v_id, s.id, s.name_en, s.price, (l ->> 'price')::int, (l ->> 'staff_id')::uuid, i);
    i := i + 1;
  end loop;

  -- Share the discount across the lines by price, to the rupee (largest remainder).
  if v_discount > 0 then
    update public.visit_lines vl set discount = a2.share
    from (
      select id, base + case when rk <= leftover then 1 else 0 end as share
      from (
        select id, base,
          row_number() over (order by frac desc, sort) as rk,
          v_discount - sum(base) over () as leftover
        from (
          select id, sort,
            (v_discount::bigint * price / v_subtotal)::int as base,
            (v_discount::bigint * price % v_subtotal) as frac
          from public.visit_lines where visit_id = v_id
        ) b
      ) c
    ) a2
    where vl.id = a2.id;
  end if;

  if v_appt is not null then
    update public.appointments set status = 'done', visit_id = v_id where id = v_appt;
  end if;
  if v_phone is not null then
    perform public.remember_client(v_phone, v_name);
  end if;

  return v_id;
end $$;

-- Cancelling an entry that came from a booking reopens the booking (and its advance).
create or replace function public.void_visit(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare v record;
begin
  select * into v from public.visits where id = p_id;
  if not found then raise exception 'Entry not found.'; end if;
  if v.voided then raise exception 'This entry is already cancelled.'; end if;
  if not public.is_owner() then
    if not public.is_staff() or v.created_by <> auth.uid() then
      raise exception 'Not allowed.';
    end if;
    if v.created_at < now() - interval '15 minutes' then
      raise exception 'Entries can only be cancelled within 15 minutes. Ask Namita ma''am.';
    end if;
  end if;
  if exists (select 1 from public.udhaar_collections where visit_id = p_id and not voided) then
    raise exception 'Udhaar has already been collected on this entry. Cancel that first.';
  end if;
  update public.visits
     set voided = true, void_reason = coalesce(nullif(trim(p_reason), ''), 'Cancelled'),
         voided_at = now(), voided_by = auth.uid()
   where id = p_id;
  update public.appointments set status = 'booked', visit_id = null where visit_id = p_id;
end $$;

-- The drawer also holds advances taken in cash that day (and UPI likewise).
create or replace function public.close_day(p_day date, p_counted_cash integer, p_upi_checked boolean, p_note text)
returns public.day_closings
language plpgsql security definer set search_path = public as $$
declare
  r public.day_closings;
  v_cash integer;
  v_upi integer;
  c_cash integer;
  c_upi integer;
  a_cash integer;
  a_upi integer;
begin
  if not public.is_owner() then raise exception 'Not allowed.'; end if;
  select coalesce(sum(paid_cash), 0), coalesce(sum(paid_upi), 0) into v_cash, v_upi
    from public.visits where visit_date = p_day and not voided;
  select coalesce(sum(amount) filter (where mode = 'cash'), 0), coalesce(sum(amount) filter (where mode = 'upi'), 0)
    into c_cash, c_upi
    from public.udhaar_collections where collected_on = p_day and not voided;
  select coalesce(sum(amount) filter (where mode = 'cash'), 0), coalesce(sum(amount) filter (where mode = 'upi'), 0)
    into a_cash, a_upi
    from public.appointment_advances where paid_on = p_day and not voided;
  insert into public.day_closings (day, expected_cash, counted_cash, upi_expected, upi_checked, note, closed_by, closed_at)
  values (p_day, v_cash + c_cash + a_cash, p_counted_cash, v_upi + c_upi + a_upi, p_upi_checked, nullif(trim(p_note), ''), auth.uid(), now())
  on conflict (day) do update set
    expected_cash = excluded.expected_cash, counted_cash = excluded.counted_cash,
    upi_expected = excluded.upi_expected, upi_checked = excluded.upi_checked,
    note = excluded.note, closed_by = excluded.closed_by, closed_at = excluded.closed_at
  returning * into r;
  return r;
end $$;

-- ============================================================
-- What staff see about a client at the counter: no money, just what helps
-- them look after her (notes like allergies, her last visit, her next booking).
-- ============================================================
create or replace function public.client_card(p_phone text) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when not (public.is_owner() or public.is_staff()) then null else (
    select jsonb_build_object(
      'phone', p_phone,
      'name', coalesce(c.name, (select client_name from public.visits where client_phone = p_phone and client_name is not null and not voided order by created_at desc limit 1)),
      'notes', c.notes,
      'birth_day', c.birth_day,
      'birth_month', c.birth_month,
      'review_asked_on', c.review_asked_on,
      'visits', (select count(*) from public.visits where client_phone = p_phone and not voided),
      'last_visit', (select max(visit_date) from public.visits where client_phone = p_phone and not voided),
      'last_services', (select string_agg(vl.service_name, ', ' order by vl.sort) from public.visit_lines vl
                        where vl.visit_id = (select id from public.visits where client_phone = p_phone and not voided
                                             order by visit_date desc, created_at desc limit 1)),
      'next_booking', (select jsonb_build_object('id', id, 'day', day, 'time', start_time, 'services', services_text)
                       from public.appointments where client_phone = p_phone and status = 'booked' and day >= public.today_ist()
                       order by day, start_time limit 1)
    )
    from (select 1) one left join public.clients c on c.phone = p_phone
  ) end
$$;

-- Owner: every client with her visits and spend, newest first.
create or replace function public.client_list()
returns table (phone text, name text, visit_count integer, spent bigint, first_visit date, last_visit date,
               birth_day smallint, birth_month smallint, has_notes boolean, next_booking date)
language plpgsql stable security invoker set search_path = public as $$
#variable_conflict use_column
begin
  if not public.is_owner() then raise exception 'Not allowed.'; end if;
  return query
  select c.phone, c.name, coalesce(v.n, 0)::int, coalesce(v.spent, 0)::bigint, v.first_visit, v.last_visit,
         c.birth_day, c.birth_month, (c.notes is not null and length(trim(c.notes)) > 0),
         (select min(ap.day) from public.appointments ap where ap.client_phone = c.phone and ap.status = 'booked' and ap.day >= public.today_ist())
  from public.clients c
  left join (
    select client_phone, count(*) as n, sum(total) as spent, min(visit_date) as first_visit, max(visit_date) as last_visit
    from public.visits where not voided group by client_phone
  ) v on v.client_phone = c.phone
  order by v.last_visit desc nulls last, c.name;
end $$;

-- A review request was sent (from the counter or the client's page).
create or replace function public.mark_review_asked(p_phone text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_owner() or public.is_staff()) then raise exception 'Not allowed.'; end if;
  perform public.remember_client(p_phone, null);
  update public.clients set review_asked_on = public.today_ist(), updated_at = now() where phone = p_phone;
end $$;

-- ============================================================
-- Call-backs: a client who already has a booking coming up isn't "due".
-- ============================================================
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
  select d.client_phone, coalesce(cl.name, ln.client_name), d.visit_date, d.services, vc.n,
         (d.visit_date + d.days)::date, fu.reminded
  from due d
  join visit_counts vc on vc.client_phone = d.client_phone
  left join latest_name ln on ln.client_phone = d.client_phone
  left join public.clients cl on cl.phone = d.client_phone
  left join followups fu on fu.client_phone = d.client_phone
  where d.days is not null
    and d.visit_date + d.days <= public.today_ist()
    and not coalesce(fu.stopped, false)
    and (fu.reminded is null or fu.reminded < d.visit_date or fu.reminded <= public.today_ist() - 14)
    and not exists (select 1 from public.appointments ap
                    where ap.client_phone = d.client_phone and ap.status = 'booked' and ap.day >= public.today_ist())
  order by (d.visit_date + d.days) desc, d.client_phone;
end $$;

-- ============================================================
-- Reports also show advances taken and how bookings went.
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
        'advance', coalesce(sum(paid_advance), 0),
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
        'collected', (select coalesce(sum(amount), 0) from col)),
    'advances', (select coalesce(sum(amount), 0) from public.appointment_advances
                 where paid_on between p_from and p_to and not voided),
    'bookings', (select jsonb_build_object(
        'total', count(*),
        'done', count(*) filter (where status = 'done'),
        'no_show', count(*) filter (where status = 'no_show'),
        'cancelled', count(*) filter (where status = 'cancelled'))
      from public.appointments where day between p_from and p_to)
  ) into r;
  return r;
end $$;

revoke execute on function
  public.remember_client(text, text), public.add_advance(uuid, integer, text), public.void_advance(uuid, text),
  public.client_card(text), public.client_list(), public.mark_review_asked(text)
  from public, anon;
grant execute on function
  public.add_advance(uuid, integer, text), public.void_advance(uuid, text),
  public.client_card(text), public.client_list(), public.mark_review_asked(text)
  to authenticated, service_role;
grant execute on function public.remember_client(text, text) to service_role;

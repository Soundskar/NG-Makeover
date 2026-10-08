-- Salon work log: bill discounts, udhaar (pay later), and each person's work.
-- Commission will be worked out from visit_lines: who did which service, the
-- menu price, what was charged, and that line's share of any bill discount.
-- The commission rules themselves come later.

-- ============================================================
-- Visits: a discount on the whole bill, and udhaar
-- ============================================================
alter table public.visits
  add column discount integer not null default 0 check (discount >= 0),
  add column discount_note text,
  add column paid_udhaar integer not null default 0 check (paid_udhaar >= 0);

-- "cash + UPI + card = total" becomes a check that includes udhaar.
do $$
declare c text;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.visits'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) like '%paid_cash + paid_upi%'
  loop
    execute format('alter table public.visits drop constraint %I', c);
  end loop;
end $$;

alter table public.visits
  add constraint visits_paid_matches_total check (paid_cash + paid_upi + paid_card + paid_udhaar = total),
  -- Someone has to be asked for the money later.
  add constraint visits_udhaar_needs_client check (paid_udhaar = 0 or (client_name is not null and client_phone is not null));

-- Each line's share of the bill discount, so every person's work is counted
-- at what was really charged for it.
alter table public.visit_lines
  add column discount integer not null default 0 check (discount >= 0),
  add constraint visit_lines_discount_within_price check (discount <= price);

-- ============================================================
-- Udhaar collected later. Like fee payments: never deleted, only cancelled.
-- ============================================================
create table public.udhaar_collections (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.visits (id) on delete restrict,
  amount integer not null check (amount > 0),
  mode text not null check (mode in ('cash', 'upi', 'card')),
  collected_on date not null default public.today_ist(),
  collected_by uuid default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  voided boolean not null default false,
  void_reason text,
  voided_at timestamptz,
  voided_by uuid references public.profiles (id),
  check (not voided or void_reason is not null)
);
create index on public.udhaar_collections (visit_id);
create index on public.udhaar_collections (collected_on);

alter table public.udhaar_collections enable row level security;
-- Owner sees all; staff see what they collected today. Writes go through the functions below.
create policy udhaar_collections_read on public.udhaar_collections for select to authenticated
  using (public.is_owner() or (public.is_staff() and collected_by = auth.uid() and collected_on = public.today_ist()));
grant select on public.udhaar_collections to authenticated;
grant all on public.udhaar_collections to service_role;

create trigger audit_udhaar_collections after insert or update or delete on public.udhaar_collections
  for each row execute function public.audit_row();

-- Every udhaar entry with what's been collected and what's still owed.
-- Runs with the caller's rights: the owner sees all of it.
create view public.udhaar_status with (security_invoker = true) as
select v.id as visit_id, v.visit_date, v.client_name, v.client_phone, v.created_by,
  v.paid_udhaar as udhaar,
  coalesce(c.collected, 0)::int as collected,
  (v.paid_udhaar - coalesce(c.collected, 0))::int as outstanding,
  c.last_collected_on
from public.visits v
left join (
  select visit_id, sum(amount)::int as collected, max(collected_on) as last_collected_on
  from public.udhaar_collections where not voided group by visit_id
) c on c.visit_id = v.id
where v.paid_udhaar > 0 and not v.voided;
grant select on public.udhaar_status to authenticated;
grant select on public.udhaar_status to service_role;

-- ============================================================
-- Logging a visit, now with a discount and udhaar.
-- p: { client_name, client_phone, note, visit_date?, discount?, discount_note?,
--      paid_cash, paid_upi, paid_card, paid_udhaar?, lines: [{ service_id, price, staff_id }] }
-- ============================================================
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
  v_name text := nullif(trim(p ->> 'client_name'), '');
  v_phone text := nullif(trim(p ->> 'client_phone'), '');
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
  if v_cash < 0 or v_upi < 0 or v_card < 0 or v_udhaar < 0 then
    raise exception 'Payment amounts can''t be negative.';
  end if;

  select coalesce(sum((x ->> 'price')::int), 0) into v_subtotal from jsonb_array_elements(p -> 'lines') x;
  if v_discount < 0 or v_discount > v_subtotal then
    raise exception 'The discount can''t be more than the bill.';
  end if;
  v_total := v_subtotal - v_discount;
  if v_cash + v_upi + v_card + v_udhaar <> v_total then
    raise exception 'Payment (%) does not match the total (%).', v_cash + v_upi + v_card + v_udhaar, v_total;
  end if;
  if v_udhaar > 0 and (v_name is null or v_phone is null) then
    raise exception 'Udhaar needs the client''s name and phone.';
  end if;

  insert into public.visits (visit_date, client_name, client_phone, total, discount, discount_note,
                             paid_cash, paid_upi, paid_card, paid_udhaar, note, created_by)
  values (v_date, v_name, v_phone, v_total, v_discount,
          case when v_discount > 0 then nullif(trim(p ->> 'discount_note'), '') end,
          v_cash, v_upi, v_card, v_udhaar, nullif(trim(p ->> 'note'), ''), auth.uid())
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

  -- Share the discount across the lines by price. Whole rupees: each line gets
  -- its rounded-down share, and the rupees left over go to the lines that lost
  -- the most to rounding, so the shares always add up to the discount exactly.
  if v_discount > 0 then
    update public.visit_lines vl set discount = a.share
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
    ) a
    where vl.id = a.id;
  end if;

  return v_id;
end $$;

-- An entry with udhaar money already collected can't simply be cancelled:
-- that money is real. Cancel the collection first.
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
end $$;

-- Close the day: the drawer should hold the day's cash entries plus any udhaar
-- collected in cash that day (and the same for UPI).
create or replace function public.close_day(p_day date, p_counted_cash integer, p_upi_checked boolean, p_note text)
returns public.day_closings
language plpgsql security definer set search_path = public as $$
declare
  r public.day_closings;
  v_cash integer;
  v_upi integer;
  c_cash integer;
  c_upi integer;
begin
  if not public.is_owner() then raise exception 'Not allowed.'; end if;
  select coalesce(sum(paid_cash), 0), coalesce(sum(paid_upi), 0) into v_cash, v_upi
    from public.visits where visit_date = p_day and not voided;
  select coalesce(sum(amount) filter (where mode = 'cash'), 0), coalesce(sum(amount) filter (where mode = 'upi'), 0)
    into c_cash, c_upi
    from public.udhaar_collections where collected_on = p_day and not voided;
  insert into public.day_closings (day, expected_cash, counted_cash, upi_expected, upi_checked, note, closed_by, closed_at)
  values (p_day, v_cash + c_cash, p_counted_cash, v_upi + c_upi, p_upi_checked, nullif(trim(p_note), ''), auth.uid(), now())
  on conflict (day) do update set
    expected_cash = excluded.expected_cash, counted_cash = excluded.counted_cash,
    upi_expected = excluded.upi_expected, upi_checked = excluded.upi_checked,
    note = excluded.note, closed_by = excluded.closed_by, closed_at = excluded.closed_at
  returning * into r;
  return r;
end $$;

-- ============================================================
-- Udhaar: look up, collect, cancel a collection
-- ============================================================

-- What a client still owes. Staff can't browse past entries, but typing the
-- client's phone at the counter shows her udhaar, so it can be collected.
create or replace function public.udhaar_for_phone(p_phone text)
returns table (visit_id uuid, visit_date date, client_name text, outstanding integer)
language sql stable security definer set search_path = public as $$
  select v.id, v.visit_date, v.client_name, (v.paid_udhaar - coalesce(c.collected, 0))::int
  from public.visits v
  left join (
    select visit_id as vid, sum(amount)::int as collected
    from public.udhaar_collections where not voided group by visit_id
  ) c on c.vid = v.id
  where (public.is_owner() or public.is_staff())
    and v.client_phone = p_phone and v.paid_udhaar > 0 and not v.voided
    and v.paid_udhaar > coalesce(c.collected, 0)
  order by v.visit_date, v.created_at
$$;

create or replace function public.collect_udhaar(p_visit uuid, p_amount integer, p_mode text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v record;
  v_left integer;
  v_id uuid;
begin
  if not (public.is_owner() or public.is_staff()) then raise exception 'Not allowed.'; end if;
  select * into v from public.visits where id = p_visit for update;
  if not found or v.voided or v.paid_udhaar = 0 then
    raise exception 'There is no udhaar on this entry.';
  end if;
  select v.paid_udhaar - coalesce(sum(amount), 0) into v_left
    from public.udhaar_collections where visit_id = p_visit and not voided;
  if p_amount is null or p_amount <= 0 then raise exception 'Enter an amount.'; end if;
  if p_amount > v_left then raise exception 'Only % is still owed.', v_left; end if;
  if p_mode is null or p_mode not in ('cash', 'upi', 'card') then raise exception 'Choose how it was paid.'; end if;
  insert into public.udhaar_collections (visit_id, amount, mode, collected_by)
  values (p_visit, p_amount, p_mode, auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- Same rule as entries: staff can undo their own within 15 minutes; the owner any time.
create or replace function public.void_udhaar_collection(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare c record;
begin
  select * into c from public.udhaar_collections where id = p_id;
  if not found then raise exception 'Entry not found.'; end if;
  if c.voided then raise exception 'This was already cancelled.'; end if;
  if not public.is_owner() then
    if not public.is_staff() or c.collected_by <> auth.uid() then raise exception 'Not allowed.'; end if;
    if c.created_at < now() - interval '15 minutes' then
      raise exception 'Entries can only be cancelled within 15 minutes. Ask Namita ma''am.';
    end if;
  end if;
  update public.udhaar_collections
     set voided = true, void_reason = coalesce(nullif(trim(p_reason), ''), 'Cancelled'),
         voided_at = now(), voided_by = auth.uid()
   where id = p_id;
end $$;

-- ============================================================
-- Work done: the basis for commission
-- ============================================================

-- The services I did myself (whoever typed the entry), with no client details.
create or replace function public.my_work(p_from date, p_to date)
returns table (day date, service_name text, list_price integer, price integer, discount integer, logged_at timestamptz)
language sql stable security definer set search_path = public as $$
  select v.visit_date, l.service_name, l.list_price, l.price, l.discount, v.created_at
  from public.visit_lines l
  join public.visits v on v.id = l.visit_id
  where public.is_member() and l.staff_id = auth.uid()
    and v.visit_date between p_from and p_to and not v.voided
  order by v.visit_date desc, v.created_at desc, l.sort
$$;

-- Owner: everyone's work over a period, one row per person.
create or replace function public.work_by_staff(p_from date, p_to date)
returns table (staff_id uuid, services bigint, menu_value bigint, charged bigint, discount bigint, net bigint)
language plpgsql stable security invoker set search_path = public as $$
begin
  if not public.is_owner() then raise exception 'Not allowed.'; end if;
  return query
    select l.staff_id, count(*), sum(l.list_price)::bigint, sum(l.price)::bigint,
           sum(l.discount)::bigint, sum(l.price - l.discount)::bigint
    from public.visit_lines l
    join public.visits v on v.id = l.visit_id
    where v.visit_date between p_from and p_to and not v.voided
    group by l.staff_id;
end $$;

revoke execute on function
  public.udhaar_for_phone(text), public.collect_udhaar(uuid, integer, text),
  public.void_udhaar_collection(uuid, text), public.my_work(date, date), public.work_by_staff(date, date)
  from public, anon;
grant execute on function
  public.udhaar_for_phone(text), public.collect_udhaar(uuid, integer, text),
  public.void_udhaar_collection(uuid, text), public.my_work(date, date), public.work_by_staff(date, date)
  to authenticated, service_role;

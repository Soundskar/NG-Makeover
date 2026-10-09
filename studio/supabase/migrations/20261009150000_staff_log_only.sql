-- For now salon staff only log services (Mom's call, 9 Oct 2026). Bookings,
-- advances and collecting old udhaar are the owner's. Staff can still mark a
-- bill as udhaar, and still see what a client owes when they type her phone.

-- ============================================================
-- Bookings and advances: owner only.
-- ============================================================
drop policy appointments_read on public.appointments;
drop policy appointments_insert on public.appointments;
drop policy appointments_update on public.appointments;
create policy appointments_owner on public.appointments for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy advances_read on public.appointment_advances;
create policy advances_read on public.appointment_advances for select to authenticated
  using (public.is_owner());

create or replace function public.add_advance(p_appointment uuid, p_amount integer, p_mode text) returns uuid
language plpgsql security definer set search_path = public as $$
declare a record; v_id uuid;
begin
  if not public.is_owner() then raise exception 'Not allowed.'; end if;
  select * into a from public.appointments where id = p_appointment;
  if not found or a.status <> 'booked' then raise exception 'This booking is already closed.'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Enter an amount.'; end if;
  if p_mode is null or p_mode not in ('cash', 'upi', 'card', 'bank') then raise exception 'Choose how it was paid.'; end if;
  insert into public.appointment_advances (appointment_id, amount, mode, received_by)
  values (p_appointment, p_amount, p_mode, auth.uid()) returning id into v_id;
  return v_id;
end $$;

-- ============================================================
-- Collecting udhaar later: owner only.
-- ============================================================
create or replace function public.collect_udhaar(p_visit uuid, p_amount integer, p_mode text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v record;
  v_left integer;
  v_id uuid;
begin
  if not public.is_owner() then raise exception 'Not allowed.'; end if;
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

create or replace function public.collect_udhaar_for_phone(p_phone text, p_amount integer, p_mode text)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_owed integer;
  v_left integer := p_amount;
  v_take integer;
begin
  if not public.is_owner() then raise exception 'Not allowed.'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Enter an amount.'; end if;
  if p_mode is null or p_mode not in ('cash', 'upi', 'card') then raise exception 'Choose how it was paid.'; end if;

  -- Lock her udhaar entries so two phones can't collect the same rupees.
  perform 1 from public.visits
    where client_phone = p_phone and paid_udhaar > 0 and not voided for update;
  select coalesce(sum(outstanding), 0) into v_owed from public.udhaar_for_phone(p_phone);
  if v_owed = 0 then raise exception 'There is no udhaar for this number.'; end if;
  if p_amount > v_owed then raise exception 'Only % is still owed.', v_owed; end if;

  for r in select * from public.udhaar_for_phone(p_phone) loop
    exit when v_left = 0;
    v_take := least(v_left, r.outstanding);
    insert into public.udhaar_collections (visit_id, amount, mode, collected_by)
    values (r.visit_id, v_take, p_mode, auth.uid());
    v_left := v_left - v_take;
  end loop;
  return p_amount;
end $$;

-- ============================================================
-- The counter card: staff no longer see her next booking.
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
      'next_booking', case when public.is_owner() then
                        (select jsonb_build_object('id', id, 'day', day, 'time', start_time, 'services', services_text)
                         from public.appointments where client_phone = p_phone and status = 'booked' and day >= public.today_ist()
                         order by day, start_time limit 1) end
    )
    from (select 1) one left join public.clients c on c.phone = p_phone
  ) end
$$;

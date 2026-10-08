-- Triggers, views and the functions the app calls for multi-step writes.

-- ============================================================
-- Change history
-- ============================================================
create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  rid text;
begin
  rid := coalesce(
    (case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'id',
    (case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'enrollment_id',
    (case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'day'
  );
  insert into public.audit_log (table_name, row_id, action, old_data, new_data)
  values (
    tg_table_name, rid, lower(tg_op),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'payments', 'installments', 'enrollment_fees', 'enrollments', 'students',
    'visits', 'day_closings', 'attendance', 'services', 'courses', 'profiles'
  ] loop
    execute format(
      'create trigger audit_%1$s after insert or update or delete on public.%1$I
       for each row execute function public.audit_row()', t);
  end loop;
end $$;

-- ============================================================
-- Receipt numbers: NGM/26-27/0001, restarting every financial year (April).
-- ============================================================
create or replace function public.assign_receipt_no() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_fy text;
  n integer;
begin
  if new.receipt_no is null then
    v_fy := to_char(new.paid_on - interval '3 months', 'YY') || '-' || to_char(new.paid_on + interval '9 months', 'YY');
    insert into public.receipt_counters as rc (fy, last_no) values (v_fy, 1)
      on conflict (fy) do update set last_no = rc.last_no + 1
      returning last_no into n;
    new.receipt_no := 'NGM/' || v_fy || '/' || lpad(n::text, 4, '0');
  end if;
  return new;
end $$;

create trigger payments_receipt_no before insert on public.payments
  for each row execute function public.assign_receipt_no();

-- Voiding stamps who and when; a payment's amount and date can't be edited afterwards.
create or replace function public.guard_payment_update() returns trigger
language plpgsql as $$
begin
  if old.voided then
    raise exception 'This payment is already cancelled.';
  end if;
  if new.amount <> old.amount or new.enrollment_id <> old.enrollment_id
     or new.receipt_no is distinct from old.receipt_no then
    raise exception 'Amounts and receipts can''t be edited. Cancel the payment and record it again.';
  end if;
  if new.voided then
    new.voided_at := now();
    new.voided_by := auth.uid();
  end if;
  return new;
end $$;

create trigger payments_guard before update on public.payments
  for each row execute function public.guard_payment_update();

-- ============================================================
-- Fee status views (respect the caller's RLS, so only the owner gets rows).
-- Payments are applied to installments oldest-first; matches src/lib/money.ts.
-- ============================================================
create view public.installment_status with (security_invoker = true) as
with paid as (
  select enrollment_id, sum(amount)::int as total_paid
  from public.payments where not voided group by enrollment_id
), ordered as (
  select i.*, coalesce(p.total_paid, 0) as total_paid,
    coalesce(sum(i.amount) over (
      partition by i.enrollment_id order by i.due_date, i.id
      rows between unbounded preceding and 1 preceding), 0) as before_amt
  from public.installments i
  left join paid p on p.enrollment_id = i.enrollment_id
)
select id, enrollment_id, due_date, amount, label,
  greatest(0, least(amount, total_paid - before_amt))::int as paid,
  (amount - greatest(0, least(amount, total_paid - before_amt)))::int as remaining
from ordered;

create view public.enrollment_fee_status with (security_invoker = true) as
select
  e.id as enrollment_id, e.student_id, e.course_id, e.status as enrollment_status,
  f.agreed_fee,
  coalesce(p.total_paid, 0)::int as paid,
  greatest(0, f.agreed_fee - coalesce(p.total_paid, 0))::int as balance,
  coalesce(o.overdue_amount, 0)::int as overdue_amount,
  o.oldest_overdue_date,
  n.next_due_date, n.next_due_amount,
  p.last_paid_on
from public.enrollments e
join public.enrollment_fees f on f.enrollment_id = e.id
left join (
  select enrollment_id, sum(amount)::int as total_paid, max(paid_on) as last_paid_on
  from public.payments where not voided group by enrollment_id
) p on p.enrollment_id = e.id
left join (
  select enrollment_id, sum(remaining)::int as overdue_amount, min(due_date) as oldest_overdue_date
  from public.installment_status where remaining > 0 and due_date < public.today_ist()
  group by enrollment_id
) o on o.enrollment_id = e.id
left join lateral (
  select s.due_date as next_due_date, s.remaining as next_due_amount
  from public.installment_status s
  where s.enrollment_id = e.id and s.remaining > 0 and s.due_date >= public.today_ist()
  order by s.due_date limit 1
) n on true;

grant select on public.installment_status, public.enrollment_fee_status to authenticated;

-- ============================================================
-- Salon
-- ============================================================

-- One client visit with one or more services. Staff can only log for today;
-- the owner can log for any date. Prices and names are copied from the
-- catalog at the moment of logging.
-- p: { client_name, client_phone, note, visit_date?, paid_cash, paid_upi, paid_card,
--      lines: [{ service_id, price, staff_id }] }
create or replace function public.log_visit(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_date date := coalesce((p ->> 'visit_date')::date, public.today_ist());
  v_total integer;
  v_cash integer := coalesce((p ->> 'paid_cash')::int, 0);
  v_upi integer := coalesce((p ->> 'paid_upi')::int, 0);
  v_card integer := coalesce((p ->> 'paid_card')::int, 0);
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

  select coalesce(sum((x ->> 'price')::int), 0) into v_total from jsonb_array_elements(p -> 'lines') x;
  if v_cash + v_upi + v_card <> v_total then
    raise exception 'Payment (%) does not match the total (%).', v_cash + v_upi + v_card, v_total;
  end if;

  insert into public.visits (visit_date, client_name, client_phone, total, paid_cash, paid_upi, paid_card, note, created_by)
  values (v_date, nullif(trim(p ->> 'client_name'), ''), nullif(trim(p ->> 'client_phone'), ''),
          v_total, v_cash, v_upi, v_card, nullif(trim(p ->> 'note'), ''), auth.uid())
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

  return v_id;
end $$;

-- Cancel an entry. Staff: only their own, within 15 minutes. Owner: any time.
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
  update public.visits
     set voided = true, void_reason = coalesce(nullif(trim(p_reason), ''), 'Cancelled'),
         voided_at = now(), voided_by = auth.uid()
   where id = p_id;
end $$;

-- Close the day: compares cash counted with the cash logged for salon visits.
create or replace function public.close_day(p_day date, p_counted_cash integer, p_upi_checked boolean, p_note text)
returns public.day_closings
language plpgsql security definer set search_path = public as $$
declare
  r public.day_closings;
  v_cash integer;
  v_upi integer;
begin
  if not public.is_owner() then raise exception 'Not allowed.'; end if;
  select coalesce(sum(paid_cash), 0), coalesce(sum(paid_upi), 0) into v_cash, v_upi
    from public.visits where visit_date = p_day and not voided;
  insert into public.day_closings (day, expected_cash, counted_cash, upi_expected, upi_checked, note, closed_by, closed_at)
  values (p_day, v_cash, p_counted_cash, v_upi, p_upi_checked, nullif(trim(p_note), ''), auth.uid(), now())
  on conflict (day) do update set
    expected_cash = excluded.expected_cash, counted_cash = excluded.counted_cash,
    upi_expected = excluded.upi_expected, upi_checked = excluded.upi_checked,
    note = excluded.note, closed_by = excluded.closed_by, closed_at = excluded.closed_at
  returning * into r;
  return r;
end $$;

-- Staff can't browse past visits, but typing a known client's phone fills in her name.
create or replace function public.client_name_for_phone(p_phone text) returns text
language sql stable security definer set search_path = public as $$
  select client_name from public.visits
  where (public.is_owner() or public.is_staff())
    and client_phone = p_phone and client_name is not null and not voided
  order by created_at desc limit 1
$$;

-- The services logged most in the last 60 days, for the quick-pick tiles.
create or replace function public.frequent_services(p_limit integer default 8)
returns table (service_id uuid, uses bigint)
language sql stable security definer set search_path = public as $$
  select l.service_id, count(*) as uses
  from public.visit_lines l
  join public.visits v on v.id = l.visit_id
  join public.services s on s.id = l.service_id and s.active
  where public.is_member() and not v.voided and v.visit_date >= public.today_ist() - 60
  group by l.service_id
  order by uses desc
  limit p_limit
$$;

-- ============================================================
-- Academy
-- ============================================================

-- New admission in one step: student (or an existing student taking another
-- course), enrollment, fee plan, and optionally the first payment.
-- Runs with the caller's rights, so only the owner can use it.
create or replace function public.create_admission(p jsonb) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  v_student uuid := (p ->> 'existing_student_id')::uuid;
  v_enr uuid;
  v_pay uuid;
  v_receipt text;
  v_agreed integer := (p -> 'fees' ->> 'agreed_fee')::int;
  v_plan_total integer;
  st jsonb := p -> 'student';
  d jsonb := p -> 'details';
  e jsonb := p -> 'enrollment';
  fp jsonb := p -> 'first_payment';
begin
  if not public.is_owner() then raise exception 'Not allowed.'; end if;

  select coalesce(sum((x ->> 'amount')::int), 0) into v_plan_total
    from jsonb_array_elements(coalesce(p -> 'installments', '[]'::jsonb)) x;
  if v_plan_total <> v_agreed then
    raise exception 'The installments (%) must add up to the agreed fee (%).', v_plan_total, v_agreed;
  end if;

  if v_student is null then
    insert into public.students (full_name, phone, whatsapp, joined_on, source, notes)
    values (trim(st ->> 'full_name'), nullif(st ->> 'phone', ''), nullif(st ->> 'whatsapp', ''),
            coalesce((st ->> 'joined_on')::date, public.today_ist()),
            nullif(st ->> 'source', ''), nullif(trim(st ->> 'notes'), ''))
    returning id into v_student;

    if d is not null and d <> 'null'::jsonb then
      insert into public.student_details (student_id, dob, address, guardian_name, guardian_phone, id_type, id_last4, emergency_contact)
      values (v_student, nullif(d ->> 'dob', '')::date, nullif(trim(d ->> 'address'), ''),
              nullif(trim(d ->> 'guardian_name'), ''), nullif(d ->> 'guardian_phone', ''),
              nullif(d ->> 'id_type', ''), nullif(d ->> 'id_last4', ''), nullif(trim(d ->> 'emergency_contact'), ''));
    end if;
  else
    update public.students set status = 'active' where id = v_student and status <> 'active';
  end if;

  insert into public.enrollments (student_id, course_id, start_date, expected_end_date, trainer_ids, slot_id, days_of_week, notes)
  values (v_student, (e ->> 'course_id')::uuid, (e ->> 'start_date')::date, (e ->> 'expected_end_date')::date,
          coalesce(array(select jsonb_array_elements_text(e -> 'trainer_ids'))::uuid[], '{}'),
          nullif(e ->> 'slot_id', '')::uuid,
          case when jsonb_typeof(e -> 'days_of_week') = 'array' and jsonb_array_length(e -> 'days_of_week') > 0
               then array(select jsonb_array_elements_text(e -> 'days_of_week'))::smallint[]
               else '{1,2,3,4,5,6}'::smallint[] end,
          nullif(trim(e ->> 'notes'), ''))
  returning id into v_enr;

  insert into public.enrollment_fees (enrollment_id, list_fee, agreed_fee, discount_note, kit_included)
  values (v_enr, (p -> 'fees' ->> 'list_fee')::int, v_agreed,
          nullif(trim(p -> 'fees' ->> 'discount_note'), ''), coalesce((p -> 'fees' ->> 'kit_included')::boolean, false));

  insert into public.installments (enrollment_id, due_date, amount, label)
  select v_enr, (x ->> 'due_date')::date, (x ->> 'amount')::int, nullif(x ->> 'label', '')
    from jsonb_array_elements(coalesce(p -> 'installments', '[]'::jsonb)) x;

  if fp is not null and fp <> 'null'::jsonb and coalesce((fp ->> 'amount')::int, 0) > 0 then
    insert into public.payments (enrollment_id, amount, paid_on, mode, note)
    values (v_enr, (fp ->> 'amount')::int, coalesce((fp ->> 'paid_on')::date, public.today_ist()),
            fp ->> 'mode', nullif(trim(fp ->> 'note'), ''))
    returning id, receipt_no into v_pay, v_receipt;
  end if;

  return jsonb_build_object('student_id', v_student, 'enrollment_id', v_enr,
                            'payment_id', v_pay, 'receipt_no', v_receipt);
end $$;

-- Replace an enrollment's fee plan (agreed fee + installments) in one go.
create or replace function public.update_fee_plan(p_enrollment uuid, p_agreed_fee integer, p_discount_note text, p_installments jsonb)
returns void
language plpgsql security invoker set search_path = public as $$
declare v_total integer;
begin
  if not public.is_owner() then raise exception 'Not allowed.'; end if;
  select coalesce(sum((x ->> 'amount')::int), 0) into v_total from jsonb_array_elements(p_installments) x;
  if v_total <> p_agreed_fee then
    raise exception 'The installments (%) must add up to the agreed fee (%).', v_total, p_agreed_fee;
  end if;
  update public.enrollment_fees set agreed_fee = p_agreed_fee, discount_note = nullif(trim(p_discount_note), '')
   where enrollment_id = p_enrollment;
  delete from public.installments where enrollment_id = p_enrollment;
  insert into public.installments (enrollment_id, due_date, amount, label)
  select p_enrollment, (x ->> 'due_date')::date, (x ->> 'amount')::int, nullif(x ->> 'label', '')
    from jsonb_array_elements(p_installments) x;
end $$;

-- ============================================================
-- Me
-- ============================================================
create or replace function public.set_my_language(p_lang text) returns void
language sql security definer set search_path = public as $$
  update public.profiles set language = p_lang where id = auth.uid() and p_lang in ('en', 'hi')
$$;

-- Functions are callable by PUBLIC by default; this app has no public side.
revoke execute on all functions in schema public from anon, public;

grant execute on function
  public.log_visit(jsonb), public.void_visit(uuid, text),
  public.close_day(date, integer, boolean, text),
  public.client_name_for_phone(text), public.frequent_services(integer),
  public.create_admission(jsonb), public.update_fee_plan(uuid, integer, text, jsonb),
  public.set_my_language(text)
  to authenticated;

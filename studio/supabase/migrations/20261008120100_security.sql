-- Who can see and change what. This is an internal app: nothing is public,
-- and every rule starts from "is this an active account Mom created?".

-- ============================================================
-- Role helpers. SECURITY DEFINER so policies can call them without
-- re-entering profiles' own RLS.
-- ============================================================
create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active)
$$;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active and is_owner)
$$;

create or replace function public.is_trainer() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active and is_trainer)
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active and is_staff)
$$;

-- Trainer of this enrollment (and still an active trainer).
create or replace function public.trains(p_enrollment uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_trainer() and exists (
    select 1 from public.enrollments e where e.id = p_enrollment and auth.uid() = any (e.trainer_ids)
  )
$$;

create or replace function public.trains_student(p_student uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_trainer() and exists (
    select 1 from public.enrollments e where e.student_id = p_student and auth.uid() = any (e.trainer_ids)
  )
$$;

-- ============================================================
-- Nothing for anonymous visitors. Signed-in users go through RLS below.
-- ============================================================
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon, public;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon, public;

grant execute on function public.today_ist(), public.is_member(), public.is_owner(),
  public.is_trainer(), public.is_staff(), public.trains(uuid), public.trains_student(uuid)
  to authenticated;

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.course_modules enable row level security;
alter table public.service_categories enable row level security;
alter table public.services enable row level security;
alter table public.settings enable row level security;
alter table public.time_slots enable row level security;
alter table public.holidays enable row level security;
alter table public.students enable row level security;
alter table public.student_details enable row level security;
alter table public.enrollments enable row level security;
alter table public.enrollment_fees enable row level security;
alter table public.installments enable row level security;
alter table public.payments enable row level security;
alter table public.receipt_counters enable row level security;
alter table public.attendance enable row level security;
alter table public.module_progress enable row level security;
alter table public.visits enable row level security;
alter table public.visit_lines enable row level security;
alter table public.day_closings enable row level security;
alter table public.audit_log enable row level security;

-- ---------- profiles: everyone on the team sees names (for "Done by");
-- only the owner changes them (accounts are created by the manage-staff function).
create policy profiles_read on public.profiles for select to authenticated using (public.is_member());
create policy profiles_owner_update on public.profiles for update to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- ---------- catalog and settings: the whole team reads, the owner edits.
create policy courses_read on public.courses for select to authenticated using (public.is_member());
create policy courses_write on public.courses for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy modules_read on public.course_modules for select to authenticated using (public.is_member());
create policy modules_write on public.course_modules for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy categories_read on public.service_categories for select to authenticated using (public.is_member());
create policy categories_write on public.service_categories for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy services_read on public.services for select to authenticated using (public.is_member());
create policy services_write on public.services for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy settings_read on public.settings for select to authenticated using (public.is_member());
create policy settings_write on public.settings for update to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy slots_read on public.time_slots for select to authenticated using (public.is_member());
create policy slots_write on public.time_slots for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy holidays_read on public.holidays for select to authenticated using (public.is_member());
create policy holidays_write on public.holidays for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- ---------- students: owner all; trainers read only their own students.
create policy students_read on public.students for select to authenticated
  using (public.is_owner() or public.trains_student(id));
create policy students_write on public.students for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy details_owner on public.student_details for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy enrollments_read on public.enrollments for select to authenticated
  using (public.is_owner() or (public.is_trainer() and auth.uid() = any (trainer_ids)));
create policy enrollments_write on public.enrollments for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- ---------- fees and payments: owner only. Payments can never be deleted
-- (no delete policy for anyone); mistakes are voided with a reason.
create policy fees_owner on public.enrollment_fees for all to authenticated
  using (public.is_owner()) with check (public.is_owner());
create policy installments_owner on public.installments for all to authenticated
  using (public.is_owner()) with check (public.is_owner());
create policy payments_read on public.payments for select to authenticated using (public.is_owner());
create policy payments_insert on public.payments for insert to authenticated with check (public.is_owner());
create policy payments_update on public.payments for update to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- ---------- attendance and progress: owner, or the student's trainer.
create policy attendance_rw on public.attendance for all to authenticated
  using (public.is_owner() or public.trains(enrollment_id))
  with check (public.is_owner() or public.trains(enrollment_id));

create policy progress_rw on public.module_progress for all to authenticated
  using (public.is_owner() or public.trains(enrollment_id))
  with check (public.is_owner() or public.trains(enrollment_id));

-- ---------- salon: owner sees everything; staff see only what they logged today.
-- All writes go through log_visit / void_visit / close_day (functions file).
create policy visits_read on public.visits for select to authenticated
  using (public.is_owner() or (public.is_staff() and created_by = auth.uid() and visit_date = public.today_ist()));

create policy visit_lines_read on public.visit_lines for select to authenticated
  using (public.is_owner() or exists (
    select 1 from public.visits v
    where v.id = visit_id and v.created_by = auth.uid() and v.visit_date = public.today_ist()
  ));

create policy closings_owner on public.day_closings for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- ---------- history: owner reads; only triggers write.
create policy audit_owner_read on public.audit_log for select to authenticated using (public.is_owner());

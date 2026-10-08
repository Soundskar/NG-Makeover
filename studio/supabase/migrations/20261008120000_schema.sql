-- NG Studio schema.
-- Money is whole rupees (integer). Business dates are India calendar days (date).


create or replace function public.today_ist() returns date
language sql stable as $$
  select (now() at time zone 'Asia/Kolkata')::date
$$;

-- ============================================================
-- People
-- ============================================================
-- One row per login. Accounts are created only by the owner through the
-- manage-staff function; an auth user without an active profile can see nothing.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (length(trim(display_name)) > 0),
  username text not null unique check (username ~ '^[a-z0-9]{3,20}$'),
  phone text,
  is_owner boolean not null default false,
  is_trainer boolean not null default false,
  is_staff boolean not null default false,
  language text not null default 'en' check (language in ('en', 'hi')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Catalog
-- ============================================================
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  name_en text not null,
  name_hi text,
  duration_months numeric(4, 1) not null check (duration_months > 0),
  list_fee integer not null check (list_fee >= 0),
  is_combo boolean not null default false,
  -- For the combo: the single courses it contains (their modules make up its syllabus).
  included_course_ids uuid[] not null default '{}',
  active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title_en text not null,
  title_hi text,
  topics text,
  sort integer not null default 0
);
create index on public.course_modules (course_id, sort);

create table public.service_categories (
  id uuid primary key default gen_random_uuid(),
  name_en text not null,
  name_hi text,
  active boolean not null default true,
  sort integer not null default 0
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.service_categories (id),
  name_en text not null,
  name_hi text,
  price integer not null check (price >= 0),
  -- Ranged items ('₹450–1,150'): staff type the actual amount within this range.
  price_min integer check (price_min >= 0),
  price_max integer check (price_max >= 0),
  -- 'From ₹550' items: the price can go higher; staff can type any amount.
  is_variable boolean not null default false,
  active boolean not null default true,
  sort integer not null default 0,
  check (price_min is null or price_max is null or price_min <= price_max)
);
create index on public.services (category_id, sort);

-- ============================================================
-- Settings
-- ============================================================
create table public.settings (
  id boolean primary key default true check (id),
  studio_name text not null default 'Namita Garg Makeover',
  studio_phone text,
  weekly_off smallint check (weekly_off between 0 and 6),
  last_backup_at timestamptz
);
insert into public.settings (id) values (true);

create table public.time_slots (
  id uuid primary key default gen_random_uuid(),
  start_time time not null,
  end_time time not null check (end_time > start_time),
  seats integer not null default 6 check (seats > 0),
  active boolean not null default true
);

create table public.holidays (
  day date primary key,
  name text not null
);

-- ============================================================
-- Academy
-- ============================================================
create table public.students (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(trim(full_name)) > 0),
  phone text,
  whatsapp text,
  photo_url text,
  joined_on date not null default public.today_ist(),
  status text not null default 'active' check (status in ('active', 'completed', 'left')),
  source text,
  notes text,
  created_by uuid default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);
create index on public.students (status);

-- Owner-only personal details, kept apart so trainers never receive them.
create table public.student_details (
  student_id uuid primary key references public.students (id) on delete cascade,
  dob date,
  address text,
  guardian_name text,
  guardian_phone text,
  id_type text,
  -- Only the last 4 digits of an ID. Never store full ID numbers or scans.
  id_last4 text check (id_last4 ~ '^[0-9A-Za-z]{4}$'),
  emergency_contact text
);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  course_id uuid not null references public.courses (id),
  start_date date not null default public.today_ist(),
  expected_end_date date not null,
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'left')),
  completed_on date,
  trainer_ids uuid[] not null default '{}',
  slot_id uuid references public.time_slots (id),
  -- 0 = Sunday … 6 = Saturday
  days_of_week smallint[] not null default '{1,2,3,4,5,6}',
  notes text,
  created_at timestamptz not null default now(),
  check (expected_end_date >= start_date)
);
create index on public.enrollments (student_id);
create index on public.enrollments (status);
create index on public.enrollments using gin (trainer_ids);

-- Owner-only money side of an enrollment.
create table public.enrollment_fees (
  enrollment_id uuid primary key references public.enrollments (id) on delete cascade,
  list_fee integer not null check (list_fee >= 0),
  agreed_fee integer not null check (agreed_fee >= 0),
  discount_note text,
  kit_included boolean not null default false
);

create table public.installments (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,
  due_date date not null,
  amount integer not null check (amount > 0),
  label text
);
create index on public.installments (enrollment_id, due_date);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments (id) on delete restrict,
  amount integer not null check (amount > 0),
  paid_on date not null default public.today_ist(),
  mode text not null check (mode in ('cash', 'upi', 'card', 'bank')),
  received_by uuid default auth.uid() references public.profiles (id),
  receipt_no text unique,
  note text,
  voided boolean not null default false,
  void_reason text,
  voided_at timestamptz,
  voided_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  check (not voided or void_reason is not null)
);
create index on public.payments (enrollment_id);
create index on public.payments (paid_on);

create table public.receipt_counters (
  fy text primary key,
  last_no integer not null default 0
);

create table public.attendance (
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,
  day date not null,
  status text not null check (status in ('present', 'absent', 'leave')),
  -- Came on a day that isn't one of their usual days.
  extra boolean not null default false,
  marked_by uuid default auth.uid() references public.profiles (id),
  marked_at timestamptz not null default now(),
  primary key (enrollment_id, day)
);
create index on public.attendance (day);

-- No row = not started.
create table public.module_progress (
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,
  module_id uuid not null references public.course_modules (id) on delete cascade,
  status text not null check (status in ('learning', 'done')),
  rating smallint check (rating between 1 and 5),
  note text,
  updated_by uuid default auth.uid() references public.profiles (id),
  updated_at timestamptz not null default now(),
  primary key (enrollment_id, module_id)
);

-- ============================================================
-- Salon
-- ============================================================
create table public.visits (
  id uuid primary key default gen_random_uuid(),
  visit_date date not null default public.today_ist(),
  client_name text,
  client_phone text,
  total integer not null check (total >= 0),
  paid_cash integer not null default 0 check (paid_cash >= 0),
  paid_upi integer not null default 0 check (paid_upi >= 0),
  paid_card integer not null default 0 check (paid_card >= 0),
  note text,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  voided boolean not null default false,
  void_reason text,
  voided_at timestamptz,
  voided_by uuid references public.profiles (id),
  check (paid_cash + paid_upi + paid_card = total),
  check (not voided or void_reason is not null)
);
create index on public.visits (visit_date);
create index on public.visits (created_by, visit_date);
create index on public.visits (client_phone);

create table public.visit_lines (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.visits (id) on delete cascade,
  service_id uuid references public.services (id),
  -- Copied at the time of logging so later price changes don't rewrite history.
  service_name text not null,
  list_price integer not null,
  price integer not null check (price >= 0),
  staff_id uuid not null references public.profiles (id),
  sort smallint not null default 0
);
create index on public.visit_lines (visit_id);
create index on public.visit_lines (staff_id);

create table public.day_closings (
  day date primary key,
  expected_cash integer not null,
  counted_cash integer not null check (counted_cash >= 0),
  upi_expected integer not null,
  upi_checked boolean not null default false,
  note text,
  closed_by uuid default auth.uid() references public.profiles (id),
  closed_at timestamptz not null default now()
);

-- ============================================================
-- Change history
-- ============================================================
create table public.audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  row_id text,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  actor uuid default auth.uid(),
  at timestamptz not null default now()
);
create index on public.audit_log (table_name, row_id);
create index on public.audit_log (at);

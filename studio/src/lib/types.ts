// Row shapes as they come back from Supabase. Dates are 'YYYY-MM-DD',
// timestamps are ISO strings, money is whole rupees.

export type Lang = 'en' | 'hi';
export type PayMode = 'cash' | 'upi' | 'card' | 'bank';

export interface Profile {
  id: string;
  display_name: string;
  username: string;
  phone: string | null;
  is_owner: boolean;
  is_trainer: boolean;
  is_staff: boolean;
  language: Lang;
  active: boolean;
  created_at: string;
}

export interface Named {
  name_en: string;
  name_hi: string | null;
}

export interface Course extends Named {
  id: string;
  code: string | null;
  duration_months: number;
  list_fee: number;
  is_combo: boolean;
  included_course_ids: string[];
  active: boolean;
  sort: number;
}

export interface CourseModule {
  id: string;
  course_id: string;
  title_en: string;
  title_hi: string | null;
  topics: string | null;
  sort: number;
}

export interface ServiceCategory extends Named {
  id: string;
  active: boolean;
  sort: number;
}

export interface Service extends Named {
  id: string;
  category_id: string;
  price: number;
  price_min: number | null;
  price_max: number | null;
  is_variable: boolean;
  active: boolean;
  sort: number;
}

export interface Settings {
  studio_name: string;
  studio_phone: string | null;
  weekly_off: number | null;
  last_backup_at: string | null;
}

export interface TimeSlot {
  id: string;
  start_time: string;
  end_time: string;
  seats: number;
  active: boolean;
}

export interface Holiday {
  day: string;
  name: string;
}

export type StudentStatus = 'active' | 'completed' | 'left';

export interface Student {
  id: string;
  full_name: string;
  phone: string | null;
  whatsapp: string | null;
  photo_url: string | null;
  joined_on: string;
  status: StudentStatus;
  source: string | null;
  notes: string | null;
  created_at: string;
}

export interface StudentDetails {
  student_id: string;
  dob: string | null;
  address: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  id_type: string | null;
  id_last4: string | null;
  emergency_contact: string | null;
}

export type EnrollmentStatus = 'active' | 'paused' | 'completed' | 'left';

export interface Enrollment {
  id: string;
  student_id: string;
  course_id: string;
  start_date: string;
  expected_end_date: string;
  status: EnrollmentStatus;
  completed_on: string | null;
  trainer_ids: string[];
  slot_id: string | null;
  days_of_week: number[];
  notes: string | null;
  created_at: string;
}

export interface EnrollmentFees {
  enrollment_id: string;
  list_fee: number;
  agreed_fee: number;
  discount_note: string | null;
  kit_included: boolean;
}

export interface InstallmentRow {
  id: string;
  enrollment_id: string;
  due_date: string;
  amount: number;
  label: string | null;
}

export interface Payment {
  id: string;
  enrollment_id: string;
  amount: number;
  paid_on: string;
  mode: PayMode;
  received_by: string | null;
  receipt_no: string | null;
  note: string | null;
  voided: boolean;
  void_reason: string | null;
  created_at: string;
}

export type AttendanceStatus = 'present' | 'absent' | 'leave';

export interface Attendance {
  enrollment_id: string;
  day: string;
  status: AttendanceStatus;
  extra: boolean;
  marked_by: string | null;
  marked_at: string;
}

export interface ModuleProgress {
  enrollment_id: string;
  module_id: string;
  status: 'learning' | 'done';
  rating: number | null;
  note: string | null;
  updated_at: string;
}

export interface Visit {
  id: string;
  visit_date: string;
  client_name: string | null;
  client_phone: string | null;
  total: number;
  paid_cash: number;
  paid_upi: number;
  paid_card: number;
  note: string | null;
  created_by: string;
  created_at: string;
  voided: boolean;
  void_reason: string | null;
}

export interface VisitLine {
  id: string;
  visit_id: string;
  service_id: string | null;
  service_name: string;
  list_price: number;
  price: number;
  staff_id: string;
  sort: number;
}

export interface VisitWithLines extends Visit {
  visit_lines: VisitLine[];
}

export interface DayClosing {
  day: string;
  expected_cash: number;
  counted_cash: number;
  upi_expected: number;
  upi_checked: boolean;
  note: string | null;
  closed_by: string | null;
  closed_at: string;
}

export interface FeeStatus {
  enrollment_id: string;
  student_id: string;
  course_id: string;
  enrollment_status: EnrollmentStatus;
  agreed_fee: number;
  paid: number;
  balance: number;
  overdue_amount: number;
  oldest_overdue_date: string | null;
  next_due_date: string | null;
  next_due_amount: number | null;
  last_paid_on: string | null;
}

export function nameOf(x: Named, lang: Lang): string {
  return lang === 'hi' && x.name_hi ? x.name_hi : x.name_en;
}

export function titleOf(m: Pick<CourseModule, 'title_en' | 'title_hi'>, lang: Lang): string {
  return lang === 'hi' && m.title_hi ? m.title_hi : m.title_en;
}

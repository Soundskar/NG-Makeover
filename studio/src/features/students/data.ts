import { useQuery } from '@tanstack/react-query';
import { must, supabase } from '../../lib/supabase';
import type {
  Attendance, Course, CourseModule, Enrollment, EnrollmentFees, FeeStatus, Holiday, InstallmentRow,
  ModuleProgress, Payment, Settings, Student, StudentDetails, TimeSlot,
} from '../../lib/types';

export function useCourses() {
  return useQuery({
    queryKey: ['courses'],
    queryFn: async () => {
      const [c, m] = await Promise.all([
        supabase.from('courses').select('*').order('sort'),
        supabase.from('course_modules').select('*').order('sort'),
      ]);
      return { courses: must(c) as Course[], modules: must(m) as CourseModule[] };
    },
    staleTime: 10 * 60_000,
  });
}

/** Modules a course teaches. The combo teaches all of its courses' modules. */
export function modulesFor(course: Course, courses: Course[], modules: CourseModule[]): { course: Course; modules: CourseModule[] }[] {
  const parts = course.is_combo
    ? course.included_course_ids.map((id) => courses.find((c) => c.id === id)).filter(Boolean) as Course[]
    : [course];
  return parts.map((c) => ({ course: c, modules: modules.filter((m) => m.course_id === c.id) }));
}

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const [s, slots, hol] = await Promise.all([
        supabase.from('settings').select('*').single(),
        supabase.from('time_slots').select('*').order('start_time'),
        supabase.from('holidays').select('*').order('day'),
      ]);
      return { settings: must(s) as Settings, slots: must(slots) as TimeSlot[], holidays: must(hol) as Holiday[] };
    },
    staleTime: 10 * 60_000,
  });
}

export interface StudentRow extends Student {
  enrollments: Enrollment[];
}

/** Everyone the signed-in person may see (trainers: only their own students). */
export function useStudents() {
  return useQuery({
    queryKey: ['students'],
    queryFn: async () =>
      must(await supabase.from('students').select('*, enrollments(*)').order('full_name')) as StudentRow[],
  });
}

/** Fee status of every enrollment (owner only; returns nothing for others). */
export function useFeeStatus(enabled: boolean) {
  return useQuery({
    queryKey: ['fee-status'],
    enabled,
    queryFn: async () => must(await supabase.from('enrollment_fee_status').select('*')) as FeeStatus[],
  });
}

export interface StudentFull {
  student: Student;
  details: StudentDetails | null;
  enrollments: Enrollment[];
  fees: EnrollmentFees[];
  installments: InstallmentRow[];
  payments: Payment[];
  attendance: Attendance[];
  progress: ModuleProgress[];
}

export function useStudent(id: string, owner: boolean) {
  return useQuery({
    queryKey: ['student', id],
    queryFn: async (): Promise<StudentFull> => {
      const student = must(await supabase.from('students').select('*').eq('id', id).single()) as Student;
      const enrollments = must(await supabase.from('enrollments').select('*').eq('student_id', id)
        .order('start_date', { ascending: false })) as Enrollment[];
      const eids = enrollments.map((e) => e.id);
      const none = { data: [], error: null };
      const [details, fees, inst, pays, att, prog] = await Promise.all([
        owner ? supabase.from('student_details').select('*').eq('student_id', id).maybeSingle() : { data: null, error: null },
        owner ? supabase.from('enrollment_fees').select('*').in('enrollment_id', eids) : none,
        owner ? supabase.from('installments').select('*').in('enrollment_id', eids).order('due_date') : none,
        owner ? supabase.from('payments').select('*').in('enrollment_id', eids).order('created_at', { ascending: false }) : none,
        supabase.from('attendance').select('*').in('enrollment_id', eids).order('day', { ascending: false }),
        supabase.from('module_progress').select('*').in('enrollment_id', eids),
      ]);
      return {
        student,
        details: must(details) as StudentDetails | null,
        enrollments,
        fees: must(fees) as EnrollmentFees[],
        installments: must(inst) as InstallmentRow[],
        payments: must(pays) as Payment[],
        attendance: must(att) as Attendance[],
        progress: must(prog) as ModuleProgress[],
      };
    },
  });
}

/** Active enrollments of everyone (for seat counts and today's classes). */
export function useActiveEnrollments() {
  return useQuery({
    queryKey: ['active-enrollments'],
    queryFn: async () =>
      must(await supabase.from('enrollments').select('*, students(full_name, phone, whatsapp)').eq('status', 'active')) as
        (Enrollment & { students: Pick<Student, 'full_name' | 'phone' | 'whatsapp'> })[],
  });
}

export const SOURCES = ['instagram', 'referral', 'walkin', 'website', 'other'] as const;
export type Source = typeof SOURCES[number];

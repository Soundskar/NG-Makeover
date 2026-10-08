// Runs every migration on a throwaway in-memory Postgres (PGlite) with a
// minimal stand-in for Supabase's auth schema and roles, then checks what each
// kind of user can and can't do. No Supabase project or network needed.

import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { summarizeFees } from '../../src/lib/money';

const MIGRATIONS = join(import.meta.dirname, '..', 'migrations');

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema public, auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated;
  -- Like a project created with "Automatically expose new tables" switched off:
  -- no default table rights for the API roles, so the migrations must grant
  -- everything the app needs themselves.
  alter default privileges in schema public revoke execute on functions from public;
`;

const U = {
  owner: '00000000-0000-0000-0000-00000000000a',
  trainer: '00000000-0000-0000-0000-00000000000b',
  trainer2: '00000000-0000-0000-0000-00000000000c',
  staff: '00000000-0000-0000-0000-00000000000d',
  staff2: '00000000-0000-0000-0000-00000000000e',
  gone: '00000000-0000-0000-0000-00000000000f', // deactivated staff
  outsider: '00000000-0000-0000-0000-000000000010', // signed up, no profile
} as const;
type Who = keyof typeof U | 'anon';

let db: PGlite;

/** Runs SQL as a given user, the way a request through Supabase's API would. */
async function as<T = Record<string, unknown>>(who: Who, sql: string, params: unknown[] = []): Promise<T[]> {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [who === 'anon' ? '' : U[who]]);
  await db.exec(`set role ${who === 'anon' ? 'anon' : 'authenticated'}`);
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec('reset role');
  }
}

async function su<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows;
}

const today = async () => (await su<{ d: string }>(`select today_ist()::text as d`))[0]!.d;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const f of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS, f), 'utf8'));
  }
  for (const [name, id] of Object.entries(U)) {
    await su(`insert into auth.users (id, email) values ($1, $2)`, [id, `${name}@ngstudio.invalid`]);
  }
  await su(`
    insert into profiles (id, display_name, username, is_owner, is_trainer, is_staff, active) values
      ('${U.owner}',    'Namita',  'namita',   true,  true,  false, true),
      ('${U.trainer}',  'Trainer', 'trainer',  false, true,  false, true),
      ('${U.trainer2}', 'Other',   'trainer2', false, true,  false, true),
      ('${U.staff}',    'Pooja',   'pooja',    false, false, true,  true),
      ('${U.staff2}',   'Rina',    'rina',     false, false, true,  true),
      ('${U.gone}',     'Left',    'leftjob',  false, false, true,  false)
  `);
}, 60_000);

const serviceId = async (name: string) =>
  (await su<{ id: string }>(`select id from services where name_en = $1`, [name]))[0]!.id;

const courseId = async (code: string) =>
  (await su<{ id: string }>(`select id from courses where code = $1`, [code]))[0]!.id;

describe('catalog seed', () => {
  it('has the website courses and price list', async () => {
    const [c] = await su<{ courses: number; modules: number; cats: number; services: number }>(`
      select (select count(*)::int from courses) as courses, (select count(*)::int from course_modules) as modules,
             (select count(*)::int from service_categories) as cats, (select count(*)::int from services) as services`);
    expect(c).toEqual({ courses: 4, modules: 12, cats: 10, services: 72 });
    const [combo] = await su<{ n: number }>(`select cardinality(included_course_ids) as n from courses where code = 'combo'`);
    expect(combo!.n).toBe(3);
  });
});

describe('who can see anything at all', () => {
  it('blocks anonymous visitors from everything but the keep-alive ping', async () => {
    await expect(as('anon', `select * from services`)).rejects.toThrow(/permission denied/);
    await expect(as('anon', `select log_visit('{}'::jsonb)`)).rejects.toThrow(/permission denied/);
    await expect(as('anon', `select * from enrollment_fee_status`)).rejects.toThrow(/permission denied/);
    await expect(as('anon', `select client_name_for_phone('9876543210')`)).rejects.toThrow(/permission denied/);
    expect(await as('anon', `select ping() as p`)).toEqual([{ p: 'ok' }]);
  });

  it('shows nothing to an account Mom did not create', async () => {
    expect(await as('outsider', `select * from services`)).toHaveLength(0);
    expect(await as('outsider', `select * from profiles`)).toHaveLength(0);
  });

  it('shows nothing to a deactivated account', async () => {
    expect(await as('gone', `select * from services`)).toHaveLength(0);
    await expect(as('gone', `select log_visit('{}'::jsonb)`)).rejects.toThrow(/Not allowed/);
  });

  it('stops staff from promoting themselves', async () => {
    await as('staff', `update profiles set is_owner = true where id = auth.uid()`);
    const [p] = await su<{ is_owner: boolean }>(`select is_owner from profiles where id = $1`, [U.staff]);
    expect(p!.is_owner).toBe(false);
  });
});

describe('salon log', () => {
  let visitId: string;

  it('staff log a visit; the total and catalog prices are filled in by the database', async () => {
    const wax = await serviceId('Rica wax · Full arms');
    const brows = await serviceId('Threading (eyebrows, forehead, upper lip, chin)');
    const [r] = await as<{ id: string }>('staff', `select log_visit($1::jsonb) as id`, [JSON.stringify({
      client_name: 'Asha', client_phone: '9876543210', paid_cash: 200, paid_upi: 200,
      lines: [
        { service_id: wax, price: 350, staff_id: U.staff },
        { service_id: brows, price: 50, staff_id: U.staff2 },
      ],
    })]);
    visitId = r!.id;
    const [v] = await su<{ total: number; created_by: string }>(`select total, created_by from visits where id = $1`, [visitId]);
    expect(v).toEqual({ total: 400, created_by: U.staff });
    const lines = await su<{ service_name: string; list_price: number }>(
      `select service_name, list_price from visit_lines where visit_id = $1 order by sort`, [visitId]);
    expect(lines.map((l) => l.list_price)).toEqual([350, 30]);
  });

  it('staff see only their own entries; the owner sees all', async () => {
    expect(await as('staff', `select id from visits`)).toHaveLength(1);
    expect(await as('staff', `select id from visit_lines`)).toHaveLength(2);
    expect(await as('staff2', `select id from visits`)).toHaveLength(0);
    expect(await as('owner', `select id from visits`)).toHaveLength(1);
    expect(await as('trainer', `select id from visits`)).toHaveLength(0);
  });

  it('a switched-off login sees none of its own entries, even with a session still open', async () => {
    const wax = await serviceId('Rica wax · Full arms');
    const [v] = await su<{ id: string }>(
      `insert into visits (client_name, total, paid_cash, created_by) values ('Old', 350, 350, $1) returning id`, [U.gone]);
    await su(`insert into visit_lines (visit_id, service_id, service_name, list_price, price, staff_id)
              values ($1, $2, 'Rica wax', 350, 350, $3)`, [v!.id, wax, U.gone]);
    expect(await as('gone', `select id from visits`)).toHaveLength(0);
    expect(await as('gone', `select id from visit_lines`)).toHaveLength(0);
    await su(`delete from visits where id = $1`, [v!.id]);
  });

  it('rejects a payment that does not match the total', async () => {
    const wax = await serviceId('Rica wax · Full arms');
    await expect(as('staff', `select log_visit($1::jsonb)`, [JSON.stringify({
      paid_cash: 300, lines: [{ service_id: wax, price: 350, staff_id: U.staff }],
    })])).rejects.toThrow(/does not match/);
  });

  it('staff can only log for today; the owner can back-date', async () => {
    const wax = await serviceId('Rica wax · Full arms');
    const body = (d: string) => JSON.stringify({
      visit_date: d, paid_cash: 350, lines: [{ service_id: wax, price: 350, staff_id: U.staff }],
    });
    await expect(as('staff', `select log_visit($1::jsonb)`, [body('2026-01-01')])).rejects.toThrow(/only be added for today/);
    const [r] = await as<{ id: string }>('owner', `select log_visit($1::jsonb) as id`, [body('2026-01-01')]);
    expect(r!.id).toBeTruthy();
  });

  it('staff cannot write to the tables directly', async () => {
    await expect(as('staff', `insert into visits (total, paid_cash) values (100, 100)`))
      .rejects.toThrow(/row-level security/);
    await as('staff', `update visits set total = 1, paid_cash = 1, paid_upi = 0 where id = $1`, [visitId]);
    const [v] = await su<{ total: number }>(`select total from visits where id = $1`, [visitId]);
    expect(v!.total).toBe(400);
  });

  it('only the creator can cancel, and only within 15 minutes', async () => {
    await expect(as('staff2', `select void_visit($1, 'oops')`, [visitId])).rejects.toThrow(/Not allowed/);
    await su(`update visits set created_at = now() - interval '20 minutes' where id = $1`, [visitId]);
    await expect(as('staff', `select void_visit($1, 'oops')`, [visitId])).rejects.toThrow(/15 minutes/);
    await su(`update visits set created_at = now() where id = $1`, [visitId]);
    await as('staff', `select void_visit($1, 'Wrong service')`, [visitId]);
    const [v] = await su<{ voided: boolean; voided_by: string }>(`select voided, voided_by from visits where id = $1`, [visitId]);
    expect(v).toEqual({ voided: true, voided_by: U.staff });
  });

  it('fills in a known client name from the phone number', async () => {
    const [r] = await as<{ n: string }>('staff2', `select client_name_for_phone('9876543210') as n`);
    // The only visit with that phone was cancelled, so nothing comes back.
    expect(r!.n).toBeNull();
    const facial = await serviceId('Hydra facial');
    await as('staff', `select log_visit($1::jsonb)`, [JSON.stringify({
      client_name: 'Asha Verma', client_phone: '9876543210', paid_upi: 3000,
      lines: [{ service_id: facial, price: 3000, staff_id: U.staff }],
    })]);
    const [r2] = await as<{ n: string }>('staff2', `select client_name_for_phone('9876543210') as n`);
    expect(r2!.n).toBe('Asha Verma');
  });

  it('closes the day against cash logged today', async () => {
    const d = await today();
    const [c] = await as<{ expected_cash: number; upi_expected: number }>('owner',
      `select expected_cash, upi_expected from close_day($1::date, 0, true, null)`, [d]);
    // Cancelled visit doesn't count; the Hydra facial was UPI.
    expect(c).toEqual({ expected_cash: 0, upi_expected: 3000 });
    await expect(as('staff', `select close_day($1::date, 0, true, null)`, [d])).rejects.toThrow(/Not allowed/);
  });
});

describe('salon work log: discounts, udhaar, work per person', () => {
  let udhaarVisit: string;
  const log = (who: Who, p: Record<string, unknown>) =>
    as<{ id: string }>(who, `select log_visit($1::jsonb) as id`, [JSON.stringify(p)]);

  it('splits a bill discount across the services by price, to the rupee', async () => {
    const wax = await serviceId('Rica wax · Full arms');
    const brows = await serviceId('Threading (eyebrows, forehead, upper lip, chin)');
    const [r] = await log('staff', {
      client_name: 'Bargain Didi', client_phone: '9811111111', discount: 55, discount_note: 'Regular client', paid_cash: 345,
      lines: [{ service_id: wax, price: 350, staff_id: U.staff }, { service_id: brows, price: 50, staff_id: U.staff2 }],
    });
    const [v] = await su(`select total, discount, discount_note from visits where id = $1`, [r!.id]);
    expect(v).toEqual({ total: 345, discount: 55, discount_note: 'Regular client' });
    // 55 × 350/400 = 48.1 and 55 × 50/400 = 6.9: the spare rupee goes to the bigger fraction.
    const lines = await su<{ discount: number }>(`select discount from visit_lines where visit_id = $1 order by sort`, [r!.id]);
    expect(lines.map((l) => l.discount)).toEqual([48, 7]);
  });

  it('refuses a discount bigger than the bill, and a payment that ignores the discount', async () => {
    const wax = await serviceId('Rica wax · Full arms');
    const line = [{ service_id: wax, price: 350, staff_id: U.staff }];
    await expect(log('staff', { discount: 400, paid_cash: 0, lines: line })).rejects.toThrow(/more than the bill/);
    await expect(log('staff', { discount: 50, paid_cash: 350, lines: line })).rejects.toThrow(/does not match/);
  });

  it('udhaar needs a name and phone, and can be part of a payment', async () => {
    const facial = await serviceId('Hydra facial');
    const line = [{ service_id: facial, price: 3000, staff_id: U.staff }];
    await expect(log('staff', { paid_udhaar: 3000, lines: line })).rejects.toThrow(/name and phone/);
    const [r] = await log('staff', { client_name: 'Neha', client_phone: '9822222222', paid_upi: 1000, paid_udhaar: 2000, lines: line });
    udhaarVisit = r!.id;
    const [s] = await as('owner', `select udhaar, collected, outstanding from udhaar_status where visit_id = $1`, [udhaarVisit]);
    expect(s).toEqual({ udhaar: 2000, collected: 0, outstanding: 2000 });
  });

  it('any staff member can look up udhaar by phone and collect it, never more than is owed', async () => {
    const owed = await as('staff2', `select visit_id, outstanding from udhaar_for_phone('9822222222')`);
    expect(owed).toEqual([{ visit_id: udhaarVisit, outstanding: 2000 }]);
    await expect(as('staff2', `select collect_udhaar($1, 2500, 'cash')`, [udhaarVisit])).rejects.toThrow(/Only 2000/);
    await expect(as('trainer', `select collect_udhaar($1, 100, 'cash')`, [udhaarVisit])).rejects.toThrow(/Not allowed/);
    await as('staff2', `select collect_udhaar($1, 500, 'cash')`, [udhaarVisit]);
    const [s] = await as('owner', `select collected, outstanding from udhaar_status where visit_id = $1`, [udhaarVisit]);
    expect(s).toEqual({ collected: 500, outstanding: 1500 });
    // Only through the function, and staff see just what they collected themselves today.
    await expect(as('staff', `insert into udhaar_collections (visit_id, amount, mode) values ($1, 1, 'cash')`, [udhaarVisit]))
      .rejects.toThrow(/permission denied/);
    expect(await as('staff', `select id from udhaar_collections`)).toHaveLength(0);
    expect(await as('staff2', `select id from udhaar_collections`)).toHaveLength(1);
  });

  it('an entry with udhaar already collected cannot be cancelled until that collection is', async () => {
    await expect(as('staff', `select void_visit($1, 'oops')`, [udhaarVisit])).rejects.toThrow(/Cancel that first/);
  });

  it('closes the day counting udhaar collected in cash as drawer cash', async () => {
    const d = await today();
    const [c] = await as('owner', `select expected_cash, upi_expected from close_day($1::date, 0, true, null)`, [d]);
    // Cash: the discounted bill 345 + udhaar collected 500. UPI: Hydra facial 3000 + Neha's 1000.
    expect(c).toEqual({ expected_cash: 845, upi_expected: 4000 });
  });

  it('each person sees the work they did; the owner sees everyone\'s totals', async () => {
    const d = await today();
    expect(await as('staff2', `select service_name, price, discount from my_work($1::date, $1::date)`, [d])).toEqual([
      { service_name: 'Threading (eyebrows, forehead, upper lip, chin)', price: 50, discount: 7 },
    ]);
    const rows = await as('owner',
      `select staff_id, services::int, charged::int, discount::int, net::int from work_by_staff($1::date, $1::date) order by net desc`, [d]);
    expect(rows).toEqual([
      { staff_id: U.staff, services: 3, charged: 6350, discount: 48, net: 6302 },
      { staff_id: U.staff2, services: 1, charged: 50, discount: 7, net: 43 },
    ]);
    await expect(as('staff', `select * from work_by_staff($1::date, $1::date)`, [d])).rejects.toThrow(/Not allowed/);
  });

  it('udhaar collections are cancelled, not deleted: staff their own, the owner any', async () => {
    const [col] = await su<{ id: string }>(`select id from udhaar_collections where visit_id = $1`, [udhaarVisit]);
    await expect(as('staff', `select void_udhaar_collection($1, 'x')`, [col!.id])).rejects.toThrow(/Not allowed/);
    await as('staff2', `select void_udhaar_collection($1, 'Wrong amount')`, [col!.id]);
    const [s] = await as('owner', `select outstanding from udhaar_status where visit_id = $1`, [udhaarVisit]);
    expect(s).toEqual({ outstanding: 2000 });
    await as('staff', `select void_visit($1, 'Client changed her mind')`, [udhaarVisit]);
    expect(await as('owner', `select * from udhaar_status where visit_id = $1`, [udhaarVisit])).toHaveLength(0);
  });

  it('collects a client\'s udhaar in one go, settling her oldest entries first', async () => {
    const wax = await serviceId('Rica wax · Full arms');
    const facial = await serviceId('Hydra facial');
    const phone = '9833333333';
    const [older] = await log('owner', {
      visit_date: '2026-01-05', client_name: 'Kavya', client_phone: phone, paid_udhaar: 350,
      lines: [{ service_id: wax, price: 350, staff_id: U.staff }],
    });
    const [newer] = await log('staff', {
      client_name: 'Kavya', client_phone: phone, paid_cash: 1000, paid_udhaar: 2000,
      lines: [{ service_id: facial, price: 3000, staff_id: U.staff }],
    });
    await expect(as('staff2', `select collect_udhaar_for_phone($1, 3000, 'upi')`, [phone])).rejects.toThrow(/Only 2350/);
    await as('staff2', `select collect_udhaar_for_phone($1, 1000, 'upi')`, [phone]);
    const owed = await as('owner',
      `select visit_id, outstanding from udhaar_status where client_phone = $1 order by visit_date`, [phone]);
    expect(owed).toEqual([{ visit_id: older!.id, outstanding: 0 }, { visit_id: newer!.id, outstanding: 1350 }]);
    expect(await as('staff', `select * from udhaar_for_phone($1)`, [phone])).toHaveLength(1);
    await expect(as('trainer', `select collect_udhaar_for_phone($1, 10, 'cash')`, [phone])).rejects.toThrow(/Not allowed/);
  });
});

describe('academy', () => {
  let enrollmentId: string;
  let studentId: string;

  const admission = async (agreed: number, plan: { due_date: string; amount: number }[], trainer = U.trainer) => ({
    student: { full_name: 'Priya Singh', phone: '9123456780', source: 'Instagram' },
    details: { address: 'Gomti Nagar', guardian_name: 'R. Singh', id_last4: '1234' },
    enrollment: {
      course_id: await courseId('makeup'), start_date: '2026-10-01', expected_end_date: '2026-11-15',
      trainer_ids: [trainer], days_of_week: [1, 3, 5],
    },
    fees: { list_fee: 30000, agreed_fee: agreed, discount_note: 'Referral' },
    installments: plan,
    first_payment: { amount: 10000, mode: 'upi', paid_on: '2026-10-01' },
  });

  it('creates an admission with plan and first payment, numbering the receipt', async () => {
    const plan = [
      { due_date: '2026-10-01', amount: 10000 },
      { due_date: '2026-11-01', amount: 9000 },
      { due_date: '2026-12-01', amount: 9000 },
    ];
    const [r] = await as<{ r: { enrollment_id: string; student_id: string; receipt_no: string } }>(
      'owner', `select create_admission($1::jsonb) as r`, [JSON.stringify(await admission(28000, plan))]);
    enrollmentId = r!.r.enrollment_id;
    studentId = r!.r.student_id;
    expect(r!.r.receipt_no).toBe('NGM/26-27/0001');
    const [e] = await su<{ days_of_week: number[] }>(`select days_of_week from enrollments where id = $1`, [enrollmentId]);
    expect(e!.days_of_week).toEqual([1, 3, 5]);
  });

  it('refuses a plan that does not add up to the agreed fee', async () => {
    await expect(as('owner', `select create_admission($1::jsonb)`, [JSON.stringify(
      await admission(28000, [{ due_date: '2026-10-01', amount: 20000 }]))])).rejects.toThrow(/must add up/);
  });

  it('only the owner can admit students', async () => {
    await expect(as('trainer', `select create_admission($1::jsonb)`, [JSON.stringify(
      await admission(10000, [{ due_date: '2026-10-01', amount: 10000 }]))])).rejects.toThrow(/Not allowed/);
  });

  it('numbers receipts in order', async () => {
    const [p] = await as<{ receipt_no: string }>('owner',
      `insert into payments (enrollment_id, amount, mode, paid_on) values ($1, 5000, 'cash', '2026-10-20') returning receipt_no`,
      [enrollmentId]);
    expect(p!.receipt_no).toBe('NGM/26-27/0002');
    const [q] = await as<{ receipt_no: string }>('owner',
      `insert into payments (enrollment_id, amount, mode, paid_on) values ($1, 100, 'cash', '2027-04-02') returning receipt_no`,
      [enrollmentId]);
    expect(q!.receipt_no).toBe('NGM/27-28/0001');
  });

  it('payments can be cancelled but never edited or deleted', async () => {
    const [p] = await su<{ id: string }>(`select id from payments where receipt_no = 'NGM/27-28/0001'`);
    await expect(as('owner', `update payments set amount = 1 where id = $1`, [p!.id])).rejects.toThrow(/can't be edited/);
    await as('owner', `delete from payments where id = $1`, [p!.id]);
    expect(await su(`select id from payments where id = $1`, [p!.id])).toHaveLength(1);
    await as('owner', `update payments set voided = true, void_reason = 'Entered twice' where id = $1`, [p!.id]);
    const [v] = await su<{ voided_by: string }>(`select voided_by from payments where id = $1`, [p!.id]);
    expect(v!.voided_by).toBe(U.owner);
  });

  it('fee status in the database matches the app calculation', async () => {
    const d = await today();
    const [s] = await as<{ paid: number; balance: number; overdue_amount: number; next_due_date: string | null }>(
      'owner', `select paid, balance, overdue_amount, next_due_date::text from enrollment_fee_status where enrollment_id = $1`,
      [enrollmentId]);
    const inst = await su<{ id: string; due_date: string; amount: number }>(
      `select id, due_date::text, amount from installments where enrollment_id = $1`, [enrollmentId]);
    const pays = await su<{ amount: number; voided: boolean }>(`select amount, voided from payments where enrollment_id = $1`, [enrollmentId]);
    const js = summarizeFees(28000, inst, pays, d);
    expect(s).toEqual({
      paid: js.paid, balance: js.balance, overdue_amount: js.overdueAmount, next_due_date: js.nextDue?.date ?? null,
    });
    expect(s!.paid).toBe(15000);
  });

  it("trainers see their own students but never fees or private details", async () => {
    expect(await as('trainer', `select id from students`)).toHaveLength(1);
    expect(await as('trainer', `select id from enrollments`)).toHaveLength(1);
    expect(await as('trainer', `select * from student_details`)).toHaveLength(0);
    expect(await as('trainer', `select * from enrollment_fees`)).toHaveLength(0);
    expect(await as('trainer', `select * from payments`)).toHaveLength(0);
    expect(await as('trainer', `select * from installments`)).toHaveLength(0);
    expect(await as('trainer', `select * from enrollment_fee_status`)).toHaveLength(0);
    expect(await as('trainer2', `select id from students`)).toHaveLength(0);
    expect(await as('staff', `select id from students`)).toHaveLength(0);
  });

  it('trainers mark attendance and progress only for their own students', async () => {
    await as('trainer', `insert into attendance (enrollment_id, day, status) values ($1, '2026-10-05', 'present')`, [enrollmentId]);
    await expect(as('trainer2', `insert into attendance (enrollment_id, day, status) values ($1, '2026-10-07', 'present')`,
      [enrollmentId])).rejects.toThrow(/row-level security/);
    const [m] = await su<{ id: string }>(`select id from course_modules where title_en = 'Eye Makeup'`);
    await as('trainer', `insert into module_progress (enrollment_id, module_id, status, rating) values ($1, $2, 'done', 4)`,
      [enrollmentId, m!.id]);
    expect(await as('trainer', `select * from module_progress`)).toHaveLength(1);
    // Trainers can't move students between slots or change the course.
    await as('trainer', `update enrollments set notes = 'x' where id = $1`, [enrollmentId]);
    const [e] = await su<{ notes: string | null }>(`select notes from enrollments where id = $1`, [enrollmentId]);
    expect(e!.notes).toBeNull();
  });

  it('records history that only the owner can read', async () => {
    expect((await as('owner', `select id from audit_log where table_name = 'payments'`)).length).toBeGreaterThanOrEqual(3);
    expect(await as('staff', `select id from audit_log`)).toHaveLength(0);
    expect(await as('trainer', `select id from audit_log`)).toHaveLength(0);
    expect(studentId).toBeTruthy();
  });
});

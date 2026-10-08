# NG Studio: management app for Namita Garg Makeover (academy + salon)

## Context
Namita Garg runs a bridal makeup studio and academy in Lucknow. Today, student fees, installments, attendance, progress and the salon's daily services are tracked by hand. We are building a private, mobile-first app for three kinds of users:
- **Mom (owner):** sees everything.
- **Trainers:** attendance and progress for their own students.
- **Salon staff:** log the services they did and the payment they collected, from their own phones.

The public website (`C:\Users\sansg\Documents\NG-Makeover`, plain HTML/CSS/JS, auto-deployed by Vercel from GitHub `Soundskar/NG-Makeover`) already contains:
- the full course catalog with modules (`academy.html`)
- the salon price list, about 70 items (`services.html`)
- the brand design tokens (`css/styles.css` `:root`)

The app is seeded from these, so Mom only confirms the catalog instead of typing it.

**Decisions made with the user:**
- **Location:** the app lives in this repo, in a new `studio/` folder.
- **Logins:** Owner, trainers and salon staff (no student logins).
- **Internet:** reliable, so the app works online only. It shows a clear "no internet" banner and never loses a form that hasn't been saved.
- **Payments:** staff collect the money and log it themselves.
- **Installments:** custom per student, with dates and amounts set by Mom.
- **Class timing:** each student has their own slot and days. There are no group batches.
- **Language:** Hindi and English switch, chosen per user.
- **Bridal/engagement packages:** these bookings (advance + balance) move to Phase 2.
- **Commission:** staff are paid salary + commission. The user will explain the commission rules later, so Phase 1 stores everything commission needs (who did which service, at what price).
- **Roadmap extras:** website enquiries inbox, expenses, certificates, product/kit stock (Phase 3).
- **Building:** Claude writes all the code. The user reviews each milestone.

## Stack
- **Node.js LTS.** Not installed yet. One-time install: `winget install OpenJS.NodeJS.LTS`.
- **Frontend:** Vite + React + TypeScript, installable as an app (`vite-plugin-pwa`). Uses React Router and TanStack Query, zod for form validation, and lucide-react icons.
- **Backend:** Supabase on the free tier: Postgres, Auth, row-level security (RLS) and one Edge Function. Two projects: `ngm-dev` (for building) and `ngm-prod` (real data).
- **Hosting:** a second Vercel project from the same repo, with Root Directory `studio/`. Its URL is something like `ngm-studio.vercel.app`.
- **Styling:**
  - Plain CSS using the website's tokens (rosewater `--bg`, kajal `--ink`, sindoor `--sindoor` for main actions, velvet, gold).
  - Fonts: Jost for text and Bodoni Moda only for headings, plus **Mukta** for Devanagari, because Jost has no Hindi glyphs.
  - Tap targets are at least 48px. Money is shown in Indian format (₹1,25,000).
- **Running cost: ₹0/month.**
  - Free Supabase projects pause after 7 days with no activity. A daily Vercel cron (`studio/api/keepalive.ts`) pings the database to prevent this.
  - The free tier has no automatic backups, so the app has its own Excel backup and a "last backup" reminder.

## Roles and permissions (enforced by RLS in the database, not just hidden in the UI)
| | Owner | Trainer | Staff |
|---|---|---|---|
| Course and service catalog | edit | read | read |
| Students: name, phone, photo | all | only their own students | no |
| Student private details (address, DOB, guardian, ID) | all | no | no |
| Fees, installments, payments | all | **no** | **no** |
| Attendance and progress | all | their own students | no |
| Salon entries | all, any date | no | add for today; see/edit only their own, edit within 15 min |
| Staff accounts, reports, backup | yes | no | no |

- **Login:** a username plus a 6-digit PIN.
  - Under the hood this is Supabase email/password with a made-up email address like `name@staff.ngm`.
  - The phone stays logged in.
  - Mom can create a login, reset a PIN or deactivate someone instantly, through the `manage-staff` Edge Function (owner only, uses the service-role key on the server).
- One person can have several roles, for example trainer + staff.
- **Money records are never deleted:** Mom can only void them, with a reason.
- **Change history:** every change to visits, payments, installments, fees and attendance is written to `audit_log` by database triggers.

## Data model (Supabase migrations in `studio/supabase/migrations/`)
- **People:** `profiles` (id = auth user, display_name, username, is_owner, is_trainer, is_staff, language, active).
- **Catalog:**
  - `courses`: name_en/hi, duration_months, list_fee, is_combo, included_course_ids.
  - `course_modules`: course_id, title_en/hi, topics, sort.
  - `service_categories`.
  - `services`: category, name_en/hi, price, price_min/price_max for ranged items, is_variable, active, sort.
- **Academy:**
  - `students`: name, phone, whatsapp, photo_url, joined_on, status, source, notes.
  - `student_details`: owner-only. DOB, address, guardian name/phone, ID type and **last 4 digits only, no scans**, emergency contact.
  - `enrollments`: student, course, start_date, expected_end_date (auto from duration, editable), status, `trainer_ids uuid[]`, slot_start/slot_end, `days_of_week int[]`.
  - `enrollment_fees`: owner-only. list_fee, agreed_fee, discount_note, kit_included.
  - `installments`: enrollment, due_date, amount, label.
  - `payments`: enrollment, amount, paid_on, mode (cash/upi/card/bank), received_by, note, voided.
    - `receipt_no` is filled by a trigger, e.g. `NGM/26-27/0001`, and restarts each financial year.
  - `attendance`: enrollment, date, status (present/absent/leave), marked_by. Unique per enrollment per date.
  - `module_progress`: enrollment, module, status (not started/learning/done), rating 1–5, note.
  - `holidays`: date, name.
- **Settings:** `settings` (weekly off day, standard time slots with seats, studio name/phone for receipts).
- **Salon:**
  - `visits`: visit_date (IST), client_name, client_phone, total, paid_cash/paid_upi/paid_card, created_by, voided.
  - `visit_lines`: visit, service, name and list price copied at the time of logging, price_charged, staff_id.
  - `day_closings`: date, expected_cash, counted_cash, difference, upi_checked, closed_by.
- **Views:**
  - `enrollment_balance`: agreed fee, paid, balance, next due date and amount, overdue amount. Payments are applied to installments oldest first.
  - `today_schedule`: active enrollments scheduled for today's weekday, excluding holidays.
- All "today" defaults use `Asia/Kolkata`. Amounts are whole rupees (integers).

## Screens and flows
**Salon log (staff phone):** the goal is under 10 seconds for a common service.
1. Tap a service: frequent-services tiles, category tabs or search. Several services can be added.
2. The price is pre-filled. Ranged items open the number pad with the allowed min and max shown.
3. "Done by" defaults to the person logging, and can be changed on each line.
4. Client name and phone are optional. A known phone number fills in the name.
5. Tap Cash, UPI, Card or Split → Save. A toast confirms "Saved ₹1,250" and offers undo for 5 seconds.

The "My day" screen lists the staff member's own entries and total for today.

**Day closing (owner):**
- The app shows the cash expected from today's salon entries, with academy cash shown separately.
- Mom enters the cash she counted and sees any difference.
- She ticks that the UPI total matches her UPI app.
- If yesterday wasn't closed, the dashboard shows an alert.

**Students (owner):** adding a student is a 4-step wizard.
1. Student details.
2. Course. Combo = one enrollment whose modules combine all 3 courses.
3. Slot and days, with seats left shown for each slot.
4. Fees: agreed fee and a plan builder.
   - Presets: Full / 2 parts / 3 monthly / Custom. The rows (date, amount) can be edited, and must add up to the agreed fee.
   - The first payment can be recorded here.

The student profile has tabs: Fees (installments, payments, record payment), Attendance (% and calendar), Progress (module checklist and %), Details.

**Fee follow-up:**
- Lists: "Due this week", "Overdue" and "Course ending soon".
- Each row has a WhatsApp button that opens `wa.me` with a polite message already written, in Hindi or English.
- After each payment there is a one-tap text receipt via WhatsApp: receipt number, amount, mode, paid so far, balance, next due date.

**Today (trainer and owner):**
- Today's students, grouped by time slot. Tap to cycle Present → Absent → Leave, or use "Mark all present".
- An unscheduled student can be added as an extra class.
- Students absent 2 times in a row are flagged on the dashboard, with a WhatsApp check-in button.

**Progress:** trainers tick modules and can add a rating and note. When all modules are done, Mom can mark the course completed.

**Owner home:**
- Salon today: total, cash/UPI split, each staff member's count.
- Fees collected today and this month, due this week, overdue.
- Classes today, and whether attendance has been marked.
- Alerts: day not closed, backup older than 7 days, courses ending.
- A "share today's summary" button.

**Settings (owner):** catalog editor, staff and PIN management, slots and seats, holidays, language, **Backup** (all tables to one multi-sheet .xlsx), and Excel export from any list.

**Navigation:** a bottom tab bar based on role. Owner: Home · Students · Salon · More. Staff: Log · My day. Trainer: Today · My students.

## Build order (Phase 1 = core, in milestones; the user reviews after each)
- **M0 Setup:**
  - Install Node. Scaffold `studio/`.
  - Create the Supabase dev and prod projects: **the user signs up** and runs `npx supabase login`, then Claude links the projects and pushes migrations.
  - Auth and roles, a deployed skeleton, and a root `.vercelignore` with `studio/` so the website doesn't publish the app's source. Branch: `studio`.
- **M1 Catalog and staff:**
  - Schema, RLS and the seed SQL generated from `services.html` and `academy.html`, including Hindi names drafted for Mom to check.
  - Catalog editor, the `manage-staff` function, and the Hindi/English text system (`src/i18n/en.ts`, `hi.ts`, `t()`).
- **M2 Salon:** salon log, My day, day closing, salon section of the owner home. Staff can start using it from here.
- **M3 Academy fees:** students, enrollments, fee plans, payments, receipt numbers, due/overdue lists, WhatsApp receipts and reminders.
- **M4 Classes:** slots and seats, today's schedule, attendance, module progress.
- **M5 Go-live:**
  - Owner home polish, backup/export, audit log, app icon and manifest, full Hindi pass, keep-alive cron.
  - Import current students from an Excel template.
  - Pilot week alongside the paper register, then switch over.

**Phase 2:** bridal/engagement/pre-bridal bookings (advance, balance, sessions, using the same payments ledger); commission (once the rules are explained) with a monthly staff report; image/PDF receipts shared through the phone's share menu; monthly reports and charts; progress photos (Supabase Storage, compressed); client history.

**Phase 3:** website enquiry form → app inbox (as well as WhatsApp); expenses and monthly profit; branded certificate PDF on completion; product and student-kit stock.

## Key files
- `studio/src/lib/`: `supabase.ts`, `money.ts` (₹ format, installment allocation), `dates.ts` (IST helpers), `receipts.ts`, `whatsapp.ts` (`wa.me` builders, similar to `waUrl()` in website `js/main.js:12`), `export.ts`.
- `studio/src/styles/tokens.css`: copied from the `:root` of website `css/styles.css`.
- `studio/src/features/{auth,salon,students,fees,attendance,progress,catalog,staff,dashboard,settings}/`
- `studio/supabase/migrations/*.sql`, `studio/supabase/seed/catalog.sql`, `studio/supabase/functions/manage-staff/`
- `studio/vercel.json` (single-page-app rewrite and cron), `studio/api/keepalive.ts`, `studio/README.md` (run and deploy steps)
- Root: `.vercelignore` (new). `.claude/launch.json` gets a `studio` dev-server entry. Website files stay untouched.

## Needed from the user along the way
1. Create the Supabase account (M0) and later add environment variables to the new Vercel project. Claude can't create accounts or enter keys.
2. Staff and trainer names and their roles (M1).
3. Standard time slots, seats per slot and the weekly off day (M4).
4. Current students, filled into the Excel template (M5).
5. Confirm the website prices are current, and list any services that aren't on the site (M1).
6. Commission rules (before Phase 2).

## Verification
- **`npm run test` (Vitest):**
  - installment allocation and overdue logic (partial payments, overpayment, voided payments)
  - receipt number format and financial-year rollover
  - IST date edge cases (entries just after midnight)
  - split-payment totals and day-closing difference
  - slot occupancy
- **`npm run test:rls`:** run against `ngm-dev` with seeded owner, trainer and staff test users. It checks the permission table above:
  - staff can't read payments or other staff's entries, and can't edit after 15 minutes
  - trainers can't read fees or private details
  - deactivated users are locked out
- **`npm run build` and `tsc`:** must finish with no errors.
- **Browser pane at 375px:** walk through each milestone's flows as each role. Examples:
  - a staff member logs 3 services, one of them split-paid
  - Mom closes the day and sees a ₹100 difference
  - enroll a student on a custom 3-part plan, record a payment, check the WhatsApp receipt text, move the dates forward and confirm the installment shows as overdue
  - a trainer marks attendance and the progress % updates
  - every screen in Hindi
- **On the live sites:**
  - The website still works.
  - `namita-garg-makeover.vercel.app/studio/package.json` returns 404.
  - The app installs to an Android home screen from the user's phone.
- **Pilot:** Mom runs one week alongside the paper register before switching over.

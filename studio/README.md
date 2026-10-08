# NG Studio

The private management app for Namita Garg Makeover: academy students, fees,
installments, attendance and progress, plus the salon's daily service log.
Internal only. Nobody can sign up; every login is created by the owner.

The plan this is built from is in [PLAN.md](PLAN.md).

## How it fits together

- **App:** React + TypeScript (Vite), installable on phones as a home-screen
  app. Lives in this folder and deploys as its own Vercel project, separate
  from the public website in the repo root.
- **Data:** Supabase (Postgres). The database enforces who can see what:
  `supabase/migrations/*_security.sql`. Salon logging, admissions, receipt
  numbers and day closing are database functions, so the rules hold no matter
  what the app sends.
- **Logins:** username + 6-digit PIN. Under the hood each username is an
  email on the reserved `ngstudio.invalid` domain. The owner creates logins,
  resets PINs and switches people off from **More → Team & logins**, through
  the `manage-staff` Edge Function.

## Run it locally

Needs Node.js 20 or later.

```bash
npm install
```

Copy `.env.example` to `.env.local` and fill in the dev project's URL and
publishable key (Supabase → Project Settings → API). Then:

```bash
npm run dev
```

## Tests

```bash
npm test
```

This runs the money/date/schedule logic tests and the database tests.
The database tests apply every migration to an in-memory Postgres (PGlite) and
check every access rule (owner, trainer, salon staff, switched-off logins,
anonymous visitors). No Supabase project or network needed.

## Database changes

Add a new file in `supabase/migrations/` (never edit one that has already
been pushed), run `npm test`, then push it:

```bash
npx supabase db push
```

Deploy the staff function after changing it:

```bash
npx supabase functions deploy manage-staff
```

## First-time setup of a Supabase project

1. Create the project (region: South Asia, Mumbai).
2. Authentication → Sign In / Providers: turn **off** "Allow new users to sign up".
3. Link and push: `npx supabase link --project-ref <ref>`, then
   `npx supabase db push` and `npx supabase functions deploy manage-staff`.
4. Create the owner login once in the dashboard (Authentication → Add user,
   email `namita@ngstudio.invalid`, a password, "Auto confirm" on), then run in
   the SQL editor:
   ```sql
   insert into profiles (id, display_name, username, is_owner, is_trainer, language)
   select id, 'Namita', 'namita', true, true, 'hi' from auth.users where email = 'namita@ngstudio.invalid';
   ```
   Everyone else is added from inside the app.

## Deploying

Vercel project with **Root Directory = `studio`**, framework Vite, and the
two env vars from `.env.example`. `vercel.json` adds the security headers,
keeps search engines out, and runs `/api/keepalive` daily so the free
Supabase project never pauses.

## Backups

The free Supabase plan has no downloadable backups, so the app has its own:
**More → Backup** saves every table to one Excel file. The home screen
reminds the owner when the last backup is more than a week old.

## App icons

Edit `public/favicon.svg`, then rebuild the PNGs:

```bash
node scripts/make-icons.mjs
```

# Holy Rosary Digital Platform v3
Complete responsive HTML/CSS/JS + Supabase + Flutterwave architecture.

## Included
- Modern blue/white responsive UI with scroll reveals, floating hero animation, responsive navigation and protected dashboard shell.
- Public website, school pages, admissions and payment entry.
- Student portal.
- Lecturer portal and result-submission workflow foundation.
- Registry portal for students, applications, results and result PINs.
- Admin portal for users, roles and content.
- Supabase Postgres/RLS schema.
- Flutterwave Standard checkout creation on the server.
- Flutterwave webhook receiver with signature checking and transaction re-verification.
- Result PIN issuing and secure public result lookup Edge Function foundations.
- Audit log, payments, application and result tables.

## Production setup
1. Create a Supabase project.
2. Run `supabase/schema.sql` in SQL Editor.
3. Put the Supabase project URL + publishable/anon key into `js/config.js`.
4. Deploy the Edge Functions.
5. Set Edge Function secrets:
   - `FLW_SECRET_KEY`
   - `FLW_WEBHOOK_HASH`
   - `SITE_URL`
   - `RESULT_PIN_PEPPER` (long random value)
6. Configure Flutterwave webhook to:
   `https://YOUR_PROJECT.supabase.co/functions/v1/flutterwave-webhook`
7. Configure your Flutterwave redirect URL to:
   `https://YOUR_DOMAIN/payment-return.html`
8. Replace demo pricing with management-approved fees.
9. Test with Flutterwave sandbox before switching to live keys.
10. Do a security/data migration review before real student data goes live.

## Payment flow
Application / PIN / other payable order
 -> server creates internal payment row + unique tx_ref
 -> server calls Flutterwave Standard API
 -> browser is redirected to hosted checkout
 -> Flutterwave redirects back
 -> webhook arrives
 -> webhook signature is checked
 -> server re-verifies transaction against Flutterwave
 -> amount/currency/tx_ref are matched
 -> payment marked successful
 -> purchased entitlement is fulfilled.

Never place the Flutterwave secret key or Supabase secret/service-role key in browser JavaScript.

## Phase 1–5 completion package

This package keeps the supplied live Supabase Edge Functions separate from the frontend. New frontend repairs include:
- live admin dashboard metrics
- dedicated student results page
- Registry application review/status workflow
- Registry student registration-code generator wired to `create-student-invite`
- copyable registration-code display
- dashboard styling for the new workflows
- `supabase/phase-1-5-repair.sql` for the Registry application UPDATE policy and dashboard indexes

The SQL file should be reviewed/run in the live Supabase project. Do not deploy the Edge Functions from this ZIP over the live functions unless intentionally comparing versions.


## Latest dashboard polish
- Admin Student Records, Results, Applications, Registry Students, Registry Results and Registry PINs pages can now be opened by an authenticated Admin without being redirected to login.
- Admin Users & Roles now includes a live Staff Directory showing lecturers, Registry officers and administrators from `profiles`.
- Course assignment was moved inside the dashboard content area so the desktop sidebar no longer covers the left side of the course form/list.
- Dashboard sidebars now collapse into a mobile hamburger/off-canvas menu at <=900px across Admin, Registry, Lecturer and Student workspaces.


## Payment Centre V5 — cashier + semester-aware fees

This frontend update adds:
- a dedicated Cashier dashboard grouped by each student's registered level
- student school-fee payments split into First Semester, Second Semester or Both
- server-validated part payments with continuously updated balances
- level/exam-type examination charges for First Semester, Second Semester,
  Hospital Finals, Council, Resit and Suitability
- student payment history with in-page digital receipts
- application payment moved out of the student portal and back to the public
  Admissions page
- Cashier role support in the dashboard shell and Admin staff directory
- mobile dashboard hamburger moved to the left, matching the left-side drawer
- Registry payment page narrowed to Result PIN fulfilment rather than general
  cashier collection

### LIVE backend work required

The frontend alone cannot safely enforce these rules. Apply:
`supabase/cashier-payment-migration.sql`

Then use the separately supplied LIVE Edge Function package:
`HOLY-ROSARY-LIVE-EDGE-FUNCTIONS-CASHIER`

Do not deploy the Edge Functions already present in this ZIP over the live
functions unless you intentionally compare them. Your live Supabase functions
remain the backend source of truth.

For a configured annual school fee of ₦350,000, the student portal and server calculate ₦175,000 for each semester.

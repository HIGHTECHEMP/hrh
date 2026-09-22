-- Holy Rosary Digital Platform: Phase 1–5 live-database repair helpers
-- IMPORTANT: The live Edge Functions supplied separately by the project owner remain authoritative.
-- Run this SQL in Supabase SQL Editor after reviewing it against the live schema.

-- Registry must be able to change application workflow status.
drop policy if exists "registry applications update" on public.applications;
create policy "registry applications update"
on public.applications
for update
to authenticated
using (public.is_role('registry') or public.is_role('admin'))
with check (public.is_role('registry') or public.is_role('admin'));

-- Keep Registry/Admin able to read applications.
drop policy if exists "registry applications" on public.applications;
create policy "registry applications"
on public.applications
for select
to authenticated
using (public.is_role('registry') or public.is_role('admin'));

-- Helpful indexes for the repaired dashboard queries.
create index if not exists idx_applications_status_created_at on public.applications(status, created_at desc);
create index if not exists idx_results_status_updated_at on public.results(status, updated_at desc);
create index if not exists idx_profiles_role_level on public.profiles(role, current_level);
create index if not exists idx_student_level_history_student on public.student_level_history(student_id, created_at);

-- Do NOT add a current_level value automatically during student registration here.
-- Registry should assign the student's real starting level from the Students page.

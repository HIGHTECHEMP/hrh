-- ============================================================
-- HOLY ROSARY DIGITAL PLATFORM
-- SUPABASE DATABASE SCHEMA
-- ============================================================

-- ============================================================
-- 1. EXTENSIONS
-- ============================================================

create extension if not exists pgcrypto;


-- ============================================================
-- 2. ENUM TYPES
-- ============================================================

do $$
begin
    create type public.app_role as enum (
        'student',
        'lecturer',
        'registry',
        'admin'
    );
exception
    when duplicate_object then null;
end $$;


do $$
begin
    create type public.result_status as enum (
        'draft',
        'submitted',
        'approved',
        'published',
        'returned'
    );
exception
    when duplicate_object then null;
end $$;


do $$
begin
    create type public.application_status as enum (
        'submitted',
        'under_review',
        'correction_required',
        'approved',
        'rejected',
        'enrolled'
    );
exception
    when duplicate_object then null;
end $$;


do $$
begin
    create type public.payment_status as enum (
        'pending',
        'successful',
        'failed',
        'cancelled',
        'refunded'
    );
exception
    when duplicate_object then null;
end $$;


-- ============================================================
-- 3. SCHOOLS
-- ============================================================

create table if not exists public.schools (
    id uuid primary key default gen_random_uuid(),
    code text unique not null,
    name text not null,
    description text,
    active boolean not null default true,
    created_at timestamptz not null default now()
);


insert into public.schools (
    code,
    name
)
values
    ('nursing', 'College of Nursing Sciences'),
    ('midwifery', 'School of Midwifery'),
    ('medical-laboratory', 'School of Medical Laboratory'),
    ('pharmacy', 'School of Pharmacy')
on conflict (code) do nothing;


-- ============================================================
-- 4. PROFILES
-- ============================================================

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    role public.app_role not null default 'student',
    full_name text not null default '',
    email text,
    school_id uuid references public.schools(id),
    staff_no text,
    matric_no text,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);


-- ============================================================
-- 5. APPLICATIONS
-- ============================================================

create table if not exists public.applications (
    id uuid primary key default gen_random_uuid(),

    application_no text unique not null
        default (
            'HR-' ||
            upper(
                substr(
                    replace(gen_random_uuid()::text, '-', ''),
                    1,
                    10
                )
            )
        ),

    first_name text not null,
    last_name text not null,
    email text not null,
    phone text,

    school_code text references public.schools(code),

    programme text not null,

    status public.application_status not null default 'submitted',

    reviewed_by uuid references public.profiles(id),

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);


-- ============================================================
-- 6. COURSES
-- ============================================================

create table if not exists public.courses (
    id uuid primary key default gen_random_uuid(),

    school_id uuid references public.schools(id),

    code text not null,
    name text not null,

    level text,
    semester text,

    lecturer_id uuid references public.profiles(id),

    active boolean not null default true
);


-- ============================================================
-- 7. RESULTS
-- ============================================================

create table if not exists public.results (
    id uuid primary key default gen_random_uuid(),

    student_id uuid references public.profiles(id) on delete cascade,

    course_id uuid references public.courses(id),

    semester text not null,
    examination text not null,
    academic_year text not null,

    ca_score numeric(5,2),
    exam_score numeric(5,2),
    total_score numeric(5,2),

    grade text,

    gp numeric(4,2),
    gpa numeric(4,2),
    cgpa numeric(4,2),

    status public.result_status not null default 'draft',

    submitted_by uuid references public.profiles(id),
    reviewed_by uuid references public.profiles(id),

    published_at timestamptz,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);


-- ============================================================
-- 8. RESULT PINS
-- ============================================================

create table if not exists public.result_pins (
    id uuid primary key default gen_random_uuid(),

    pin_hash text not null,

    status text not null default 'active',

    expires_at timestamptz,

    max_uses integer not null default 1,

    uses integer not null default 0,

    created_by uuid references public.profiles(id),

    created_at timestamptz not null default now()
);


-- ============================================================
-- 9. RESULT PIN ACCESS LOG
-- ============================================================

create table if not exists public.result_pin_access (
    id uuid primary key default gen_random_uuid(),

    pin_id uuid references public.result_pins(id),

    matric_no text not null,

    ip_hash text,

    accessed_at timestamptz not null default now()
);


-- ============================================================
-- 10. PAYMENTS
-- ============================================================

create table if not exists public.payments (
    id uuid primary key default gen_random_uuid(),

    tx_ref text unique not null,

    purpose text not null,

    customer_email text,

    amount numeric(12,2) not null,

    currency text not null default 'NGN',

    status public.payment_status not null default 'pending',

    flutterwave_transaction_id text,

    application_id uuid references public.applications(id),

    metadata jsonb not null default '{}'::jsonb,

    paid_at timestamptz,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);


-- ============================================================
-- 11. AUDIT LOGS
-- ============================================================

create table if not exists public.audit_logs (
    id uuid primary key default gen_random_uuid(),

    actor_id uuid references public.profiles(id),

    action text not null,

    entity_type text,

    entity_id uuid,

    metadata jsonb not null default '{}'::jsonb,

    created_at timestamptz not null default now()
);


-- ============================================================
-- 12. NEWS
-- ============================================================

create table if not exists public.news (
    id uuid primary key default gen_random_uuid(),

    title text not null,

    slug text unique not null,

    excerpt text,

    body text,

    published boolean not null default false,

    published_at timestamptz,

    created_by uuid references public.profiles(id),

    created_at timestamptz not null default now()
);


-- ============================================================
-- 13. NOTICES
-- ============================================================

create table if not exists public.notices (
    id uuid primary key default gen_random_uuid(),

    title text not null,

    body text not null,

    audience text not null default 'all',

    published boolean not null default false,

    published_at timestamptz,

    created_by uuid references public.profiles(id),

    created_at timestamptz not null default now()
);


-- ============================================================
-- 14. INDEXES
-- ============================================================

create index if not exists idx_results_student_status
on public.results(student_id, status);


create index if not exists idx_results_course
on public.results(course_id);


create index if not exists idx_results_academic_year
on public.results(academic_year);


create index if not exists idx_courses_lecturer
on public.courses(lecturer_id);


create index if not exists idx_courses_school
on public.courses(school_id);


create index if not exists idx_profiles_role
on public.profiles(role);


create index if not exists idx_profiles_matric
on public.profiles(matric_no);


create index if not exists idx_profiles_school
on public.profiles(school_id);


create index if not exists idx_payments_ref
on public.payments(tx_ref);


create index if not exists idx_payments_application
on public.payments(application_id);


create index if not exists idx_applications_status
on public.applications(status);


create index if not exists idx_applications_email
on public.applications(email);


-- ============================================================
-- 15. ENABLE ROW LEVEL SECURITY
-- ============================================================

alter table public.schools enable row level security;

alter table public.profiles enable row level security;

alter table public.applications enable row level security;

alter table public.courses enable row level security;

alter table public.results enable row level security;

alter table public.result_pins enable row level security;

alter table public.result_pin_access enable row level security;

alter table public.payments enable row level security;

alter table public.audit_logs enable row level security;

alter table public.news enable row level security;

alter table public.notices enable row level security;


-- ============================================================
-- 16. ROLE HELPER FUNCTIONS
-- ============================================================

create or replace function public.is_role(
    r public.app_role
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.profiles
        where id = auth.uid()
        and role = r
        and active = true
    );
$$;


create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.profiles
        where id = auth.uid()
        and role in (
            'lecturer',
            'registry',
            'admin'
        )
        and active = true
    );
$$;


-- ============================================================
-- 17. DROP OLD POLICIES
-- ============================================================
-- This makes the SQL safe to re-run if a policy already exists.


drop policy if exists "own profile or staff"
on public.profiles;

drop policy if exists "public schools"
on public.schools;

drop policy if exists "public application insert"
on public.applications;

drop policy if exists "registry applications"
on public.applications;

drop policy if exists "student published results"
on public.results;

drop policy if exists "lecturer assigned results"
on public.results;

drop policy if exists "lecturer assigned results select"
on public.results;

drop policy if exists "lecturer assigned results insert"
on public.results;

drop policy if exists "lecturer assigned results update"
on public.results;

drop policy if exists "registry results"
on public.results;

drop policy if exists "published news"
on public.news;

drop policy if exists "published notices"
on public.notices;


-- ============================================================
-- 18. PROFILE POLICIES
-- ============================================================

create policy "own profile or staff"
on public.profiles
for select
to authenticated
using (
    id = auth.uid()
    or public.is_staff()
);


-- ============================================================
-- 19. SCHOOL POLICIES
-- ============================================================

create policy "public schools"
on public.schools
for select
to anon, authenticated
using (
    active = true
);


-- ============================================================
-- 20. APPLICATION POLICIES
-- ============================================================

create policy "public application insert"
on public.applications
for insert
to anon, authenticated
with check (
    true
);


create policy "registry applications"
on public.applications
for select
to authenticated
using (
    public.is_role('registry')
    or public.is_role('admin')
);


-- ============================================================
-- 21. STUDENT RESULT POLICY
-- ============================================================

create policy "student published results"
on public.results
for select
to authenticated
using (
    student_id = auth.uid()
    and status = 'published'
);


-- ============================================================
-- 22. LECTURER RESULT POLICIES
-- ============================================================

create policy "lecturer assigned results select"
on public.results
for select
to authenticated
using (
    public.is_role('lecturer')
    and exists (
        select 1
        from public.courses c
        where c.id = public.results.course_id
        and c.lecturer_id = auth.uid()
    )
);


create policy "lecturer assigned results insert"
on public.results
for insert
to authenticated
with check (
    public.is_role('lecturer')
    and exists (
        select 1
        from public.courses c
        where c.id = public.results.course_id
        and c.lecturer_id = auth.uid()
    )
);


create policy "lecturer assigned results update"
on public.results
for update
to authenticated
using (
    public.is_role('lecturer')
    and exists (
        select 1
        from public.courses c
        where c.id = public.results.course_id
        and c.lecturer_id = auth.uid()
    )
)
with check (
    public.is_role('lecturer')
    and exists (
        select 1
        from public.courses c
        where c.id = public.results.course_id
        and c.lecturer_id = auth.uid()
    )
);


-- ============================================================
-- 23. REGISTRY / ADMIN RESULT POLICIES
-- ============================================================

create policy "registry results"
on public.results
for select
to authenticated
using (
    public.is_role('registry')
    or public.is_role('admin')
);


create policy "registry results update"
on public.results
for update
to authenticated
using (
    public.is_role('registry')
    or public.is_role('admin')
)
with check (
    public.is_role('registry')
    or public.is_role('admin')
);


-- ============================================================
-- 24. NEWS
-- ============================================================

create policy "published news"
on public.news
for select
to anon, authenticated
using (
    published = true
);


-- ============================================================
-- 25. NOTICES
-- ============================================================

create policy "published notices"
on public.notices
for select
to authenticated
using (
    published = true
);


-- ============================================================
-- 26. IMPORTANT SECURITY NOTE
-- ============================================================
--
-- Payments, result PINs, PIN access logs and audit logs
-- are intentionally NOT exposed for arbitrary client writes.
--
-- These operations should be handled by Supabase Edge Functions
-- using appropriate server-side authorization.
--
-- NEVER put the Supabase service-role/secret key in your
-- HTML, CSS, JavaScript or browser code.
--
-- ============================================================


-- ============================================================
-- 27. GRANTS
-- ============================================================

grant usage on schema public to anon, authenticated;

grant select on public.schools to anon, authenticated;

grant insert on public.applications to anon, authenticated;

grant select on public.news to anon, authenticated;

grant select on public.notices to authenticated;

grant select on public.profiles to authenticated;

grant select on public.results to authenticated;

grant insert on public.results to authenticated;

grant update on public.results to authenticated;


-- ============================================================
-- DONE
-- ============================================================
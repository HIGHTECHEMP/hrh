-- ============================================================
-- HOLY ROSARY HOMEPAGE CONTENT MANAGEMENT
-- Run AFTER your existing schema.sql
-- ============================================================

create table if not exists public.homepage_director (
    id uuid primary key default gen_random_uuid(),
    name text not null default 'Rev. Fr. Justin Okoro',
    message text not null default '',
    quote text,
    image_url text,
    active boolean not null default true,
    updated_at timestamptz not null default now()
);


create table if not exists public.management_team (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    title text not null,
    bio text,
    image_url text,
    sort_order integer not null default 0,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);


create table if not exists public.gallery_items (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    description text,
    image_url text,
    sort_order integer not null default 0,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);


create table if not exists public.activity_items (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    description text,
    category text not null default 'Campus Life',
    image_url text,
    sort_order integer not null default 0,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);


create table if not exists public.upcoming_events (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    description text,
    category text not null default 'EVENT',
    event_date timestamptz,
    location text,
    image_url text,
    sort_order integer not null default 0,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);


create table if not exists public.facility_items (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    description text,
    icon text default '✚',
    image_url text,
    sort_order integer not null default 0,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);


-- ============================================================
-- SCHOOLS
-- ============================================================

alter table public.schools
add column if not exists image_url text;

alter table public.schools
add column if not exists updated_at timestamptz not null default now();


-- ============================================================
-- STORAGE
-- One public bucket for homepage images.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('site-content', 'site-content', true)
on conflict (id)
do update set public = true;


-- ============================================================
-- DIRECTOR SEED
-- ============================================================

insert into public.homepage_director (
    name,
    message,
    quote
)
select
    'Rev. Fr. Justin Okoro',
    'On behalf of my team, I welcome you to Holy Rosary Hospital Emekuku, a Catholic institute organized by the Catholic Archdiocese of Owerri. Holy Rosary is a tertiary healthcare facility co-existing with the College of Nursing Science, School of Midwifery, School of Pharmacy Technician, School of Medical Laboratory and Pre science. Our environment is friendly, the staff and students are welcoming, nevertheless, we are driven by core Catholic principles, policies and values.',
    'In all things, God is first.'
where not exists (
    select 1
    from public.homepage_director
);


-- ============================================================
-- MANAGEMENT SEED
-- ============================================================

insert into public.management_team (
    name,
    title,
    sort_order
)
select
    'Rev. Sr. Roseflora Ekperinwa',
    'Provost, College of Nursing',
    1
where not exists (
    select 1
    from public.management_team
    where name = 'Rev. Sr. Roseflora Ekperinwa'
);


insert into public.management_team (
    name,
    title,
    sort_order
)
select
    'Rev. Fr. Achugwo David Onyekachi',
    'Chaplain',
    2
where not exists (
    select 1
    from public.management_team
    where name = 'Rev. Fr. Achugwo David Onyekachi'
);


insert into public.management_team (
    name,
    title,
    sort_order
)
select
    'Rev. Sr. Marylena Muoneke',
    'Provost, School of Medical Laboratory',
    3
where not exists (
    select 1
    from public.management_team
    where name = 'Rev. Sr. Marylena Muoneke'
);


-- ============================================================
-- CAMPUS ACTIVITIES SEED
-- ============================================================

insert into public.activity_items (
    title,
    description,
    category,
    sort_order
)
select
    'Academics',
    'We strive to equip students with the knowledge, skills, and mindset needed to excel in today''s competitive world.',
    'Campus Life',
    1
where not exists (
    select 1
    from public.activity_items
    where title = 'Academics'
);


insert into public.activity_items (
    title,
    description,
    category,
    sort_order
)
select
    'Sport',
    'Sport is enthusiastically celebrated throughout Holy Rosary students'' community life.',
    'Campus Life',
    2
where not exists (
    select 1
    from public.activity_items
    where title = 'Sport'
);


insert into public.activity_items (
    title,
    description,
    category,
    sort_order
)
select
    'Arts & Culture',
    'Explore creativity, cultural richness and the traditions that shape the Holy Rosary community.',
    'Campus Life',
    3
where not exists (
    select 1
    from public.activity_items
    where title = 'Arts & Culture'
);


insert into public.activity_items (
    title,
    description,
    category,
    sort_order
)
select
    'Clinical Experiences',
    'Practical learning, clinical rotations and real-world opportunities help build professional confidence.',
    'Student Affairs',
    4
where not exists (
    select 1
    from public.activity_items
    where title = 'Clinical Experiences'
);


-- ============================================================
-- FACILITIES SEED
-- ============================================================

insert into public.facility_items (
    title,
    description,
    icon,
    sort_order
)
select
    'College Library',
    'Resources and study spaces supporting academic work and professional development.',
    '▦',
    1
where not exists (
    select 1
    from public.facility_items
    where title = 'College Library'
);


insert into public.facility_items (
    title,
    description,
    icon,
    sort_order
)
select
    'Laboratories',
    'Practical spaces supporting laboratory learning, demonstrations and skills development.',
    '⌬',
    2
where not exists (
    select 1
    from public.facility_items
    where title = 'Laboratories'
);


insert into public.facility_items (
    title,
    description,
    icon,
    sort_order
)
select
    'Health Services',
    'Hospital services provide a healthcare environment connected to professional learning.',
    '✚',
    3
where not exists (
    select 1
    from public.facility_items
    where title = 'Health Services'
);


insert into public.facility_items (
    title,
    description,
    icon,
    sort_order
)
select
    'Clinical Learning',
    'Opportunities for students to connect classroom knowledge with supervised practice.',
    '◉',
    4
where not exists (
    select 1
    from public.facility_items
    where title = 'Clinical Learning'
);


-- ============================================================
-- UPCOMING EVENTS SEED
-- ============================================================

insert into public.upcoming_events (
    title,
    description,
    category,
    location,
    sort_order
)
select
    'Admission Information Session',
    'Information for prospective students about programmes, requirements and the application journey.',
    'ADMISSIONS',
    'Holy Rosary Emekuku',
    1
where not exists (
    select 1
    from public.upcoming_events
    where title = 'Admission Information Session'
);


insert into public.upcoming_events (
    title,
    description,
    category,
    sort_order
)
select
    'Student Orientation',
    'Welcome activities, programme guidance and essential information for new students.',
    'ACADEMIC',
    2
where not exists (
    select 1
    from public.upcoming_events
    where title = 'Student Orientation'
);


insert into public.upcoming_events (
    title,
    description,
    category,
    sort_order
)
select
    'Community & Student Activities',
    'Watch this space for upcoming cultural, sporting and student-community activities.',
    'CAMPUS LIFE',
    3
where not exists (
    select 1
    from public.upcoming_events
    where title = 'Community & Student Activities'
);


-- ============================================================
-- RLS
-- ============================================================

alter table public.homepage_director enable row level security;
alter table public.management_team enable row level security;
alter table public.gallery_items enable row level security;
alter table public.activity_items enable row level security;
alter table public.upcoming_events enable row level security;
alter table public.facility_items enable row level security;
alter table public.schools enable row level security;
alter table public.courses enable row level security;


-- ============================================================
-- DROP OUR POLICIES IF THEY ALREADY EXIST
-- ============================================================

drop policy if exists "public director"
on public.homepage_director;

drop policy if exists "admin director"
on public.homepage_director;

drop policy if exists "public management"
on public.management_team;

drop policy if exists "admin management"
on public.management_team;

drop policy if exists "public gallery"
on public.gallery_items;

drop policy if exists "admin gallery"
on public.gallery_items;

drop policy if exists "public activities"
on public.activity_items;

drop policy if exists "admin activities"
on public.activity_items;

drop policy if exists "public events"
on public.upcoming_events;

drop policy if exists "admin events"
on public.upcoming_events;

drop policy if exists "public facilities"
on public.facility_items;

drop policy if exists "admin facilities"
on public.facility_items;

drop policy if exists "admin schools"
on public.schools;

drop policy if exists "admin courses"
on public.courses;

drop policy if exists "staff courses select"
on public.courses;


-- ============================================================
-- DIRECTOR POLICIES
-- ============================================================

create policy "public director"
on public.homepage_director
for select
to anon, authenticated
using (
    active = true
);


create policy "admin director"
on public.homepage_director
for all
to authenticated
using (
    public.is_role('admin')
)
with check (
    public.is_role('admin')
);


-- ============================================================
-- MANAGEMENT POLICIES
-- ============================================================

create policy "public management"
on public.management_team
for select
to anon, authenticated
using (
    active = true
);


create policy "admin management"
on public.management_team
for all
to authenticated
using (
    public.is_role('admin')
)
with check (
    public.is_role('admin')
);


-- ============================================================
-- GALLERY POLICIES
-- ============================================================

create policy "public gallery"
on public.gallery_items
for select
to anon, authenticated
using (
    active = true
);


create policy "admin gallery"
on public.gallery_items
for all
to authenticated
using (
    public.is_role('admin')
)
with check (
    public.is_role('admin')
);


-- ============================================================
-- ACTIVITY POLICIES
-- ============================================================

create policy "public activities"
on public.activity_items
for select
to anon, authenticated
using (
    active = true
);


create policy "admin activities"
on public.activity_items
for all
to authenticated
using (
    public.is_role('admin')
)
with check (
    public.is_role('admin')
);


-- ============================================================
-- EVENT POLICIES
-- ============================================================

create policy "public events"
on public.upcoming_events
for select
to anon, authenticated
using (
    active = true
);


create policy "admin events"
on public.upcoming_events
for all
to authenticated
using (
    public.is_role('admin')
)
with check (
    public.is_role('admin')
);


-- ============================================================
-- FACILITY POLICIES
-- ============================================================

create policy "public facilities"
on public.facility_items
for select
to anon, authenticated
using (
    active = true
);


create policy "admin facilities"
on public.facility_items
for all
to authenticated
using (
    public.is_role('admin')
)
with check (
    public.is_role('admin')
);


-- ============================================================
-- SCHOOL ADMIN POLICY
-- ============================================================

create policy "admin schools"
on public.schools
for all
to authenticated
using (
    public.is_role('admin')
)
with check (
    public.is_role('admin')
);


-- ============================================================
-- COURSE ADMIN / ASSIGNMENT POLICIES
-- ============================================================

create policy "admin courses"
on public.courses
for all
to authenticated
using (
    public.is_role('admin')
)
with check (
    public.is_role('admin')
);


create policy "staff courses select"
on public.courses
for select
to authenticated
using (
    public.is_role('admin')
    or public.is_role('registry')
    or (
        public.is_role('lecturer')
        and lecturer_id = auth.uid()
    )
);


-- ============================================================
-- STORAGE POLICIES
-- ============================================================

drop policy if exists "public site content read"
on storage.objects;

drop policy if exists "admin site content uploads"
on storage.objects;

drop policy if exists "admin site content updates"
on storage.objects;

drop policy if exists "admin site content deletes"
on storage.objects;


create policy "public site content read"
on storage.objects
for select
to public
using (
    bucket_id = 'site-content'
);


create policy "admin site content uploads"
on storage.objects
for insert
to authenticated
with check (
    bucket_id = 'site-content'
    and public.is_role('admin')
);


create policy "admin site content updates"
on storage.objects
for update
to authenticated
using (
    bucket_id = 'site-content'
    and public.is_role('admin')
)
with check (
    bucket_id = 'site-content'
    and public.is_role('admin')
);


create policy "admin site content deletes"
on storage.objects
for delete
to authenticated
using (
    bucket_id = 'site-content'
    and public.is_role('admin')
);


-- ============================================================
-- GRANTS
-- ============================================================

grant select
on public.homepage_director
to anon, authenticated;

grant select
on public.management_team
to anon, authenticated;

grant select
on public.gallery_items
to anon, authenticated;

grant select
on public.activity_items
to anon, authenticated;

grant select
on public.upcoming_events
to anon, authenticated;

grant select
on public.facility_items
to anon, authenticated;


grant select, insert, update, delete
on public.homepage_director
to authenticated;

grant select, insert, update, delete
on public.management_team
to authenticated;

grant select, insert, update, delete
on public.gallery_items
to authenticated;

grant select, insert, update, delete
on public.activity_items
to authenticated;

grant select, insert, update, delete
on public.upcoming_events
to authenticated;

grant select, insert, update, delete
on public.facility_items
to authenticated;

grant select, insert, update, delete
on public.schools
to authenticated;

grant select, insert, update, delete
on public.courses
to authenticated;


-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists idx_management_active_order
on public.management_team(active, sort_order);

create index if not exists idx_gallery_active_order
on public.gallery_items(active, sort_order);

create index if not exists idx_activity_active_order
on public.activity_items(active, sort_order);

create index if not exists idx_events_active_date
on public.upcoming_events(active, event_date, sort_order);

create index if not exists idx_facility_active_order
on public.facility_items(active, sort_order);


-- ============================================================
-- DONE
-- ============================================================
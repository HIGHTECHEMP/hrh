-- HOLY ROSARY PAYMENT CENTRE
-- Run this AFTER the existing schema. It does not replace existing tables.

create table if not exists public.fee_catalog (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  category text not null default 'other',
  description text,
  amount numeric(12,2) not null default 0,
  currency text not null default 'NGN',
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payments add column if not exists payer_user_id uuid references public.profiles(id);
alter table public.payments add column if not exists fee_id uuid references public.fee_catalog(id);
alter table public.payments add column if not exists receipt_no text;
alter table public.payments add column if not exists fulfillment_status text not null default 'not_required';
alter table public.payments add column if not exists fulfilled_at timestamptz;
alter table public.payments add column if not exists fulfilled_by uuid references public.profiles(id);

create unique index if not exists idx_payments_receipt_no on public.payments(receipt_no) where receipt_no is not null;
create index if not exists idx_payments_payer on public.payments(payer_user_id, created_at desc);
create index if not exists idx_payments_fee on public.payments(fee_id, status);
create index if not exists idx_payments_fulfillment on public.payments(status, fulfillment_status);
create index if not exists idx_fee_catalog_active on public.fee_catalog(active, category);

alter table public.fee_catalog enable row level security;

create policy "active fees visible to authenticated users"
on public.fee_catalog for select to authenticated
using (active = true or public.is_role('admin'));

create policy "admins manage fee catalog"
on public.fee_catalog for all to authenticated
using (public.is_role('admin'))
with check (public.is_role('admin'));

create policy "users view own payments"
on public.payments for select to authenticated
using (payer_user_id = auth.uid() or public.is_role('admin') or public.is_role('registry'));

-- Seed the categories only. Amounts are deliberately zero/inactive until the school
-- enters the official charges in Admin > Fees & charges.
insert into public.fee_catalog(code,name,category,description,amount,active)
values
('result_pin','Result Checker PIN','result_pin','One-time PIN used for the public result checker.',0,false),
('application_fee','Application Fee','application','Admission/application processing fee.',0,false),
('examination_fee','Examination Fee','examination','Approved examination charge.',0,false),
('school_fees','School Fees','school_fees','Approved school/academic fees.',0,false)
on conflict (code) do nothing;

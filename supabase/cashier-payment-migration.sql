-- ============================================================
-- HOLY ROSARY PAYMENT + CASHIER EXPANSION
-- Run this in the LIVE Supabase SQL Editor AFTER the existing
-- payment-centre SQL has already been applied.
--
-- IMPORTANT:
-- This file is NOT a replacement for your existing schema and
-- does not deploy/replace Edge Functions.
-- ============================================================

-- 1. Add Cashier as a staff role.
alter type public.app_role add value if not exists 'cashier';

-- 2. Make "staff" include Cashiers.
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
          and role in ('lecturer','registry','cashier','admin')
          and active = true
    );
$$;

-- 3. Extend the fee catalogue.
-- For school_fees:
--   amount = ANNUAL fee for the selected level.
--   The system automatically treats First + Second Semester as half
--   of the annual amount (the second half receives the rounding remainder).
--
-- For examination:
--   amount = the official charge for that level/exam type.
--
-- For result_pin:
--   amount = the official one-use PIN price.
alter table public.fee_catalog
    add column if not exists school_id uuid references public.schools(id);

alter table public.fee_catalog
    add column if not exists level text;

alter table public.fee_catalog
    add column if not exists exam_type text;

create index if not exists idx_fee_catalog_scope
on public.fee_catalog(category, school_id, level, exam_type, active);

-- 4. Payment allocations.
-- A payment may create two allocations when a student chooses
-- "Both semesters". Successful payments only count toward balances.
create table if not exists public.payment_allocations (
    id uuid primary key default gen_random_uuid(),
    payment_id uuid not null references public.payments(id) on delete cascade,
    payer_user_id uuid references public.profiles(id) on delete cascade,
    fee_id uuid references public.fee_catalog(id),
    allocation_type text not null,
    level text,
    semester text,
    exam_type text,
    amount numeric(12,2) not null check (amount > 0),
    created_at timestamptz not null default now()
);

create index if not exists idx_payment_allocations_payer
on public.payment_allocations(payer_user_id, created_at desc);

create index if not exists idx_payment_allocations_fee_scope
on public.payment_allocations(fee_id, level, semester, exam_type);

create index if not exists idx_payment_allocations_payment
on public.payment_allocations(payment_id);

alter table public.payment_allocations enable row level security;

drop policy if exists "students and staff view payment allocations"
on public.payment_allocations;

create policy "students and staff view payment allocations"
on public.payment_allocations
for select
to authenticated
using (
    payer_user_id = auth.uid()
    or public.is_role('cashier')
    or public.is_role('registry')
    or public.is_role('admin')
);

grant select on public.payment_allocations to authenticated;

-- 5. Cashiers can read the payment ledger.
drop policy if exists "cashiers view payments"
on public.payments;

create policy "cashiers view payments"
on public.payments
for select
to authenticated
using (
    public.is_role('cashier')
);

-- 6. Cashiers can read the student register through the existing
-- profiles staff policy because is_staff() now includes cashier.
-- Explicit fee visibility for Cashier is useful for the dashboard.
drop policy if exists "cashiers view fee catalog"
on public.fee_catalog;

create policy "cashiers view fee catalog"
on public.fee_catalog
for select
to authenticated
using (
    active = true
    or public.is_role('cashier')
    or public.is_role('admin')
);

-- 7. Make sure the payment fields used by the dashboard exist.
alter table public.payments
    add column if not exists payer_user_id uuid references public.profiles(id);

alter table public.payments
    add column if not exists fee_id uuid references public.fee_catalog(id);

alter table public.payments
    add column if not exists receipt_no text;

alter table public.payments
    add column if not exists fulfillment_status text not null default 'not_required';

alter table public.payments
    add column if not exists fulfilled_at timestamptz;

alter table public.payments
    add column if not exists fulfilled_by uuid references public.profiles(id);

create unique index if not exists idx_payments_receipt_no
on public.payments(receipt_no)
where receipt_no is not null;

create index if not exists idx_payments_payer_created
on public.payments(payer_user_id, created_at desc);

-- 8. Useful read grants.
grant select on public.profiles to authenticated;
grant select on public.fee_catalog to authenticated;
grant select on public.payments to authenticated;

-- 9. Optional starter rows for the new fee catalogue.
-- Existing rows are preserved. These are inactive so Admin can configure
-- the official values without accidentally exposing a guessed amount.
insert into public.fee_catalog
    (code,name,category,description,amount,currency,active,level,exam_type)
values
    ('school_fees_100','School Fees — 100 Level','school_fees','Annual school/academic fee for 100 Level.',0,'NGN',false,'100 Level',null),
    ('school_fees_200','School Fees — 200 Level','school_fees','Annual school/academic fee for 200 Level.',0,'NGN',false,'200 Level',null),
    ('school_fees_300','School Fees — 300 Level','school_fees','Annual school/academic fee for 300 Level.',0,'NGN',false,'300 Level',null),
    ('school_fees_400','School Fees — 400 Level','school_fees','Annual school/academic fee for 400 Level.',0,'NGN',false,'400 Level',null),
    ('school_fees_500','School Fees — 500 Level','school_fees','Annual school/academic fee for 500 Level.',0,'NGN',false,'500 Level',null)
on conflict (code) do nothing;

-- ============================================================
-- END
-- ============================================================

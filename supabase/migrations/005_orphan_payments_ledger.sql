-- ============================================================
-- VIS Lashes — Orphan payment ledger (payment reconciliation)
-- Run this in the Supabase SQL Editor AFTER 001–004.
--
-- SAFE TO RUN REPEATEDLY: every statement checks for its own existence first.
--
-- 002 declared this table but was only ever partially applied to the live
-- project, so the one case that actually costs a customer money — a captured
-- card with no booking behind it — had nowhere to land except a console line
-- that rotates away. This creates it for real, adds the grants 002 omitted,
-- and adds the two columns the admin needs to close a case.
-- ============================================================

create table if not exists public.orphan_payments (
  id uuid primary key default gen_random_uuid(),
  square_payment_id text not null unique,
  amount numeric(6,2),
  currency text,
  customer_email text,
  service_id uuid references public.services(id),
  booking_date date,
  time_slot text,
  failure_reason text,
  resolved boolean not null default false,
  -- Beyond 002's shape: who cleared it and what they did about it. "resolved"
  -- alone loses the refunded-vs-honoured-the-booking distinction, which is
  -- exactly what anyone auditing this later needs to know.
  resolved_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);

-- Partial index: the admin screen only ever reads the unresolved ones.
create index if not exists orphan_payments_unresolved_idx
  on public.orphan_payments (created_at desc)
  where resolved = false;

alter table public.orphan_payments enable row level security;

drop policy if exists "Admin read orphan_payments" on public.orphan_payments;
create policy "Admin read orphan_payments" on public.orphan_payments
  for select using (auth.role() = 'authenticated');

drop policy if exists "Admin manage orphan_payments" on public.orphan_payments;
create policy "Admin manage orphan_payments" on public.orphan_payments
  for all using (auth.role() = 'authenticated');

-- Base grants. RLS above is what restricts access; without these Postgres
-- rejects the query before it ever evaluates a policy — the failure mode that
-- took the whole booking flow down earlier in this project.
grant select, insert, update, delete on public.orphan_payments to authenticated, service_role;

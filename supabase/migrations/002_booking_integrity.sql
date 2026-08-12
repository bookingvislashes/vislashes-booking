-- ============================================================
-- VIS Lashes — Booking integrity constraints
-- Run this in the Supabase SQL Editor AFTER 001_initial_schema.sql
--
-- READ THIS BEFORE RUNNING.
--
-- Unlike 001, this migration is NOT unconditionally safe. Each constraint
-- below can fail against data that already violates it, which is the point:
-- it refuses rather than silently discarding a conflict. Every section starts
-- with an audit query. Run the audit, resolve what it returns, then run the
-- statement beneath it.
--
-- Statements are ordered so nothing depends on a later section.
-- ============================================================


-- ------------------------------------------------------------
-- 1. ONE CONFIRMED BOOKING PER SLOT
--
-- The application re-checks the slot before charging, but two customers
-- paying within the same instant can both pass that check. Only the database
-- can settle it. Cancelled and no-show rows are excluded so a freed slot can
-- be rebooked.
--
-- AUDIT FIRST — this must return zero rows:
--
--   select booking_date, time_slot, count(*)
--   from public.bookings
--   where status = 'confirmed'
--   group by 1, 2
--   having count(*) > 1;
--
-- Anything it returns is an existing double-booking. Decide which to keep and
-- set the other's status to 'cancelled' before continuing.
-- ------------------------------------------------------------

create unique index if not exists idx_bookings_unique_confirmed_slot
  on public.bookings (booking_date, time_slot)
  where status = 'confirmed';


-- ------------------------------------------------------------
-- 2. CASE-INSENSITIVE CLIENT EMAIL
--
-- clients.email is case-sensitive text, so "Jane@Example.com" and
-- "jane@example.com" are two different clients. The booking code now
-- lowercases before lookup, which stops new duplicates; citext makes that
-- retroactive and enforces it at the database level.
--
-- AUDIT FIRST — this must return zero rows:
--
--   select lower(email), count(*)
--   from public.clients
--   group by 1
--   having count(*) > 1;
--
-- For each duplicate group, pick a surviving row and then, for the others:
--   update public.bookings     set client_id = <keep> where client_id = <drop>;
--   update public.intake_forms set client_id = <keep> where client_id = <drop>;
--   update public.agreements   set client_id = <keep> where client_id = <drop>;
--   -- carry the history across before deleting
--   update public.clients set visit_count = <sum>, last_visit_date = <max>
--     where id = <keep>;
--   delete from public.clients where id = <drop>;
-- ------------------------------------------------------------

create extension if not exists citext;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'clients'
      and column_name = 'email'
      and udt_name <> 'citext'
  ) then
    alter table public.clients alter column email type citext;
  end if;
end $$;


-- ------------------------------------------------------------
-- 3. DEPOSIT SANITY BOUND
--
-- deposit_amount is numeric(6,2), so anything above 9999.99 overflows at
-- insert — which, on the card path, happened AFTER the customer was charged.
-- The amount is now read server-side from the services table, so this is
-- defence in depth rather than the primary guard.
--
-- AUDIT FIRST — this must return zero rows:
--
--   select id, deposit_amount from public.bookings
--   where deposit_amount is not null
--     and (deposit_amount < 0 or deposit_amount > 999.99);
-- ------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bookings_deposit_amount_range'
  ) then
    alter table public.bookings
      add constraint bookings_deposit_amount_range
      check (
        deposit_amount is null
        or (deposit_amount >= 0 and deposit_amount <= 999.99)
      );
  end if;
end $$;


-- ------------------------------------------------------------
-- 4. ORPHAN PAYMENT LEDGER
--
-- Somewhere to record a Square capture that has no booking behind it — the
-- one case where a customer has paid and received nothing. The webhook logs
-- these loudly; this gives them a durable home that survives log rotation.
--
-- Safe to run: creates a new table only.
-- ------------------------------------------------------------

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
  created_at timestamptz not null default now()
);

alter table public.orphan_payments enable row level security;

drop policy if exists "Admin read orphan_payments" on public.orphan_payments;
create policy "Admin read orphan_payments" on public.orphan_payments
  for select using (auth.role() = 'authenticated');

drop policy if exists "Admin manage orphan_payments" on public.orphan_payments;
create policy "Admin manage orphan_payments" on public.orphan_payments
  for all using (auth.role() = 'authenticated');


-- ------------------------------------------------------------
-- 5. RECONCILIATION — RUN THIS ONCE, BY HAND
--
-- The deposit amount was client-controlled and the card was captured before
-- the booking was written, both on a live site. Two things are worth checking
-- against the Square dashboard for the period before those fixes shipped:
--
--   a) Charges with no booking. Export Square payments, then compare against:
--
--        select square_payment_id, booking_date, time_slot, deposit_amount
--        from public.bookings
--        where square_payment_id is not null
--        order by created_at desc;
--
--      A Square payment id absent from that list is a customer who paid and
--      got nothing.
--
--   b) Underpaid deposits. Any booking whose stored deposit is below the
--      service's configured deposit was very likely tampered with:
--
--        select b.id, b.booking_date, b.time_slot,
--               b.deposit_amount as charged,
--               s.deposit_amount as expected,
--               c.full_name, c.email
--        from public.bookings b
--        join public.services s on s.id = b.service_id
--        left join public.clients c on c.id = b.client_id
--        where b.deposit_paid
--          and b.deposit_amount is not null
--          and b.deposit_amount < s.deposit_amount
--        order by b.created_at desc;
-- ------------------------------------------------------------

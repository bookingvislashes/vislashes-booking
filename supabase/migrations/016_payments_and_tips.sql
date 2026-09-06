-- ============================================================
-- VIS Lashes — Payments and tips
--
-- SAFE TO RUN REPEATEDLY: creates a table, its indexes and its policies only.
--
-- WHAT THIS IS FOR, AND WHAT IT IS NOT FOR
--
-- The deposit a client pays on this site already has a home: `bookings`
-- carries deposit_paid, deposit_amount and square_payment_id, and
-- `appointment_history` carries amount_paid_online for the Acuity years.
-- Reports adds those up as "paid up front" and has done since it shipped.
--
-- This table is the OTHER half of the money: what is collected at the
-- appointment itself. The balance after the deposit, and the tip. It exists
-- because none of that was recorded anywhere — the salon takes those payments
-- in the Square app on her phone, and until now the site never saw them.
--
-- Nothing in here duplicates a deposit. The webhook that populates it
-- deliberately skips the site's own deposits, and `square_payment_id` is
-- unique, so a payment can be recorded exactly once no matter how many times
-- Square re-fires the event. Reports can therefore add "paid up front" and
-- "collected at the appointment" without counting a dollar twice.
--
-- HOW A TIP IS DEFINED
--
-- Anything over the price of the service. That is the salon owner's own
-- definition and it matches how Square already reports card payments: a $130
-- charge on a $90 set arrives as amount_money 9000 and tip_money 4000.
-- A payment handed over as cash or Zelle is entered as one total, and the
-- application splits it the same way against the service price.
-- ============================================================

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),

  -- Optional. Usually an appointment, but she also gets paid for things that
  -- never became a booking row, and a booking can be deleted years later
  -- without taking the tax record of its money with it.
  booking_id uuid references public.bookings(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,

  -- Denormalised for the same reason invoices and appointment_history do it:
  -- the ledger has to still read correctly after a client row is renamed or
  -- removed. A tax report that says "payment of $130 from (deleted)" is not a
  -- tax report.
  client_name text,

  -- The exact moment, and the salon day it belongs to. Both, on purpose.
  -- paid_at is the truth; paid_on is what Reports groups by. A card tapped at
  -- 9pm in Saint Cloud is already tomorrow in UTC, and that one hour is enough
  -- to move takings into the wrong month — or, on Dec 31, the wrong tax year.
  -- It is a stored column rather than a generated one because converting a
  -- timestamptz to a named zone is STABLE, not IMMUTABLE, and Postgres will
  -- not accept it in a generated expression. The application computes it in
  -- America/New_York, the same way availability and reminders already do.
  paid_at timestamptz not null default now(),
  paid_on date not null,

  -- How the money actually arrived. 'card' covers tap, chip and keyed alike —
  -- the distinction that matters to her is card versus the app-to-app payments
  -- she has to enter herself.
  method text not null check (
    method in ('card', 'zelle', 'apple_cash', 'cash', 'venmo', 'other')
  ),

  -- 'square' means Square told us about it and the amounts are Square's.
  -- 'manual' means she typed it in. Worth keeping distinct: only one of those
  -- two can be reconciled against a payout.
  source text not null default 'manual' check (source in ('square', 'manual')),

  -- The split. service_amount is what the appointment was worth; tip_amount is
  -- everything above it. Both non-negative, and the total is derived rather
  -- than stored twice so the three numbers can never disagree.
  service_amount numeric(8, 2) not null default 0 check (service_amount >= 0),
  tip_amount numeric(8, 2) not null default 0 check (tip_amount >= 0),
  total_collected numeric(8, 2)
    generated always as (service_amount + tip_amount) stored,

  -- Unique, and the reason this table is safe to write from a webhook.
  -- Square emits payment.created and payment.updated for the same payment, and
  -- re-delivers on any non-2xx. Without this constraint every retry would be a
  -- second row and every tip would be counted twice.
  square_payment_id text unique,

  note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Reports asks one question above all others: what came in between these two
-- dates. Everything else is a lookup from a booking or a client.
create index if not exists payments_paid_on_idx on public.payments (paid_on desc);
create index if not exists payments_booking_idx on public.payments (booking_id);
create index if not exists payments_client_idx on public.payments (client_id);

alter table public.payments enable row level security;

-- Admin-only, like invoices. There is no anon policy and there should never be
-- one: this table is every dollar the business has taken.
drop policy if exists "Admin read payments" on public.payments;
create policy "Admin read payments" on public.payments
  for select using (auth.role() = 'authenticated');

-- A policy without a grant is not access. 011 learned this the hard way.
grant select on public.payments to authenticated;
grant select, insert, update, delete on public.payments to service_role;

create or replace function public.set_payments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists payments_updated_at on public.payments;
create trigger payments_updated_at
  before update on public.payments
  for each row execute function public.set_payments_updated_at();

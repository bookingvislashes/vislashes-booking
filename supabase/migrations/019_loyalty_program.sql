-- ============================================================
-- VIS Lashes — Loyalty: five visits, $15 off the next appointment
--
-- SAFE TO RUN REPEATEDLY: two additive columns, one new table, its indexes
-- and its policies. Nothing here touches a service, a price or a booking that
-- already exists.
--
-- WHAT THE PROGRAM IS
--
-- Every fifth completed appointment earns the client $15 off their next one.
-- Every service counts, both ways: a lash lift is a visit like any other, and
-- the $15 can be spent on one. The site has to answer three questions to run
-- that, and each one is a different piece of state:
--
--   1. How far through the current five is she?      clients.loyalty_visits
--   2. Has she got a reward waiting to be spent?     loyalty_rewards
--   3. Is one already attached to this appointment?  bookings.loyalty_discount
--
-- WHY NOT JUST USE clients.visit_count
--
-- visit_count is lifetime history, and for 200-odd clients it came across
-- from Acuity in the import — some of them arrive with twenty visits behind
-- them. Deriving rewards from it would hand those clients four backdated $15
-- rewards the moment this shipped, which is real money and not a decision a
-- migration gets to make. loyalty_visits starts at zero for everybody and
-- counts from the first appointment completed after this runs.
-- ============================================================


-- 1. HOW FAR THROUGH THE CURRENT FIVE
--
-- Incremented in the same place visit_count is: when the salon marks an
-- appointment completed, never when it is booked. A booking is an intention;
-- a completed appointment is someone who sat in the chair.
alter table public.clients
  add column if not exists loyalty_visits integer not null default 0;


-- 2. THE REWARDS THEMSELVES
--
-- A row per reward earned, rather than a "rewards available" counter on the
-- client. A counter cannot answer "which visit earned this" — and that is
-- exactly what she asked to see on the appointment, so she can say it out
-- loud to the client. It also makes the money auditable: every $15 taken off
-- a balance traces back to the visit that earned it.
create table if not exists public.loyalty_rewards (
  id uuid primary key default gen_random_uuid(),

  client_id uuid not null references public.clients(id) on delete cascade,

  -- Which loyalty visit earned it: 5, 10, 15… Printed to the client as
  -- "5th visit", and the half of the unique key below that makes issuing a
  -- reward idempotent.
  earned_visit_number integer not null check (earned_visit_number > 0),

  -- Copied from Settings at the moment it was earned, not read back later.
  -- If she changes the reward to $20 next year, a reward banked at $15 is
  -- still worth $15 — the alternative silently re-prices promises already
  -- made to clients.
  amount numeric(6, 2) not null check (amount > 0),

  earned_at timestamptz not null default now(),

  -- Null until it is spent. Set together, always: a reward that is redeemed
  -- but attached to no appointment is $15 that vanished with no record of
  -- where it went.
  redeemed_at timestamptz,
  redeemed_booking_id uuid references public.bookings(id) on delete set null
);

alter table public.loyalty_rewards
  drop constraint if exists loyalty_rewards_redemption_pair;
alter table public.loyalty_rewards
  add constraint loyalty_rewards_redemption_pair check (
    (redeemed_at is null and redeemed_booking_id is null)
    or (redeemed_at is not null and redeemed_booking_id is not null)
  );

-- Issuing is "insert the reward for visit 10", so re-running it — a double
-- tap on Completed, a webhook retry, the same status written twice — is a
-- duplicate key rather than a second $15.
create unique index if not exists loyalty_rewards_client_visit_idx
  on public.loyalty_rewards (client_id, earned_visit_number);

-- One reward per appointment. Without this, two rewards could both land on
-- the same booking and only one of them would ever come off the balance.
create unique index if not exists loyalty_rewards_booking_idx
  on public.loyalty_rewards (redeemed_booking_id)
  where redeemed_booking_id is not null;

-- The lookup that runs on every booking: has this client got one waiting,
-- oldest first.
create index if not exists loyalty_rewards_unredeemed_idx
  on public.loyalty_rewards (client_id, earned_at)
  where redeemed_at is null;

alter table public.loyalty_rewards enable row level security;

-- Read for the signed-in salon, and nothing else. Writes go through the
-- service role, which bypasses RLS — a reward is money off a bill, so no
-- browser gets to create or spend one, including hers.
drop policy if exists "Admin read loyalty_rewards" on public.loyalty_rewards;
create policy "Admin read loyalty_rewards" on public.loyalty_rewards
  for select using (auth.role() = 'authenticated');

-- A policy without a grant is not access. 011 learned this the hard way.
grant select on public.loyalty_rewards to authenticated;
grant select, insert, update, delete on public.loyalty_rewards to service_role;


-- 3. WHAT THIS APPOINTMENT HAS ALREADY BEEN GIVEN
--
-- The reward is attached when the appointment is booked, not when it is paid
-- for, so that it is visible the whole time it matters: on the confirmation
-- page the client just landed on, in her confirmation email, on the calendar
-- entry, and on Today when the client is standing there. Checking out simply
-- charges the number that has been on the screen all along.
--
-- Denormalised onto the booking on purpose. Every screen that prints a
-- balance needs this number, and none of them should have to join through
-- loyalty_rewards to work out what a client owes. loyalty_rewards stays the
-- record of WHY; this column is the arithmetic.
alter table public.bookings
  add column if not exists loyalty_discount numeric(6, 2) not null default 0;

alter table public.bookings
  drop constraint if exists bookings_loyalty_discount_check;
alter table public.bookings
  add constraint bookings_loyalty_discount_check check (loyalty_discount >= 0);

-- And what to call it: "Loyalty · 5th visit". Written next to the amount so
-- that every screen showing a balance — Today, the appointment, the checkout
-- sheet — can print the discount and say where it came from by reading two
-- plain columns off the booking, with no join to loyalty_rewards at all.
alter table public.bookings
  add column if not exists loyalty_note text;

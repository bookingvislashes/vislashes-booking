-- ============================================================
-- VIS Lashes — Appointments the salon books herself
--
-- SAFE TO RUN REPEATEDLY: one constraint swap and two additive columns,
-- all guarded.
--
-- WHY
--
-- Until now a row in `bookings` could only be created one way: a client went
-- through vislashes.com and paid a deposit with a card. That misses how a
-- large share of the salon's work actually gets booked — a regular pays her
-- deposit by Zelle at the end of the previous appointment, or someone in the
-- Instagram DMs is sent an invoice and books once it's paid. Those clients
-- were being kept on Acuity, or in her head, purely because the site had no
-- way to write them down.
--
-- Two things were in the way:
--
--   1. `payment_method` only allowed the four the checkout page can produce.
--      A deposit that arrived by Zelle had nowhere truthful to go — recording
--      it as 'cash' would have said the opposite of what happened, since
--      'cash' on this site means "nothing paid yet, bring it with you".
--   2. Nothing distinguished a booking the client made from one the salon
--      made on her behalf. They are not the same: the second has no intake
--      form and no signed agreement behind it yet, and the Agreements page
--      should be able to say so rather than showing a silent blank.
--
-- Neither of these touches money already recorded, and neither invents a
-- service, price or deposit — those stay hers to set in Services and Settings.
-- ============================================================


-- 1. PAYMENT METHODS
--
-- The four the checkout page produces, plus the ones she takes by hand.
-- 'invoice' is its own value rather than folded into 'card': the money does
-- arrive through Square, but it arrives from a link she sent, and knowing
-- which of the two happened is the difference between an unexplained deposit
-- and one she can trace back to a DM.
alter table public.bookings drop constraint if exists bookings_payment_method_check;
alter table public.bookings add constraint bookings_payment_method_check
  check (payment_method in (
    -- Taken by the site at checkout
    'square', 'apple_pay', 'google_pay', 'cash',
    -- Taken by the salon, off-site
    'zelle', 'venmo', 'apple_cash', 'invoice', 'other'
  ));


-- 2. WHO BOOKED IT
--
-- Defaults to 'client' so every row already in the table keeps the meaning it
-- was written with — every existing booking did come through the site.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bookings'
      and column_name = 'booked_by'
  ) then
    alter table public.bookings
      add column booked_by text not null default 'client';
  end if;
end $$;

alter table public.bookings drop constraint if exists bookings_booked_by_check;
alter table public.bookings add constraint bookings_booked_by_check
  check (booked_by in ('client', 'admin'));


-- 3. WHERE THE APPOINTMENT CAME FROM
--
-- Free text, and deliberately not a check constraint: this is a label for
-- reading back ("Instagram DM", "Zelle at her last refill", "moved off
-- Acuity"), not something the application branches on. Nullable, because most
-- bookings have nothing interesting to say here.
alter table public.bookings add column if not exists booking_source text;


-- 4. `notes` was already on the table and has never been shown anywhere.
-- Nothing to add for it here; the admin now reads and writes it.

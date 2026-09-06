-- ============================================================
-- VIS Lashes — Handing a checkout to the Square app
--
-- SAFE TO RUN REPEATEDLY: two additive columns and two indexes.
--
-- WHY
--
-- The Square app has no idea who is in the chair. Its "Add a customer" list
-- is ordered by who was most recently *created*, not by who has an
-- appointment — Square only knows about appointments if you book them in
-- Square Appointments, and the salon books them here. So every checkout
-- started with typing a name into a search box, next to a total worked out
-- in her head from a price minus a deposit.
--
-- The site already knows both numbers and both people. These two columns are
-- what let it hand the whole thing over.
-- ============================================================


-- 1. WHICH SQUARE PROFILE IS THIS CLIENT
--
-- Filled in by the matcher in lib/square-customers.ts, which only ever reads
-- from Square: it looks for a profile that already exists and records which
-- one it is. It never creates one, and it deliberately leaves this null when
-- more than one profile could be the same person — her directory has several
-- (Tabitha Rosado appears three times, under two email addresses and once
-- with the wrong surname), and guessing between them would attach a sale to
-- the wrong history.
--
-- Nullable forever. A client with no Square profile checks out perfectly
-- well; the sale simply has no customer attached, exactly as today.
alter table public.clients add column if not exists square_customer_id text;

create index if not exists clients_square_customer_idx
  on public.clients (square_customer_id);


-- 2. THE REFERENCE THAT COMES BACK
--
-- Set when she starts a checkout, and written into the Square payment's note
-- as "VIS Lashes · Tabitha · K7M2QP". When Square's webhook reports the
-- payment, that code is what attributes it to this exact appointment.
--
-- The webhook already had a guess for this: today's confirmed appointment,
-- if there is exactly one that has not been paid yet. That is right most
-- days and useless on a busy one — and a wrong attribution she never notices
-- is a wrong tax number. This makes it exact whenever the checkout started
-- from the site, and leaves the old guess in place for a card she rings up
-- in Square on her own.
--
-- Short and unambiguous rather than the booking's uuid: it is printed on the
-- client's receipt, and a 36-character identifier on a receipt looks like
-- something has gone wrong. Crockford-style alphabet, so I/1 and O/0 can
-- never be confused when reading one back.
alter table public.bookings add column if not exists checkout_ref text;

create unique index if not exists bookings_checkout_ref_idx
  on public.bookings (checkout_ref)
  where checkout_ref is not null;

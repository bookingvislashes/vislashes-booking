-- ============================================================
-- VIS Lashes — Tag credits, birthdays, and win-backs
--
-- SAFE TO RUN REPEATEDLY: every statement is guarded. It adds nullable
-- columns, two defaulted numeric columns, and two settings rows. Nothing
-- existing is written, moved or deleted.
--
-- Three things she asked for, one schema change:
--
--   1. A credit sitting on a client, granted by her, spent automatically on
--      their next booking. The $10 for tagging her within 24 hours is the
--      first use; birthdays are the second.
--   2. A birthday, collected at booking. Month and day only — the year is
--      not needed to wish someone a happy birthday and is one more personal
--      detail to hold on to for no reason.
--   3. Stamps so the birthday and win-back emails cannot repeat.
--
-- The two amounts are SETTINGS, not constants, so she changes what a tag or
-- a birthday is worth in Admin → Settings rather than asking for a deploy.
-- ============================================================

-- ── 1. The credit ──────────────────────────────────────────────────────
-- Money the salon owes this client against their next appointment. It is
-- taken off the balance settled at the chair, never off the deposit: the
-- deposit is what holds the slot and is charged by Square from the services
-- table, and nothing in this file is allowed near that path.
alter table public.clients
  add column if not exists credit_amount numeric(7,2) not null default 0;
alter table public.clients
  add column if not exists credit_reason text;
alter table public.clients
  add column if not exists credit_granted_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'clients_credit_amount_positive'
  ) then
    alter table public.clients
      add constraint clients_credit_amount_positive check (credit_amount >= 0);
  end if;
end $$;

comment on column public.clients.credit_amount is
  'Unspent credit, taken off the balance due at their next appointment. 0 = none.';
comment on column public.clients.credit_reason is
  'Why it was granted, shown to the client in their confirmation. e.g. "Thanks for tagging me!"';

-- ── 2. The birthday ────────────────────────────────────────────────────
-- Month and day, no year. Day is checked to 1–31 rather than against the
-- month, because the send logic clamps anyway and a stricter constraint
-- would reject a 29 February birthday in a common year.
alter table public.clients
  add column if not exists birth_month smallint;
alter table public.clients
  add column if not exists birth_day smallint;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'clients_birth_month_range'
  ) then
    alter table public.clients
      add constraint clients_birth_month_range
      check (birth_month is null or birth_month between 1 and 12);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'clients_birth_day_range'
  ) then
    alter table public.clients
      add constraint clients_birth_day_range
      check (birth_day is null or birth_day between 1 and 31);
  end if;
end $$;

-- ── 3. The stamps ──────────────────────────────────────────────────────
-- Birthday is stamped with a YEAR, not a timestamp: the question the cron
-- asks is "has this client had their greeting THIS year", and a year answers
-- it exactly. A timestamp would need date arithmetic to say the same thing.
alter table public.clients
  add column if not exists birthday_email_year smallint;

-- Win-back is a timestamp, because it repeats: a client who comes back and
-- then drifts again is eligible again. The rule is "sent before their last
-- appointment" rather than "never sent".
alter table public.clients
  add column if not exists winback_sent_at timestamptz;

-- ── 4. What a booking actually had taken off it ────────────────────────
-- Recorded on the booking rather than only deducted, so the confirmation can
-- say so, the reports still add up, and a cancelled appointment can hand the
-- credit back rather than swallowing it.
alter table public.bookings
  add column if not exists discount_amount numeric(7,2) not null default 0;
alter table public.bookings
  add column if not exists discount_reason text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bookings_discount_amount_positive'
  ) then
    alter table public.bookings
      add constraint bookings_discount_amount_positive check (discount_amount >= 0);
  end if;
end $$;

-- ── 5. Indexes the two new cron passes need ────────────────────────────
create index if not exists idx_clients_birth_month
  on public.clients (birth_month)
  where birth_month is not null;

create index if not exists idx_clients_credit
  on public.clients (id)
  where credit_amount > 0;

-- ── 6. What a tag and a birthday are worth ─────────────────────────────
-- Seeded once. Existing values are left alone, so changing them in Admin →
-- Settings survives this migration being run again.
insert into public.settings (key, value) values
  ('referral_credit_amount', '10'),
  ('birthday_credit_amount', '15')
on conflict (key) do nothing;

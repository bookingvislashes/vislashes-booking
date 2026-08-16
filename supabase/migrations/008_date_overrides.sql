-- ============================================================
-- VIS Lashes — Per-date hours overrides
-- Run this in the Supabase SQL Editor AFTER 001 through 007.
--
-- MOSTLY SAFE TO RE-RUN: sections 1 and 3 check for their own existence, the
-- same as 001. Section 2 adds constraints to an EXISTING table and can fail
-- against data that already violates them, like 002 — run its audit query
-- first and fix anything it returns.
--
-- WHY THIS EXISTS
--
-- `availability` is recurring-weekly and carries `unique (day_of_week)`, so
-- there is exactly one window per weekday and no way to say anything about a
-- single date. `blocked_dates` can only SUBTRACT from that window. Together
-- they can shorten a day but never lengthen one: there was no way to say "open
-- late this Saturday" or "open 12-4 on a day I'm normally closed".
--
-- This adds one row per date that REPLACES the weekday window for that date —
-- either closing it outright or giving it its own hours. Blocked ranges still
-- subtract from whichever window wins, so "open 10-6 on Tuesday but not
-- 1-2 for lunch" is a date override plus a partial block.
--
-- This migration adds NO hours, NO closures and NO business details. Both
-- tables are left exactly as they are; the salon owner sets every value
-- herself in Admin -> Calendar.
-- ============================================================


-- ------------------------------------------------------------
-- 1. PER-DATE HOURS
--
-- One row per date, at most. `is_open = false` closes the date regardless of
-- its weekday hours. `is_open = true` supplies the window for that date and
-- both times are then required.
--
-- No public SELECT policy: /api/availability reads this with the service-role
-- client, and the admin writes it through an authenticated route. Nothing in
-- the browser needs it directly.
-- ------------------------------------------------------------

create table if not exists public.date_overrides (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  is_open boolean not null default true,
  start_time time,
  end_time time,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Closed days carry no window; open days must carry a complete, ordered one.
  -- Without this a row could say is_open with a null start_time, which the
  -- slot engine would read as "open from undefined", producing either no slots
  -- or a full day of them depending on where the null landed.
  constraint date_overrides_window_check check (
    (is_open = false and start_time is null and end_time is null)
    or
    (is_open = true and start_time is not null and end_time is not null
     and start_time < end_time)
  )
);

create index if not exists idx_date_overrides_date
  on public.date_overrides (date);

alter table public.date_overrides enable row level security;

drop policy if exists "Admin manage date_overrides" on public.date_overrides;
create policy "Admin manage date_overrides" on public.date_overrides
  for all using (auth.role() = 'authenticated');


-- ------------------------------------------------------------
-- 2. TIGHTEN blocked_dates
--
-- These columns have been nullable and unvalidated since 001. A row with
-- start_time set and end_time null makes the slot engine compare against
-- `undefined`, which silently matches nothing — the block exists in the table
-- and does nothing on the booking page.
--
-- AUDIT FIRST — this must return zero rows:
--
--   select id, date, start_time, end_time from public.blocked_dates
--   where (start_time is null) <> (end_time is null)
--      or (start_time is not null and end_time is not null
--          and start_time >= end_time);
--
-- Anything it returns is a half-written or backwards block. Decide whether it
-- was meant to be a whole day (set both to null) or a range (set both), then
-- re-run the audit before continuing.
-- ------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'blocked_dates_pair_check'
  ) then
    alter table public.blocked_dates
      add constraint blocked_dates_pair_check
      check ((start_time is null) = (end_time is null));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'blocked_dates_order_check'
  ) then
    alter table public.blocked_dates
      add constraint blocked_dates_order_check
      check (
        start_time is null or end_time is null or start_time < end_time
      );
  end if;
end $$;


-- ------------------------------------------------------------
-- 3. KEEP updated_at HONEST
--
-- The admin edits a date's hours repeatedly; without this the column would
-- record only when the row was first written.
-- ------------------------------------------------------------

create or replace function public.touch_date_overrides_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_date_overrides_updated_at on public.date_overrides;
create trigger trg_date_overrides_updated_at
  before update on public.date_overrides
  for each row execute function public.touch_date_overrides_updated_at();

-- ============================================================
-- VIS Lashes — Google Calendar connection
-- Run this in the Supabase SQL Editor AFTER 001–005.
--
-- SAFE TO RUN REPEATEDLY: every statement checks for its own existence first.
-- ============================================================

-- The stored refresh token is a long-lived credential: anyone holding it can
-- read and write the salon's calendar until it is revoked.
--
-- md/CALENDAR_SYNC.md proposed keeping it in the `settings` table. That table
-- carries `create policy "Public read settings" ... using (true)` so the
-- booking page can read buffer_minutes with the anon key — which means every
-- row in it is readable by any visitor. A refresh token there would be
-- published to the internet.
--
-- This table instead has RLS enabled and NO policies at all. That denies every
-- request made with the anon or authenticated key, including from the admin
-- browser. Only the service_role key bypasses RLS, so the token can be used
-- exclusively by server code. The admin UI reads connection *status* through
-- /api/google/status rather than querying the table.
create table if not exists public.google_calendar_connection (
  id uuid primary key default gen_random_uuid(),
  -- One salon, one calendar. The unique constant column makes a second row
  -- impossible rather than merely unexpected.
  singleton boolean not null default true unique check (singleton),
  google_email text,
  calendar_id text not null default 'primary',
  refresh_token text not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.google_calendar_connection enable row level security;

-- Deliberately no policies. Do not add one without re-reading the note above.
-- Grants are withheld from anon/authenticated for the same reason.
grant select, insert, update, delete on public.google_calendar_connection to service_role;

-- Lets a cancelled or rescheduled booking find and remove its calendar event.
-- Null for anything booked before the calendar was connected, which the sync
-- code treats as "nothing to clean up" rather than an error.
alter table public.bookings
  add column if not exists google_event_id text;

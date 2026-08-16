-- ============================================================
-- VIS Lashes — Reminder tracking and cancellation reasons
-- Run this in the Supabase SQL Editor AFTER 001–006.
--
-- SAFE TO RUN REPEATEDLY: both columns are added conditionally.
-- ============================================================

-- Stamped once a 24-hour reminder has actually been sent for a booking.
--
-- This is what makes /api/reminders safe to run more than once. Vercel can
-- retry a cron invocation, and the endpoint is reachable by URL, so without a
-- record of what has already gone out a customer could be emailed the same
-- reminder repeatedly. The cron selects only rows where this is null.
alter table public.bookings
  add column if not exists reminder_sent_at timestamptz;

-- Partial index matching exactly what the daily run queries.
create index if not exists bookings_pending_reminder_idx
  on public.bookings (booking_date)
  where status = 'confirmed' and reminder_sent_at is null;

-- Why an appointment was cancelled, when the admin gives a reason. Free text
-- rather than an enum: the useful reasons are the ones nobody predicted, and
-- this is read by a person, never branched on by code.
alter table public.bookings
  add column if not exists cancellation_reason text;

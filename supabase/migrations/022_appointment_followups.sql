-- ============================================================
-- VIS Lashes — Appointment follow-ups
--
-- SAFE TO RUN REPEATEDLY: adds one nullable column and one index, both
-- guarded by IF NOT EXISTS. Nothing is written, moved or deleted.
--
-- Two days after an appointment the site emails the client to check in:
-- aftercare, when to book a fill, and a nudge to tag or recommend her. It
-- runs off the same daily cron as the reminders (/api/reminders).
--
-- This column is what stops it going out twice. It is stamped only once a
-- send has actually resolved, so an outage retries on the next run rather
-- than silently marking everyone as followed up — the same contract the two
-- reminder_* columns use.
--
-- Existing bookings are left NULL on purpose. Backfilling them as "sent"
-- would be a lie, and backfilling them as unsent would email every client
-- from the entire history on the next cron run. NULL plus the two-day window
-- in the route means only appointments from here on are ever picked up.
-- ============================================================

alter table public.bookings
  add column if not exists followup_sent_at timestamptz;

comment on column public.bookings.followup_sent_at is
  'When the two-day post-appointment follow-up email was sent. NULL means not yet.';

-- The cron asks one question: which bookings on this date still need one.
-- Partial, so it only carries the rows that are actually still outstanding.
create index if not exists idx_bookings_followup_pending
  on public.bookings (booking_date)
  where followup_sent_at is null;

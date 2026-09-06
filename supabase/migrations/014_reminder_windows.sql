-- ============================================================
-- VIS Lashes — Two reminder windows instead of one
--
-- SAFE TO RUN REPEATEDLY: adds columns if they are missing.
--
-- She asked for the two reminders Acuity sent: one two days before the
-- appointment, one two hours before. A single `reminder_sent_at` cannot
-- express that — once it is stamped, the second reminder is suppressed — so
-- each window gets its own stamp.
--
-- `reminder_sent_at` is left in place and is no longer written to. It records
-- which bookings already got the old 24-hour email, so nobody who has had one
-- receives a duplicate when the new windows take over.
-- ============================================================

alter table public.bookings
  add column if not exists reminder_2day_sent_at timestamptz;

alter table public.bookings
  add column if not exists reminder_2hour_sent_at timestamptz;

comment on column public.bookings.reminder_2day_sent_at is
  'Set once the two-days-before reminder has gone out. Null means still due.';

comment on column public.bookings.reminder_2hour_sent_at is
  'Set once the two-hours-before reminder has gone out. Only fires if the '
  'reminders cron runs more often than daily.';

comment on column public.bookings.reminder_sent_at is
  'Legacy: the single 24-hour reminder, replaced by the two columns above. '
  'Kept so bookings that already received one are not reminded twice.';

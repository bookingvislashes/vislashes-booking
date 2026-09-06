-- ============================================================
-- VIS Lashes — SMS opt-out
--
-- SAFE TO RUN REPEATEDLY: adds one column if it is missing.
--
-- US carriers require that a person can stop appointment texts by replying
-- STOP, and Twilio honours that for us — once someone opts out, every further
-- message to that number is rejected with error 21610 rather than delivered.
--
-- Without somewhere to record it, the site would keep trying on every run,
-- burning a request and logging a failure for a person who has already made
-- their choice. Worse, a failed SMS would look identical to an outage.
--
-- So when Twilio reports 21610, that client is flagged here and never texted
-- again. Their email reminders are unaffected: opting out of texts is not
-- opting out of the appointment.
-- ============================================================

alter table public.clients
  add column if not exists sms_opt_out boolean not null default false;

comment on column public.clients.sms_opt_out is
  'True once this person replied STOP. Set automatically from Twilio error 21610; never texted again. Does not affect email.';

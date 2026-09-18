-- ============================================================
-- VIS Lashes — explicit SMS consent
--
-- SAFE TO RUN REPEATEDLY: adds two columns if they are missing.
--
-- Twilio's A2P 10DLC campaign guide is explicit that consent to be texted
-- must be voluntary and separate:
--
--   "If customers have to opt-in to messaging to complete a purchase or
--    create an account, your registration will be rejected."
--   "Consent controls (checkboxes, toggles) must be blank or off by default."
--
-- Until now the booking form required a phone number and treated entering it
-- as agreement to be texted. That is the pattern the guide lists as failing.
-- The form now carries a separate, optional, unticked checkbox, and this is
-- where the answer is recorded.
--
-- Nobody is texted without a true here. The default is false, which is the
-- correct and conservative answer for every client already in the table: they
-- were never asked, so they have not agreed. No text has ever been sent from
-- this site — the Twilio credentials are not set — so this takes nothing away
-- from anyone.
--
-- This is consent, which is separate from sms_opt_out in 019. Consent is the
-- yes given at booking; opt-out is a later STOP that overrides it. A person
-- is texted only when sms_consent is true AND sms_opt_out is false.
-- ============================================================

alter table public.clients
  add column if not exists sms_consent boolean not null default false;

alter table public.clients
  add column if not exists sms_consent_at timestamptz;

comment on column public.clients.sms_consent is
  'True only if this person ticked the optional SMS box on the booking form. Never texted without it. Separate from sms_opt_out, which is a later STOP.';

comment on column public.clients.sms_consent_at is
  'When consent was given. Kept because carriers can ask a sender to evidence the opt-in for a specific number.';

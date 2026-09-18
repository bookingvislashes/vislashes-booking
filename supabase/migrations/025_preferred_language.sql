-- ============================================================
-- VIS Lashes — preferred language for appointment texts
--
-- SAFE TO RUN REPEATEDLY: adds one column if it is missing.
--
-- Some clients would rather hear from the salon in Spanish. The booking form
-- now has an optional box for it, and this is where the answer lives.
--
-- Only the text messages change. The website, the confirmation emails and
-- the admin stay in English for now: translating those is a much larger job
-- than translating four short messages, and half-translating a booking flow
-- is worse than not translating it.
--
-- Defaults to 'en', which is the right answer for every client already in
-- the table. They were never asked, and English is what they have been
-- receiving.
--
-- The check constraint is deliberate. This column decides which of two
-- message bodies a person receives, and a typo'd value would fall through to
-- English silently — which is the failure you would not notice, because the
-- message still sends and still reads fine to everyone except the one person
-- it was wrong for.
-- ============================================================

alter table public.clients
  add column if not exists preferred_language text not null default 'en';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'clients_preferred_language_check'
  ) then
    alter table public.clients
      add constraint clients_preferred_language_check
      check (preferred_language in ('en', 'es'));
  end if;
end $$;

comment on column public.clients.preferred_language is
  'Language for this client''s appointment texts: en or es. Set from the optional box on the booking form, or by the salon on the client profile. Emails and the website are English regardless.';

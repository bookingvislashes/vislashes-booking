-- ============================================================
-- VIS Lashes — grant anonymous visitors the read access the RLS
-- policies already promised them
--
-- 001_initial_schema.sql created "Public read services" and "Public read
-- settings" as `for select using (true))` — meant to work for a first-time
-- visitor on /book who has never logged in and carries no session. But a
-- Postgres RLS policy is a second gate on top of the base table GRANT, and
-- the anon role was never actually given SELECT on either table — only
-- service_role and authenticated were, when an earlier permission fix
-- (for the admin's "permission denied for table services" error) was
-- applied by hand outside of any migration.
--
-- The result: every anonymous visit to /book ran on a hardcoded demo menu
-- instead of the real one, because the real fetch returned nothing and the
-- code fell back silently. Picking a service and a date then failed
-- outright, since the fallback's fake IDs ("svc-classic", etc.) aren't
-- valid UUIDs against the real services table — which is why the calendar
-- showed no time slots, and why a real payment could not have gone through
-- either (the payment route looks the service up by that same fake ID).
--
-- Safe to run repeatedly.
-- ============================================================

grant select on public.services to anon;
grant select on public.settings to anon;

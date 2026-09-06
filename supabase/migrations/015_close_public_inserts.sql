-- ============================================================
-- VIS Lashes — Close the public insert policies
--
-- SAFE TO RUN REPEATEDLY: drops policies if they exist.
--
-- WHAT THIS CLOSES
--
-- 001 gave bookings, clients, intake_forms and agreements a "Public insert"
-- policy with `with check (true)`, because the original booking form wrote
-- straight to PostgREST from the browser. That form is gone: /api/bookings was
-- retired for exactly this reason ("a public POST does not need a form"), and
-- every write now happens in lib/create-booking.ts through the service role.
--
-- The policies outlived the code. The anon key ships in the JavaScript bundle,
-- so anyone who opened devtools could POST directly to PostgREST and insert a
-- row with status 'confirmed' and deposit_paid = true — holding a slot on the
-- calendar, appearing in the admin as a real booking, with no card charged and
-- no Square payment behind it. Same for a fabricated signed agreement.
--
-- The service role bypasses RLS entirely, so dropping these changes nothing
-- about how the site books an appointment. Verified before writing this:
-- nothing in app/, components/ or lib/ inserts into these four tables with a
-- browser or anon client.
--
-- Admin reads and updates are untouched — they are separate policies keyed on
-- auth.role() = 'authenticated'.
-- ============================================================

drop policy if exists "Public insert bookings" on public.bookings;
drop policy if exists "Public insert clients" on public.clients;
drop policy if exists "Public insert intake_forms" on public.intake_forms;
drop policy if exists "Public insert agreements" on public.agreements;

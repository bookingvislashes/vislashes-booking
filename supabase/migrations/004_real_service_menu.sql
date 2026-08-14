-- ============================================================
-- VIS Lashes — Replace the placeholder menu with the real one
-- Run this in the Supabase SQL Editor AFTER 001, 002 and 003.
--
-- SAFE TO RUN REPEATEDLY: every step checks for its own existence or matches
-- by name before acting, same as 001.
--
-- What this does, and why it does NOT delete anything:
--   1. Widens services.category to allow 'lift' (a lash lift/tint has no
--      extensions — it is a different kind of appointment, not a lighter
--      full set, so it is not folded into 'full_set').
--   2. Archives the placeholder services from 001's original seed
--      (Natural Glam, Premium Wispy Glam, ...) by setting is_active = false.
--      They are not deleted: bookings.service_id references these rows, and
--      deleting them would either fail against that foreign key or, worse,
--      silently break the booking history of any real appointment already
--      made against a placeholder name. Deactivating removes them from the
--      customer booking flow (app/book/page.tsx filters on is_active) while
--      keeping every past booking's Service column intact.
--   3. Adds the four real services — Classic Set, Wispy Set, Hybrid Set, Lash
--      Lift — matched by name so this is safe to run twice: a second run
--      updates the same four rows in place instead of duplicating them.
--
-- OPTIONAL — see what is about to change before running the rest of this
-- file:
--
--   select name, category, price, is_active from public.services
--   order by sort_order;
-- ============================================================


-- 1. Allow 'lift' as a category.
-- Postgres names an inline `check` constraint '<table>_<column>_check' by
-- default, which is what 001 produced — drop and recreate rather than
-- guessing whether it is already correct.
alter table public.services drop constraint if exists services_category_check;
alter table public.services add constraint services_category_check
  check (category in ('full_set', 'refill', 'lift'));


-- 2. Archive the placeholder menu. Matched by name, not deleted — see above.
update public.services
set is_active = false
where name in (
  'Natural Glam',
  'Premium Wispy Glam',
  'Premium Wispy Glam (Custom)',
  'Natural Glam Refill',
  'Premium Wispy Glam Refill',
  'Premium Wispy Glam Refill (Custom)'
);


-- 3. The real menu. deposit_amount is set only when a service is newly
-- inserted — if a row with this name already exists, its deposit is left
-- alone rather than overwritten, since that value is managed independently
-- from Settings → Deposit and this migration should not fight that control.
do $$
declare
  v_id uuid;
begin
  select id into v_id from public.services where name = 'Classic Set';
  if v_id is not null then
    update public.services set
      category = 'full_set',
      price = 85.00,
      duration_minutes = 70,
      description = 'Wake up to naturally defined lashes every day. Clean, flutter-worthy, and never overdone. Perfect for first-timers or anyone wanting effortless polish without the drama. One extension per natural lash — your eyes, enhanced.',
      is_active = true,
      sort_order = 1
    where id = v_id;
  else
    insert into public.services (name, category, price, deposit_amount, duration_minutes, description, sort_order)
    values ('Classic Set', 'full_set', 85.00, 25.00, 70, 'Wake up to naturally defined lashes every day. Clean, flutter-worthy, and never overdone. Perfect for first-timers or anyone wanting effortless polish without the drama. One extension per natural lash — your eyes, enhanced.', 1);
  end if;

  select id into v_id from public.services where name = 'Wispy Set';
  if v_id is not null then
    update public.services set
      category = 'full_set',
      price = 100.00,
      duration_minutes = 80,
      description = 'Feathery, dimensional, and a little bit editorial. The "I woke up like this" lash — fluffy enough to be noticed, soft enough to be effortless. If you want lashes that photograph beautifully, this is your style.',
      is_active = true,
      sort_order = 2
    where id = v_id;
  else
    insert into public.services (name, category, price, deposit_amount, duration_minutes, description, sort_order)
    values ('Wispy Set', 'full_set', 100.00, 25.00, 80, 'Feathery, dimensional, and a little bit editorial. The "I woke up like this" lash — fluffy enough to be noticed, soft enough to be effortless. If you want lashes that photograph beautifully, this is your style.', 2);
  end if;

  select id into v_id from public.services where name = 'Hybrid Set';
  if v_id is not null then
    update public.services set
      category = 'full_set',
      price = 110.00,
      duration_minutes = 90,
      description = 'Our most-requested style. Fuller than Classic, softer than full Volume — the sweet spot. Half classic extensions, half wispy fans, all gorgeous. Looks just as good in real life as it does in photos.',
      is_active = true,
      sort_order = 3
    where id = v_id;
  else
    insert into public.services (name, category, price, deposit_amount, duration_minutes, description, sort_order)
    values ('Hybrid Set', 'full_set', 110.00, 25.00, 90, 'Our most-requested style. Fuller than Classic, softer than full Volume — the sweet spot. Half classic extensions, half wispy fans, all gorgeous. Looks just as good in real life as it does in photos.', 3);
  end if;

  select id into v_id from public.services where name = 'Lash Lift';
  if v_id is not null then
    update public.services set
      category = 'lift',
      price = 70.00,
      duration_minutes = 60,
      description = 'No extensions. No fills. Just your own lashes, lifted and tinted to look impossibly long and curled for 6-8 weeks straight. Zero maintenance, maximum impact. Perfect between extension sets or on its own.',
      is_active = true,
      sort_order = 4
    where id = v_id;
  else
    insert into public.services (name, category, price, deposit_amount, duration_minutes, description, sort_order)
    values ('Lash Lift', 'lift', 70.00, 25.00, 60, 'No extensions. No fills. Just your own lashes, lifted and tinted to look impossibly long and curled for 6-8 weeks straight. Zero maintenance, maximum impact. Perfect between extension sets or on its own.', 4);
  end if;
end $$;

-- ============================================================
-- VIS Lashes — Refills, lash removal, photo framing, client import
-- Run this in the Supabase SQL Editor AFTER 001–009.
--
-- SAFE TO RUN REPEATEDLY: every statement checks for its own existence first,
-- and the refill rows below are matched by name so a second run updates them
-- in place rather than duplicating the menu.
-- ============================================================


-- ------------------------------------------------------------
-- 1. PHOTO FRAMING AND STORAGE
--
-- 009 already adds services.image_url, so this does not repeat it.
--
-- image_focus_y is the vertical centre of the crop, as a percentage. The card
-- image is a short letterbox and the salon's photos are full-face portraits,
-- so a fixed centre crop lands on a nose. This lets each service be nudged
-- onto the eyes, which is the whole point of the photo.
--
-- The bucket exists because 009 expects a path or a URL to be typed in, and
-- the photos in question are on her phone. Uploading from the admin is the
-- only route that does not need a developer in the middle.
-- ------------------------------------------------------------
alter table public.services add column if not exists image_focus_y smallint not null default 50;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'services_image_focus_y_range'
  ) then
    alter table public.services
      add constraint services_image_focus_y_range
      check (image_focus_y between 0 and 100);
  end if;
end $$;

-- Storage for those photos. Public read: these are marketing images shown to
-- anyone on the booking page. Writes are restricted to a signed-in admin.
insert into storage.buckets (id, name, public)
values ('service-photos', 'service-photos', true)
on conflict (id) do nothing;

drop policy if exists "Public read service photos" on storage.objects;
create policy "Public read service photos" on storage.objects
  for select using (bucket_id = 'service-photos');

drop policy if exists "Admin write service photos" on storage.objects;
create policy "Admin write service photos" on storage.objects
  for all
  using (bucket_id = 'service-photos' and auth.role() = 'authenticated')
  with check (bucket_id = 'service-photos' and auth.role() = 'authenticated');


-- ------------------------------------------------------------
-- 2. LASH REMOVAL AS AN ADD-ON
--
-- Not a service row: a removal is never booked on its own, it is attached to
-- a set. As a service it would appear in the menu as something bookable by
-- itself, and the slot generator would size the appointment as a removal
-- rather than a set-plus-removal.
-- ------------------------------------------------------------
alter table public.bookings add column if not exists has_removal boolean not null default false;

-- Price and length live in settings so they are editable without a developer.
-- 25.00 / 30 minutes as confirmed by the salon owner.
insert into public.settings (key, value) values
  ('removal_price', '25.00'),
  ('removal_duration_minutes', '30')
on conflict (key) do nothing;


-- ------------------------------------------------------------
-- 3. CLIENT IMPORT COLUMNS
--
-- The Acuity export carries 159 clients, of whom 47 have no email address and
-- 2 have no phone. Both columns are currently NOT NULL, which would drop those
-- 47 real regulars entirely — and since refills unlock by matching a returning
-- client, dropping them would lock them out of the very thing this is for.
--
-- Postgres allows many NULLs under a UNIQUE constraint, so the uniqueness of
-- real email addresses is unaffected.
-- ------------------------------------------------------------
alter table public.clients alter column email drop not null;
alter table public.clients alter column phone drop not null;

-- Acuity keeps free-text notes per client; they are worth carrying over rather
-- than leaving behind in a system she is migrating off.
alter table public.clients add column if not exists notes text;

-- Marks rows that came from the Acuity export rather than a booking on this
-- site, so an import can be identified (and re-run) without guesswork.
alter table public.clients add column if not exists imported_from text;

-- Phone is how the 47 email-less clients will identify themselves, so it needs
-- to be searchable. Digits only, because people type numbers a dozen ways.
create index if not exists clients_phone_digits_idx
  on public.clients (regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'));


-- ------------------------------------------------------------
-- 4. THE REFILL MENU
--
-- Names, prices and durations are taken from the salon's live Acuity page and
-- confirmed by her; the deposit matches every other service at $25.
--
-- This is a data insert in a migration, which this project otherwise forbids —
-- see CLAUDE.md. The same justification as 004 applies: 004 archived the
-- placeholder refills and added no replacements, so returning clients have had
-- nowhere to book since. Matched by name and inserted only when absent, so
-- anything she edits in Services afterwards is never overwritten.
-- ------------------------------------------------------------
do $$
declare
  v_id uuid;
begin
  select id into v_id from public.services where name = 'Classic Set Refill';
  if v_id is null then
    insert into public.services (name, category, price, deposit_amount, duration_minutes, description, sort_order, is_active)
    values ('Classic Set Refill', 'refill', 45.00, 25.00, 60, 'Keeps your Classic Set looking freshly done. For lashes applied by VIS Lashes.', 5, true);
  end if;

  select id into v_id from public.services where name = 'Wispy Set Refill';
  if v_id is null then
    insert into public.services (name, category, price, deposit_amount, duration_minutes, description, sort_order, is_active)
    values ('Wispy Set Refill', 'refill', 60.00, 25.00, 60, 'Tops up the fans and keeps the texture soft. For lashes applied by VIS Lashes.', 6, true);
  end if;

  select id into v_id from public.services where name = 'Hybrid Set Refill';
  if v_id is null then
    insert into public.services (name, category, price, deposit_amount, duration_minutes, description, sort_order, is_active)
    values ('Hybrid Set Refill', 'refill', 65.00, 25.00, 90, 'Rebalances the classic and wispy mix as it grows out. For lashes applied by VIS Lashes.', 7, true);
  end if;
end $$;

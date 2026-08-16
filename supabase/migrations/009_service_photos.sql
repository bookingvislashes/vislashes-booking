-- ============================================================
-- VIS Lashes — A photo for each service
-- Run this in the Supabase SQL Editor AFTER 001 through 008.
--
-- SAFE TO RUN REPEATEDLY: the one statement checks for its own existence.
--
-- The booking page has always had a photo slot on each service card — it just
-- rendered a flat tan block, because there was nowhere for a picture to live.
-- ServiceSelector's Service type has carried `image_url` since it was written;
-- this is the column it was waiting for.
--
-- This migration adds the COLUMN only. It sets no photo on any service, the
-- same as it sets no name, price or duration: the salon owner picks each one
-- herself in Admin -> Services, and a migration that filled them in would be
-- overwriting a decision she had not made yet.
-- ============================================================

alter table public.services
  add column if not exists image_url text;

comment on column public.services.image_url is
  'Photo shown on the booking page service card. Either a path inside the site (/images/services/classic-set.jpg) or a full https URL. Null renders the plain tan placeholder.';

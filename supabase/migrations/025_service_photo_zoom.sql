-- ============================================================
-- VIS Lashes — Horizontal position and zoom for service photos
-- Run this in the Supabase SQL Editor AFTER 001 through 024.
--
-- SAFE TO RUN REPEATEDLY: the columns check for their own existence, and the
-- calibration below is a plain UPDATE by name, which just sets the same
-- values again on a re-run.
--
-- 009/010 added image_url and image_focus_y (vertical crop centre only) — a
-- fixed 50% horizontal centre was fine while every photo was two eyes facing
-- the camera. It fell apart for photos where the eyes aren't horizontally
-- centred (a profile shot) or where the natural object-cover crop leaves
-- visible margin on both sides instead of running the eyes to the edges.
--
-- image_focus_x is the horizontal twin of image_focus_y. image_zoom scales
-- the photo in around BOTH focus points (a percentage, 100 = the plain
-- object-cover fit, same as today), so the crop can tighten past what
-- object-cover alone can reach.
-- ============================================================

alter table public.services
  add column if not exists image_focus_x smallint not null default 50;

alter table public.services
  add column if not exists image_zoom smallint not null default 100;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'services_image_focus_x_range'
  ) then
    alter table public.services
      add constraint services_image_focus_x_range
      check (image_focus_x between 0 and 100);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'services_image_zoom_range'
  ) then
    alter table public.services
      add constraint services_image_zoom_range
      check (image_zoom between 100 and 300);
  end if;
end $$;

-- ------------------------------------------------------------
-- Calibration for the four photos on the booking page today, so the crop
-- fix ships without a second trip through Admin -> Services. Requested
-- directly, in place of using the sliders herself: bring the eyes on
-- Classic, Wispy and Hybrid out to the edges of the frame the way Wispy's
-- already read, and reframe the Lash Lift photo (a profile angle, where one
-- eye is nearly cropped out) onto its one clearly-visible eye instead.
--
-- Read from a screenshot of the live page, not the source photos, so treat
-- these as a close first pass — nudge with the Position/Zoom sliders on any
-- card that isn't quite right and save; that always wins over this.
-- ------------------------------------------------------------
update public.services set image_focus_x = 50, image_focus_y = 32, image_zoom = 127 where name = 'Classic Set';
update public.services set image_focus_x = 57, image_focus_y = 43, image_zoom = 130 where name = 'Wispy Set';
update public.services set image_focus_x = 52, image_focus_y = 42, image_zoom = 145 where name = 'Hybrid Set';
update public.services set image_focus_x = 68, image_focus_y = 30, image_zoom = 180 where name = 'Lash Lift';

comment on column public.services.image_focus_x is
  'Horizontal crop centre as a percentage, the twin of image_focus_y. Matters once image_zoom moves past 100, or on a photo where the eyes are not centred left-to-right (a profile angle).';

comment on column public.services.image_zoom is
  'How far the photo is scaled in around (image_focus_x, image_focus_y), as a percentage. 100 is the plain object-cover fit used before this column existed; higher tightens the crop toward that point.';

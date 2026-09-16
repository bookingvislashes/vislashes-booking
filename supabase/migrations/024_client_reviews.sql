-- ============================================================
-- VIS Lashes — Client reviews
--
-- SAFE TO RUN REPEATEDLY: creates a table, its policies and its grants only.
--
-- The follow-up email two days after an appointment now offers a link to
-- leave a review. What comes back lands here, and what the home page shows
-- is drawn from this table rather than from a hardcoded list.
--
-- WHO CAN LEAVE ONE. Only someone holding a signed link for a real
-- appointment, and only once per appointment — that is the unique index
-- below. There is no open review form, so this is not a target for spam the
-- way a public one would be.
--
-- WHAT GETS SHOWN. `status` is the whole of it. Four and five star reviews
-- are published on arrival; anything lower is stored as private feedback and
-- is never publishable from the admin at all. She can hide a published one at
-- any time. The site is her shop window, not a review platform — but a low
-- rating is still worth having, because it tells her something before the
-- client tells everyone else.
-- ============================================================

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),

  -- Both nullable and both ON DELETE SET NULL: a review outlives the
  -- appointment it came from, and removing an old booking must not silently
  -- delete a quote that is on the home page.
  booking_id uuid references public.bookings(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,

  -- Denormalised, for the same reason appointment_history denormalises: the
  -- quote has to keep reading correctly if the client row is later renamed
  -- or removed. Only the first name is ever rendered.
  client_name text not null,

  rating smallint not null check (rating between 1 and 5),
  comment text,

  -- 'published' is on the home page. 'private' is a low rating, kept for her
  -- eyes only. 'hidden' is something she has taken down.
  status text not null default 'private'
    check (status in ('published', 'private', 'hidden')),

  submitted_at timestamptz not null default now(),
  published_at timestamptz
);

-- One review per appointment. Partial, because booking_id is nullable and
-- several NULLs must not collide.
create unique index if not exists idx_reviews_one_per_booking
  on public.reviews (booking_id)
  where booking_id is not null;

-- What the home page asks for: published, newest first.
create index if not exists idx_reviews_published
  on public.reviews (published_at desc)
  where status = 'published';

alter table public.reviews enable row level security;

-- Anonymous visitors may read PUBLISHED reviews and nothing else. A one-star
-- review and the name attached to it are never reachable from the public
-- site, whatever the query asks for.
drop policy if exists "Public read published reviews" on public.reviews;
create policy "Public read published reviews" on public.reviews
  for select using (status = 'published');

drop policy if exists "Admin manage reviews" on public.reviews;
create policy "Admin manage reviews" on public.reviews
  for all using (auth.role() = 'authenticated');

-- The RLS policy above is a second gate on top of the base grant; without
-- this the anon role has no SELECT at all and the policy never gets a chance
-- to allow anything. This is the mistake migration 011 exists to fix.
grant select on public.reviews to anon;

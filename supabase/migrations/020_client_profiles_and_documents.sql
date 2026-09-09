-- ============================================================
-- VIS Lashes — Client profiles and uploaded forms
-- Run this in the Supabase SQL Editor (or the admin Migrations page)
-- AFTER 001 through 019.
--
-- SAFE TO RUN REPEATEDLY: every statement checks for its own existence.
--
-- Two things:
--
--   1. Somewhere on the client record to keep what she knows about someone —
--      the adhesive that made their eyes water, the style they always ask for.
--      `allergy_note` is deliberately its own column rather than a line inside
--      `notes`: it is the one thing that has to be impossible to miss, so it
--      is shown on Today beside the appointment as well as on the profile.
--
--   2. A home for the consent and medical health forms signed on paper. The
--      salon has years of them on the iPad, and until now the only agreements
--      the admin could show were the ones signed through the booking flow.
--
-- This migration adds COLUMNS, A TABLE and A BUCKET only. It writes no client
-- data and no documents — every form is uploaded by her, against the client
-- she picks.
-- ============================================================


-- ── 1. What she knows about a client ────────────────────────────────────
--
-- `notes` already exists — migration 010 added it to carry the free-text
-- notes out of the Acuity export. Nothing in the app has ever shown it, so
-- whatever came across in that import has been sitting there unread. The
-- profile page now reads and writes it; this only restates what it is for.

alter table public.clients
  add column if not exists allergy_note text;

comment on column public.clients.notes is
  'Her private notes on this client — preferred style, what they talked about, how they pay. Carried over from Acuity by migration 010 and edited on the client profile since 020. Never shown to the client.';

comment on column public.clients.allergy_note is
  'A sensitivity or allergy worth seeing before touching their eyes. Non-empty means "flag this client": it is surfaced on Today and in the client list, not just the profile. Null or blank means nothing to flag.';


-- ── 2. Uploaded forms and other documents ───────────────────────────────
--
-- One row per file. `storage_path` points into the PRIVATE `client-documents`
-- bucket created in section 3 — these are medical health forms, so nothing
-- here is publicly readable and every view goes through a signed URL that
-- expires.
--
-- `signed_on` is a date, not a timestamptz, because it is read off the paper:
-- nobody writes a time next to their signature.

create table if not exists public.client_documents (
  id uuid primary key default gen_random_uuid(),

  client_id uuid not null references public.clients(id) on delete cascade,

  -- Optional. A paper form from 2024 usually belongs to no appointment that
  -- exists in this database, and that is fine.
  booking_id uuid references public.bookings(id) on delete set null,

  kind text not null default 'consent'
    check (kind in ('consent', 'medical', 'other')),

  -- Path inside the private bucket. Not a URL: a URL for one of these is
  -- minted on demand and expires.
  storage_path text not null unique,

  -- What the file was called when she picked it, so a row still reads like
  -- something recognisable in a list.
  file_name text not null,
  mime_type text,
  byte_size integer,

  -- The date on the form itself, in her hand. Null when a form is undated.
  signed_on date,

  note text,

  uploaded_at timestamptz not null default now()
);

-- The profile reads "this client's documents, newest first"; the Agreements
-- page reads "everyone's, newest first". Both are covered here.
create index if not exists client_documents_client_idx
  on public.client_documents (client_id, signed_on desc nulls last);

create index if not exists client_documents_signed_idx
  on public.client_documents (signed_on desc nulls last);

alter table public.client_documents enable row level security;

-- No anon policy of any kind, on purpose. A medical health form is readable
-- only by a signed-in admin session.
drop policy if exists "Admin read client_documents" on public.client_documents;
create policy "Admin read client_documents" on public.client_documents
  for select using (auth.role() = 'authenticated');

drop policy if exists "Admin manage client_documents" on public.client_documents;
create policy "Admin manage client_documents" on public.client_documents
  for all using (auth.role() = 'authenticated');

grant select, insert, update, delete on public.client_documents to authenticated;
grant select, insert, update, delete on public.client_documents to service_role;


-- ── 3. The private bucket the files live in ─────────────────────────────
--
-- `public = false`, unlike `service-photos`. A service photo is meant to be on
-- the booking page; a consent form is meant to be seen by one person. Reading
-- one requires a signed URL, which the admin mints per view and which stops
-- working an hour later.

insert into storage.buckets (id, name, public)
values ('client-documents', 'client-documents', false)
on conflict (id) do nothing;

drop policy if exists "Admin read client documents" on storage.objects;
create policy "Admin read client documents" on storage.objects
  for select using (
    bucket_id = 'client-documents' and auth.role() = 'authenticated'
  );

drop policy if exists "Admin upload client documents" on storage.objects;
create policy "Admin upload client documents" on storage.objects
  for insert with check (
    bucket_id = 'client-documents' and auth.role() = 'authenticated'
  );

drop policy if exists "Admin delete client documents" on storage.objects;
create policy "Admin delete client documents" on storage.objects
  for delete using (
    bucket_id = 'client-documents' and auth.role() = 'authenticated'
  );

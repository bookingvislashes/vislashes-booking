-- ============================================================
-- VIS Lashes — Appointment history from Acuity (2023–2026)
--
-- SAFE TO RUN REPEATEDLY: creates a table and its policies only.
--
-- WHY A SEPARATE TABLE RATHER THAN `bookings`
--
-- These are closed records from the system she is migrating off, and they do
-- not fit `bookings` without damaging it:
--
--   * `bookings.service_id` is NOT NULL and references `services`. The export
--     carries 46 distinct type strings — "Classic Set + Lash Removal",
--     "$75 New Client Special- Any Lash Type!", "Natural Glam (Wet Set)",
--     "Patch Test" — most of which are not on today's menu. Importing them
--     would mean inventing service rows and polluting the live booking page
--     with services she no longer offers.
--   * They would appear in the admin Calendar and Bookings lists alongside
--     live appointments, burying this week's work under three years of it.
--   * They are immutable. Nothing cancels or reschedules a 2023 appointment.
--
-- So history stays here, and the Reports page reads both this table and
-- `bookings` to cover the whole timeline. `client_id` links back where the
-- name matched a row in `clients`, which is what powers each client's real
-- visit count.
--
-- No public policy: nothing in the browser reads this. The admin reads it
-- through the service role, the same way /api/availability reads bookings.
-- ============================================================

create table if not exists public.appointment_history (
  id uuid primary key default gen_random_uuid(),

  -- Acuity's own appointment id. Unique so a re-import updates rather than
  -- duplicating three years of records.
  acuity_id text not null unique,

  appointment_date date not null,
  -- Kept as Acuity wrote it ("5:00 pm") rather than a time column: it is for
  -- reading back, never for scheduling arithmetic.
  start_time text,
  end_time text,

  -- Denormalised on purpose. The name on the appointment is what she saw that
  -- day; a later rename in `clients` must not rewrite history.
  client_name text not null,
  client_phone text,
  client_email text,
  client_id uuid references public.clients(id) on delete set null,

  -- The raw type string from the export, add-ons and all.
  service_type text not null,

  -- What the appointment was worth and what actually arrived. Both are on the
  -- export and they disagree often enough to matter at tax time.
  price numeric(7,2),
  paid boolean not null default false,
  amount_paid_online numeric(7,2),

  -- "Lash Model", "Exchange Service", "Giveaway Winner" — the comped ones.
  label text,

  imported_at timestamptz not null default now()
);

-- Reports filter by date range constantly; nothing else is a hot path.
create index if not exists appointment_history_date_idx
  on public.appointment_history (appointment_date desc);

create index if not exists appointment_history_client_idx
  on public.appointment_history (client_id);

alter table public.appointment_history enable row level security;

drop policy if exists "Admin read appointment_history" on public.appointment_history;
create policy "Admin read appointment_history" on public.appointment_history
  for select using (auth.role() = 'authenticated');

drop policy if exists "Admin manage appointment_history" on public.appointment_history;
create policy "Admin manage appointment_history" on public.appointment_history
  for all using (auth.role() = 'authenticated');

grant select on public.appointment_history to authenticated;
grant select, insert, update, delete on public.appointment_history to service_role;

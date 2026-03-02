-- ============================================================
-- VIS Lashes Booking Site — Full Database Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. SERVICES
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('full_set', 'refill')),
  price numeric(6,2) not null,
  deposit_amount numeric(6,2) not null default 10.00,
  duration_minutes integer not null,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.services enable row level security;
create policy "Public read services" on public.services for select using (true);
create policy "Admin manage services" on public.services for all using (
  auth.role() = 'authenticated'
);

-- Seed default services
insert into public.services (name, category, price, deposit_amount, duration_minutes, description, sort_order) values
  ('Classic Full Set',   'full_set', 50.00, 10.00, 110, 'Natural, elegant look with individual lash extensions', 1),
  ('Hybrid Full Set',    'full_set', 55.00, 10.00, 120, 'Mix of classic and volume for a textured, fuller look', 2),
  ('Volume Full Set',    'full_set', 55.00, 10.00, 120, 'Dramatic, full-bodied fans for maximum impact', 3),
  ('Classic Refill',     'refill',   25.00, 10.00,  60, 'Maintain your classic set with fresh extensions', 4),
  ('Hybrid Refill',      'refill',   30.00, 10.00,  75, 'Touch up your hybrid set for lasting fullness', 5),
  ('Volume Refill',      'refill',   30.00, 10.00,  75, 'Restore your volume set to its full glory', 6);


-- 2. AVAILABILITY (recurring weekly hours)
create table if not exists public.availability (
  id uuid primary key default gen_random_uuid(),
  day_of_week integer not null check (day_of_week between 0 and 6), -- 0=Sun, 6=Sat
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (day_of_week)
);

alter table public.availability enable row level security;
create policy "Public read availability" on public.availability for select using (true);
create policy "Admin manage availability" on public.availability for all using (
  auth.role() = 'authenticated'
);

-- Seed default hours: Mon-Fri 9am-5pm
insert into public.availability (day_of_week, start_time, end_time, is_active) values
  (0, '09:00', '17:00', false), -- Sunday (off)
  (1, '09:00', '17:00', true),  -- Monday
  (2, '09:00', '17:00', true),  -- Tuesday
  (3, '09:00', '17:00', true),  -- Wednesday
  (4, '09:00', '17:00', true),  -- Thursday
  (5, '09:00', '17:00', true),  -- Friday
  (6, '09:00', '17:00', false); -- Saturday (off)


-- 3. BLOCKED DATES
create table if not exists public.blocked_dates (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  start_time time,          -- null = entire day blocked
  end_time time,            -- null = entire day blocked
  reason text,
  created_at timestamptz not null default now()
);

alter table public.blocked_dates enable row level security;
create policy "Public read blocked_dates" on public.blocked_dates for select using (true);
create policy "Admin manage blocked_dates" on public.blocked_dates for all using (
  auth.role() = 'authenticated'
);


-- 4. CLIENTS
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null unique,
  phone text not null,
  visit_count integer not null default 0,
  last_visit_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.clients enable row level security;
create policy "Admin read clients" on public.clients for select using (
  auth.role() = 'authenticated'
);
create policy "Public insert clients" on public.clients for insert with check (true);
create policy "Admin update clients" on public.clients for update using (
  auth.role() = 'authenticated'
);


-- 5. BOOKINGS
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  service_id uuid not null references public.services(id),
  booking_date date not null,
  time_slot text not null,
  status text not null default 'confirmed' check (status in ('confirmed', 'completed', 'cancelled', 'no_show')),
  payment_method text not null check (payment_method in ('stripe', 'apple_pay', 'cash')),
  deposit_paid boolean not null default false,
  deposit_amount numeric(6,2),
  stripe_session_id text,
  stripe_payment_intent_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bookings enable row level security;
create policy "Admin read bookings" on public.bookings for select using (
  auth.role() = 'authenticated'
);
create policy "Public insert bookings" on public.bookings for insert with check (true);
create policy "Admin update bookings" on public.bookings for update using (
  auth.role() = 'authenticated'
);


-- 6. INTAKE FORMS
create table if not exists public.intake_forms (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  client_id uuid not null references public.clients(id),
  has_had_extensions boolean not null,
  is_special_occasion boolean not null default false,
  occasion_details text,
  has_cataracts boolean not null default false,
  has_conjunctivitis boolean not null default false,
  has_dry_eye boolean not null default false,
  has_glaucoma boolean not null default false,
  other_complaints text,
  doctor_name text,
  surgery_notes text,
  medical_acknowledgment boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.intake_forms enable row level security;
create policy "Admin read intake_forms" on public.intake_forms for select using (
  auth.role() = 'authenticated'
);
create policy "Public insert intake_forms" on public.intake_forms for insert with check (true);


-- 7. AGREEMENTS
create table if not exists public.agreements (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  client_id uuid not null references public.clients(id),
  filming_consent boolean not null default false,
  liability_waiver_signed boolean not null default false,
  terms_accepted boolean not null default false,
  signature_data text not null,     -- base64 PNG from canvas
  signed_at timestamptz not null default now()
);

alter table public.agreements enable row level security;
create policy "Admin read agreements" on public.agreements for select using (
  auth.role() = 'authenticated'
);
create policy "Public insert agreements" on public.agreements for insert with check (true);


-- 8. SETTINGS
create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.settings enable row level security;
create policy "Public read settings" on public.settings for select using (true);
create policy "Admin manage settings" on public.settings for all using (
  auth.role() = 'authenticated'
);

-- Seed default settings
insert into public.settings (key, value) values
  ('business_name', 'VIS Lashes'),
  ('buffer_minutes', '15'),
  ('advance_booking_hours', '24'),
  ('max_advance_days', '60'),
  ('business_email', ''),
  ('business_phone', ''),
  ('google_calendar_connected', 'false');


-- 9. Enable Realtime for bookings table
alter publication supabase_realtime add table public.bookings;

-- 10. Indexes for performance
create index idx_bookings_date on public.bookings (booking_date);
create index idx_bookings_client on public.bookings (client_id);
create index idx_bookings_status on public.bookings (status);
create index idx_blocked_dates_date on public.blocked_dates (date);
create index idx_clients_email on public.clients (email);

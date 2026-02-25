# Database Schema — Supabase (PostgreSQL)

## Setup

- Create a free Supabase project at supabase.com
- Run the SQL below in the Supabase SQL Editor
- Enable Row Level Security (RLS) on ALL tables
- Create one admin user via Supabase Auth (email/password)
- Store API keys in `.env.local`

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

## Tables

```sql
-- Services offered
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('full_set', 'refill')),
  price DECIMAL(10,2) NOT NULL,
  deposit_amount DECIMAL(10,2) NOT NULL DEFAULT 10.00,
  duration_minutes INTEGER NOT NULL,
  image_url TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recurring weekly availability
CREATE TABLE availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT true,
  CONSTRAINT valid_time_range CHECK (start_time < end_time)
);
-- day_of_week: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday

-- Blocked dates/times (vacation, personal days, one-off blocks)
CREATE TABLE blocked_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocked_date DATE NOT NULL,
  start_time TIME,         -- NULL = entire day blocked
  end_time TIME,           -- NULL = entire day blocked
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Client records (created on first booking, linked by email on return visits)
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bookings
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  service_id UUID NOT NULL REFERENCES services(id),
  booking_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'completed', 'cancelled', 'no_show')),
  deposit_paid BOOLEAN DEFAULT false,
  deposit_amount DECIMAL(10,2),
  payment_method TEXT CHECK (payment_method IN ('stripe', 'apple_pay', 'paypal', 'cash')),
  stripe_payment_id TEXT,
  stripe_session_id TEXT,
  cancellation_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Intake form responses (one per booking)
CREATE TABLE intake_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  has_had_extensions BOOLEAN,
  is_special_occasion BOOLEAN DEFAULT false,
  occasion_details TEXT,
  -- Medical fields
  has_cataracts BOOLEAN DEFAULT false,
  has_conjunctivitis BOOLEAN DEFAULT false,
  has_dry_eye BOOLEAN DEFAULT false,
  has_glaucoma BOOLEAN DEFAULT false,
  other_complaints TEXT,
  doctor_name TEXT,
  surgery_notes TEXT,
  medical_acknowledgment BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Signed agreements (one per booking)
CREATE TABLE agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  filming_consent BOOLEAN DEFAULT false,
  liability_waiver_signed BOOLEAN NOT NULL DEFAULT false,
  terms_accepted BOOLEAN NOT NULL DEFAULT false,
  signature_data TEXT NOT NULL,          -- Base64 PNG of drawn signature
  signature_pdf_url TEXT,                -- Supabase Storage URL after PDF generated
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT
);

-- App-wide settings (key-value store)
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default settings
INSERT INTO settings (key, value) VALUES
  ('buffer_minutes', '15'),
  ('booking_advance_hours', '24'),
  ('max_advance_days', '60'),
  ('business_name', 'VIS Lashes'),
  ('business_email', ''),
  ('business_phone', ''),
  ('google_calendar_connected', 'false');

-- Indexes for common queries
CREATE INDEX idx_bookings_date ON bookings(booking_date);
CREATE INDEX idx_bookings_client ON bookings(client_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_blocked_dates_date ON blocked_dates(blocked_date);
CREATE INDEX idx_clients_email ON clients(email);
```

## Row Level Security (RLS)

```sql
-- Enable RLS on all tables
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Public read on services (clients need to see these)
CREATE POLICY "Services are viewable by everyone" ON services FOR SELECT USING (true);

-- Public read on availability (clients need to check open slots)
CREATE POLICY "Availability is viewable by everyone" ON availability FOR SELECT USING (true);

-- Public read on blocked_dates (clients need to know which dates are unavailable)
CREATE POLICY "Blocked dates are viewable by everyone" ON blocked_dates FOR SELECT USING (true);

-- Public read on settings (client app needs buffer_minutes, advance hours, etc.)
CREATE POLICY "Settings are viewable by everyone" ON settings FOR SELECT USING (true);

-- Bookings, clients, intake_forms, agreements: 
-- Public INSERT allowed (booking flow creates these via API routes with server-side validation)
-- SELECT/UPDATE/DELETE restricted to authenticated admin
CREATE POLICY "Authenticated users can do everything on clients" ON clients FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Anyone can insert clients" ON clients FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated users can do everything on bookings" ON bookings FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Anyone can insert bookings" ON bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read their own booking by id" ON bookings FOR SELECT USING (true);

CREATE POLICY "Authenticated users can do everything on intake_forms" ON intake_forms FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Anyone can insert intake_forms" ON intake_forms FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated users can do everything on agreements" ON agreements FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Anyone can insert agreements" ON agreements FOR INSERT WITH CHECK (true);

-- Admin-only write on services, availability, blocked_dates, settings
CREATE POLICY "Authenticated users can modify services" ON services FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can modify availability" ON availability FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can modify blocked_dates" ON blocked_dates FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can modify settings" ON settings FOR ALL USING (auth.role() = 'authenticated');
```

## Supabase Storage

Create a storage bucket called `agreements` for signed waiver PDFs.

```sql
-- In Supabase Dashboard > Storage > Create Bucket
-- Name: agreements
-- Public: false (admin-only access via signed URLs)
```

## Availability Calculation Logic

This is the core scheduling algorithm. Used by the `/api/availability` route.

```
For a given date and service_duration_minutes:

1. Get recurring availability for that day_of_week
   → If no active availability row exists, date is unavailable

2. Check if date is in blocked_dates
   → If fully blocked (start_time IS NULL), date is unavailable
   → If partially blocked, subtract blocked time range from available window

3. Get all confirmed bookings for that date
   → Each booking occupies: start_time to end_time + buffer_minutes

4. Generate time slots at 30-minute intervals within the available window
   → For each potential slot:
     - Does the slot + service_duration fit within the available window?
     - Does the slot + service_duration overlap with any existing booking (including buffer)?
     - Is the slot at least booking_advance_hours in the future?
   → If all checks pass, slot is available

5. Return array of available time slot strings (e.g., ["9:00 AM", "10:30 AM", "1:00 PM"])
```

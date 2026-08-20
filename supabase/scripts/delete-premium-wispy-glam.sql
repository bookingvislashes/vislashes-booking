-- ============================================================
-- VIS Lashes — one-time cleanup: remove "Premium Wispy Glam"
--
-- NOT a migration. Do not add this to supabase/migrations — it changes data,
-- not schema, and it is meant to be run exactly once.
--
-- Why this exists: the admin refuses to delete a service that still has
-- appointments attached (bookings.service_id is NOT NULL with no cascade, so
-- Postgres would reject the delete anyway). The salon owner confirmed the
-- appointments on this service are tests and can go.
--
-- DESTRUCTIVE AND IRREVERSIBLE. Run each step in order, in the Supabase SQL
-- Editor, and read the output of STEP 1 before running anything else.
-- ============================================================


-- ------------------------------------------------------------
-- STEP 1 — Preview. Run this alone first.
-- Every appointment listed here will be deleted. If any of these is a real
-- client on a real date, STOP: nothing below is undoable.
-- ------------------------------------------------------------
select
  b.booking_date,
  b.time_slot,
  b.status,
  c.full_name  as client,
  c.email      as client_email,
  c.phone      as client_phone,
  b.deposit_paid,
  b.deposit_amount,
  b.square_payment_id
from public.bookings b
join public.services s on s.id = b.service_id
left join public.clients c on c.id = b.client_id
where s.name = 'Premium Wispy Glam'
order by b.booking_date, b.time_slot;


-- ------------------------------------------------------------
-- STEP 2 — Delete those appointments.
-- Their intake forms and signed agreements go with them automatically
-- (both are "on delete cascade" on booking_id). Nothing else references
-- bookings, so this is the whole of it.
-- ------------------------------------------------------------
delete from public.bookings b
using public.services s
where s.id = b.service_id
  and s.name = 'Premium Wispy Glam';


-- ------------------------------------------------------------
-- STEP 3 — Release the payment ledger's hold on the service.
-- orphan_payments.service_id also points at services. It is nullable, so the
-- payment record itself is kept — only the link to the deleted service is
-- cleared, and the Square payment ID stays intact for reconciliation.
-- Usually affects zero rows.
-- ------------------------------------------------------------
update public.orphan_payments
set service_id = null
where service_id in (
  select id from public.services where name = 'Premium Wispy Glam'
);


-- ------------------------------------------------------------
-- STEP 4 — Delete the service.
-- ------------------------------------------------------------
delete from public.services
where name = 'Premium Wispy Glam';


-- ------------------------------------------------------------
-- STEP 5 — Confirm. Should return no rows.
-- ------------------------------------------------------------
select id, name, category, price, is_active
from public.services
where name = 'Premium Wispy Glam';

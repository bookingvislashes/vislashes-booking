-- ============================================================
-- VIS Lashes — Push notification subscriptions
-- Run this in the Supabase SQL Editor AFTER 001 and 002.
--
-- SAFE TO RUN REPEATEDLY, same as 001: every statement checks for its own
-- existence first.
-- ============================================================

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  -- Uniquely identifies one browser's subscription to one installed copy of
  -- the admin. Re-enabling notifications on the same device sends the same
  -- endpoint again, so this is upserted on rather than duplicated.
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

-- Only signed-in staff can register a device or be read back for sending —
-- matches the pattern used for every other admin-only table.
drop policy if exists "Admin manage push_subscriptions" on public.push_subscriptions;
create policy "Admin manage push_subscriptions" on public.push_subscriptions
  for all using (auth.role() = 'authenticated');

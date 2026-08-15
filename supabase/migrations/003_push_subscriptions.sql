-- Web Push subscriptions for admin notifications (new bookings), so staff can
-- be alerted even when the admin app isn't open.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "Admin manage push_subscriptions" on public.push_subscriptions;
create policy "Admin manage push_subscriptions" on public.push_subscriptions for all using (
  auth.role() = 'authenticated'
);

-- Matches the base grants applied by hand for every earlier table in this
-- project (see the 003 fixup run from the CLI) — RLS above is what actually
-- restricts access; this just lets Postgres evaluate it at all.
grant select, insert, update, delete on public.push_subscriptions to authenticated, service_role;
grant usage on schema public to authenticated, service_role;

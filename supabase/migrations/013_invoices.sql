-- ============================================================
-- VIS Lashes — Invoices
--
-- SAFE TO RUN REPEATEDLY: creates a table and its policies only.
--
-- An invoice is a request for money with a link the client can open and pay.
-- Every one is for a deposit, so `amount` is small, but the rule from
-- process-payment applies here without exception: THE SERVER READS THE AMOUNT
-- FROM THIS ROW. Nothing in the browser gets to say what a card is charged.
--
-- `token` is what appears in the client's link (/invoice/<token>). It is the
-- only credential on that page, so it is generated server-side from crypto
-- randomness, never from the id, the client's name or anything guessable.
--
-- No anon policy on purpose. The public invoice page is server-rendered and
-- reads this table through the service role after matching the token, so an
-- anonymous visitor can never list invoices or read one they do not have a
-- link to.
-- ============================================================

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),

  -- Unguessable, unique, and stable for the life of the invoice: she may have
  -- already texted the link.
  token text not null unique,

  -- Optional. An invoice usually belongs to an appointment, but she also needs
  -- to bill someone before a booking exists.
  booking_id uuid references public.bookings(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,

  -- Denormalised so the invoice still reads correctly if the client row is
  -- later renamed or removed, exactly like appointment_history.
  client_name text not null,
  client_email text,
  client_phone text,

  amount numeric(7,2) not null check (amount > 0),
  -- What she is charging for, in her words. Shown to the client.
  description text not null,
  -- Her private note, e.g. "took $20 cash at the appointment". Never shown.
  note text,

  status text not null default 'unpaid'
    check (status in ('unpaid', 'paid', 'void')),

  -- How it got paid. 'card' came through the link; 'manual' is her marking it
  -- settled because cash or Zelle arrived.
  paid_method text check (paid_method in ('card', 'manual')),
  square_payment_id text,
  paid_at timestamptz,

  due_date date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The Invoices list is "unpaid first, newest first"; nothing else is hot.
create index if not exists invoices_status_idx
  on public.invoices (status, created_at desc);

create index if not exists invoices_client_idx
  on public.invoices (client_id);

alter table public.invoices enable row level security;

drop policy if exists "Admin read invoices" on public.invoices;
create policy "Admin read invoices" on public.invoices
  for select using (auth.role() = 'authenticated');

drop policy if exists "Admin manage invoices" on public.invoices;
create policy "Admin manage invoices" on public.invoices
  for all using (auth.role() = 'authenticated');

grant select on public.invoices to authenticated;
grant select, insert, update, delete on public.invoices to service_role;

-- Keep updated_at honest without every route having to remember it.
create or replace function public.set_invoices_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists invoices_updated_at on public.invoices;
create trigger invoices_updated_at
  before update on public.invoices
  for each row execute function public.set_invoices_updated_at();

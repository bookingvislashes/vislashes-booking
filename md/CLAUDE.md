# CLAUDE.md

This is a custom booking web app for VIS Lashes, a lash extension business in Orlando/Kissimmee/Saint Cloud, Florida. It replaces Acuity Scheduling with a fully branded, zero-monthly-cost booking experience.

## Project Overview

- **What**: Full-stack booking app with client-facing booking flow + admin dashboard
- **Who**: Built for a solo lash artist who works from home, manages appointments from her iPhone
- **Why**: Acuity costs $16-33/month and limits design customization. This app costs $0/month (Stripe per-transaction only)
- **Stack**: Next.js 15 (App Router), Supabase (PostgreSQL + Auth + Storage), Stripe, Tailwind CSS, shadcn/ui

## Common Commands

```bash
npm run dev              # Start dev server on localhost:3000
npm run build            # Production build
npm run lint             # ESLint
npx supabase start       # Local Supabase instance
npx supabase db push     # Push schema changes to Supabase
stripe listen --forward-to localhost:3000/api/stripe/webhook  # Test Stripe webhooks locally
```

## Code Style

- TypeScript strict mode, no `any` types
- ES modules only, no CommonJS
- Functional components with hooks, no class components
- Named exports for components, default export only for page.tsx files
- Use `@/` path alias for imports (e.g., `@/components/booking/ServiceSelector`)
- Tailwind CSS for all styling — no CSS modules, no styled-components
- shadcn/ui for base components — always install via `npx shadcn@latest add [component]`
- React Hook Form + Zod for all form handling and validation
- Server Components by default, `"use client"` only when interactivity is needed
- Supabase client: use `createClient` from `@/lib/supabase/client` (browser) or `@/lib/supabase/server` (server)

## Project Structure

```
vis-lashes/
├── app/                    # Next.js App Router pages
│   ├── page.tsx            # Marketing home page
│   ├── book/page.tsx       # Multi-step booking flow (client-facing)
│   ├── confirmation/[bookingId]/page.tsx
│   ├── admin/              # Protected admin dashboard
│   └── api/                # API routes (Stripe, bookings, availability)
├── components/
│   ├── booking/            # Booking flow step components
│   ├── admin/              # Admin dashboard components
│   ├── ui/                 # shadcn/ui primitives
│   └── layout/             # Header, Footer
├── lib/                    # Utilities (supabase, stripe, email, availability logic)
├── public/                 # Static assets, PWA manifest
└── agent_docs/             # Detailed specs — READ BEFORE BUILDING
```

## Agent Docs — Read Before Working

Before starting any task, check which of these docs are relevant and read them first:

| File | When to Read |
|------|-------------|
| `agent_docs/PROJECT_GOALS.md` | **Always read first.** Core product vision and requirements. |
| `agent_docs/DATABASE_SCHEMA.md` | When working with Supabase, data models, or API routes |
| `agent_docs/BOOKING_FLOW.md` | When building the client-facing booking experience |
| `agent_docs/ADMIN_DASHBOARD.md` | When building the admin panel |
| `agent_docs/DESIGN_TOKENS.md` | When styling any component or page |
| `agent_docs/STRIPE_INTEGRATION.md` | When working on payments, deposits, or webhooks |
| `agent_docs/CALENDAR_SYNC.md` | When working on availability, date blocking, or Google Calendar |
| `agent_docs/EMAIL_AUTOMATIONS.md` | When building notification emails or reminders |

## IMPORTANT

- NEVER hardcode API keys. All secrets go in `.env.local` and are accessed via `process.env`.
- NEVER skip Zod validation on API routes. All incoming data must be validated.
- NEVER use `supabase-js` service role key on the client side. Service role is server-only.
- All monetary amounts stored in the database as `DECIMAL(10,2)`, never as floats.
- Booking availability logic MUST account for service duration + buffer time + existing bookings + blocked dates.
- Admin routes MUST be protected by Supabase Auth middleware — redirect to /admin/login if not authenticated.
- Mobile-first responsive design. The admin will be used primarily on an iPhone.

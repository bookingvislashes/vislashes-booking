# VIS Lashes — project instructions

A booking site for a lash salon in Orlando. It takes **real deposit payments
from real clients**, so treat `main` as production: it is deployed to
vislashes.com on every push.

---

## Release notes are required, not optional

**Any time you change `version` in `package.json`, add a matching entry at the
top of `RELEASE_NOTES` in `lib/release-notes.ts` in the same commit.**

That array is the only source for the What's New page in the admin
(`/admin/whats-new`), which the salon owner reads. A version bump without an
entry means she gets a silent update she can't ask about.

Write for her, not for an engineer — what is different when she uses the app,
not which files moved:

- Good: "Deposit amount is editable in Settings and applies to every service."
- Bad: "Added DepositSection component to settings/page.tsx."

Use `kind: "note"` for anything she has to do herself (run a migration, add an
environment variable, register a domain) — those render as **Action** and are
the ones she is most likely to miss.

Bump the version by what changed: patch for a fix, minor for a feature or a
behaviour change. The footer trims a trailing `.0`, so `1.5.0` displays as
`v1.5`.

---

## Before you push

Run all three. The lint baseline is currently **9 errors / 4 warnings**, all
pre-existing `set-state-in-effect` on the admin's fetch-on-mount pattern —
match that number, don't add to it.

```bash
npx tsc --noEmit    # must be clean
npm run lint        # must not exceed the baseline above
npm run build       # must compile
```

Push to `main` (and `main-7m8en0`, which mirrors it).

---

## Things that are easy to get wrong here

**Money is server-authoritative.** The deposit is read from the `services`
table inside `app/api/square/process-payment/route.ts`. Never accept a charge
amount from the client — that was a real bug that let someone pay a cent for a
$55 set.

**The card is charged before the booking is written.** Any failure after
capture must refund or surface the payment ID. Never return a bare error that
loses the reference.

**`NEXT_PUBLIC_*` values are baked in at build time.** Changing one in Vercel
does nothing until a redeploy. The footer build stamp is how you confirm a
deploy actually shipped.

**Square is sandboxed by one variable.** `NEXT_PUBLIC_SQUARE_ENVIRONMENT` must
be exactly `production` for real money; anything else uses the sandbox. It
fails safe, but that also means a typo silently stops taking real payments.

**Database migrations are run by hand** in the Supabase SQL Editor, in order.
`001` is safe to re-run; `002` is deliberately not — each section has an audit
query to run first. If you add a migration, say so with `kind: "note"`.

**Do not invent business details.** Studio address, artist name, prices and
service names come from the database or from Settings. If a value is missing,
render nothing rather than a placeholder — a wrong address is worse than none.

---

## Stack

Next.js 16 (App Router) · React 19 · Tailwind v4 · Supabase (auth, Postgres,
RLS) · Square Web Payments SDK · Resend.

Middleware lives in `proxy.ts` — Next 16 renamed it from `middleware.ts`.
Design tokens are in `app/globals.css`; use `rounded-surface`,
`rounded-control`, `h-control` and the colour tokens rather than raw values.
`font-display` is Playfair Display and is the salon's brand — keep it.

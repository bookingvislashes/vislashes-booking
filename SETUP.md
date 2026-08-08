# VIS Lashes — Setup & Handoff Guide

This guide takes the site from its current state (a working front-end demo) to a
real, working booking system running on someone else's accounts.

No code editing is required for the hosting steps. Everything in Part 3 is done
through web dashboards.

---

## Part 1 — What state the site is actually in

The site is **deployed and looks finished, but it is running in demo mode.**
Nothing is saved and no money moves.

| Area | Status |
|---|---|
| Homepage, styling, layout | ✅ Real and working |
| Booking flow UI (service → date → forms) | ✅ Real and working |
| Time slots shown on the calendar | ⚠️ **Fake.** Hardcoded 9:00 AM–3:00 PM, Mon–Fri |
| Saving a booking to a database | ❌ No database connected |
| Taking the deposit | ❌ Square not configured — the payment step errors in the browser console |
| Confirmation / reminder emails | ❌ Code is written, but no email account connected |
| Admin dashboard | ⚠️ Loads, but shows no real data; some pages return a 500 |
| Admin login protection | ✅ Fixed — activates automatically once Supabase is connected |
| 24-hour reminder emails | ❌ Placeholder — the endpoint returns `{"sent": 0}` and does nothing |
| Google Calendar sync | ❌ Never built. The library is installed and env vars are documented, but no code exists |

The database schema itself is **complete and ready to run** —
`supabase/migrations/001_initial_schema.sql` creates all 8 tables, security
rules, and seeds the 6 default services with prices.

### Four accounts are needed

| Service | Purpose | Cost |
|---|---|---|
| **Supabase** | Database + admin login | Free tier is enough to start |
| **Square** | Deposits / card payments | Free account, ~2.9% + 30¢ per transaction |
| **Resend** | Confirmation & reminder emails | Free up to 3,000 emails/month |
| **Vercel** | Hosting | Free to test, see Part 2 for the commercial caveat |

---

## Part 2 — Code work still required

These are the only things that need a developer. Everything else is dashboards.

**1. Re-enable admin login protection — DONE**

The file protecting `/admin` had been renamed to `middleware.ts.bak` to work
around a deploy failure, leaving the admin dashboard unprotected.

Next.js 16 renamed this feature from `middleware` to `proxy`, which is what broke
the original deploy. Renaming the *file* is not sufficient — the exported
function has to be renamed too, or the build fails with "Proxy is missing
expected function export name". Both are now done in `proxy.ts`, and the build
registers it as `ƒ Proxy (Middleware)`.

It is safe in the current demo state: the file skips auth entirely while
`NEXT_PUBLIC_SUPABASE_URL` is missing or contains "placeholder". The moment real
Supabase credentials are added, unauthenticated `/admin` requests start
redirecting to `/admin/login`.

**2. Build the reminder emails**

`app/api/reminders/route.ts` is a stub that returns `{"sent": 0}`. The email
templates in `lib/email.ts` are already written — the endpoint just needs to
query tomorrow's confirmed bookings and call `sendReminderEmail` for each.

It also needs something to trigger it daily. Vercel's built-in cron requires a
paid plan (it was removed from `vercel.json` for exactly this reason). A free
external scheduler like cron-job.org can call the URL once a day instead.

**3. Decide about Google Calendar sync**

It was planned but never built. Either build it, or delete the four `GOOGLE_*`
variables from `.env.local.example` so nobody wastes time trying to configure
something that isn't wired up.

**4. Housekeeping**

There are duplicate files from a macOS copy accident — `BookingFlow 2.tsx`,
`app/admin/(dashboard) 2/`, and about 15 others. They are untracked, so they do
**not** affect the live site, but they compile into local builds as junk routes
like `/admin/(dashboard) 2/clients`. Safe to delete.

---

## Part 3 — Which host, and why

**Use Vercel.**

Vercel is built by the same team that makes Next.js, which is the framework this
site uses. Everything the site depends on — server rendering, the API routes,
the admin protection layer, automatic image optimization — works with zero
configuration. The project is already linked to Vercel, so this is also the path
of least resistance.

The alternatives are worse fits here, not bad products:

- **Netlify** — works, but its Next.js support trails new releases, and this is Next 16 (very recent).
- **Cloudflare Workers** — cheap and fast, but needs an adapter (OpenNext) and more setup.
- **Traditional shared hosting (GoDaddy, Bluehost, Hostinger)** — will **not** work. This is not a static HTML site; it needs a Node.js server.

### One important caveat about cost

Vercel's free **Hobby** plan is licensed for non-commercial use only. A salon
site taking real deposits is commercial, so the correct plan is **Pro, $20/month**.
Pro also unlocks the scheduled jobs needed for reminder emails.

Practical approach: build and test everything on the free plan, then upgrade to
Pro before taking real bookings.

Rough running cost once live: **$20/mo Vercel + ~$15/yr domain**, with Supabase
and Resend free at this scale, plus Square's per-transaction fee.

---

## Part 4 — Step-by-step handoff

### Phase A — Put the code on her GitHub account

The intended arrangement is a **split**: Jerry writes the code, she owns the
hosting and all the accounts. The repository lives on her GitHub so the site
never depends on someone else's account continuing to exist.

1. She creates a free GitHub account and a new **empty** repository named
   `Vislashes-Booking`. No README, no .gitignore — completely empty.
2. She adds Jerry: **Settings → Collaborators → Add people**.
3. Jerry points his local copy at her repository and pushes:

   ```bash
   git remote set-url origin https://github.com/HER-USERNAME/Vislashes-Booking.git
   git push -u origin main
   ```

She now owns the code. Everything from here — Vercel, database, payments — is
connected to her repository, and nothing breaks if Jerry's accounts go away.

> **Alternative:** the repo can stay on Jerry's account with her added as a
> collaborator, and her Vercel can still deploy it. It works, but her live site
> would then depend on his repo continuing to exist and her access continuing to
> be granted. For a site taking real deposits, that's a single point of failure.

### Phase B — Create the database (Supabase)

1. Sign up at https://supabase.com — "Start your project", sign in with GitHub.
2. Create a new project. Pick a region near Orlando (`us-east-1`).
3. **Save the database password it generates.** It is shown only once.
4. Wait ~2 minutes for provisioning.
5. Open **SQL Editor** in the left sidebar → **New query**.
6. Open `supabase/migrations/001_initial_schema.sql` from the repo, copy the
   entire contents, paste it in, and click **Run**. This builds all the tables
   and adds the six default services.

   The script is **safe to run more than once** — every statement checks for its
   own existence first, and re-running repairs a partially applied database
   instead of failing with "policy ... already exists".
7. Go to **Authentication → Users → Add user**. Create her admin login with an
   email and password. This is what she will use at `/admin/login`.
8. Go to **Project Settings → API keys** and copy these three values into a
   scratch document:
   - Project URL
   - `anon` / publishable key
   - `service_role` / secret key — **treat this one like a password; it bypasses all security rules**

### Phase C — Set up payments (Square)

1. Create a free account at https://squareup.com
2. Go to the developer dashboard: https://developer.squareup.com/apps
3. Click **+** to create an application.
4. Start in the **Sandbox** tab (fake money, for testing) and copy:
   - Application ID
   - Access token
   - Location ID
5. Later, when ready for real bookings, repeat from the **Production** tab and
   swap the values.
6. For webhooks: **Webhooks → Subscriptions → Add**, and point it at
   `https://<her-site-url>/api/square/webhook`. Copy the signature key.
   *(Do this after Phase D, once the site has a real URL.)*

### Phase D — Set up email (Resend)

1. Sign up at https://resend.com
2. **API Keys → Create API Key** and copy it.
3. To send from a custom address like `bookings@vislashes.com`, add the domain
   under **Domains** and follow its DNS instructions.
4. To just get started, skip the domain — the code already falls back to
   Resend's shared `onboarding@resend.dev` sending address.

### Phase E — Deploy on Vercel

1. Sign up at https://vercel.com with **the same GitHub account** that now owns
   the repo. This is what makes the rest automatic.
2. Click **Add New → Project**.
3. Find `Vislashes-Booking` in the list and click **Import**.
4. Do not change the build settings — Next.js is detected automatically.
5. Expand **Environment Variables** and add each of these:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL from Phase B |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key from Phase B |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key from Phase B |
   | `SQUARE_ACCESS_TOKEN` | from Phase C |
   | `NEXT_PUBLIC_SQUARE_APPLICATION_ID` | from Phase C |
   | `NEXT_PUBLIC_SQUARE_LOCATION_ID` | from Phase C |
   | `NEXT_PUBLIC_SQUARE_ENVIRONMENT` | `sandbox` for testing, `production` when live |
   | `SQUARE_WEBHOOK_SIGNATURE_KEY` | from Phase C |
   | `RESEND_API_KEY` | from Phase D |
   | `EMAIL_FROM` | `onboarding@resend.dev`, or her own domain address |
   | `NEXT_PUBLIC_BASE_URL` | her live site URL — fill in after the first deploy |

6. Click **Deploy** and wait ~2 minutes.
7. Copy the URL it gives you, go to **Settings → Environment Variables**, set
   `NEXT_PUBLIC_BASE_URL` to that URL, and redeploy once so it takes effect.

From this point on, **every push to `main` on GitHub redeploys the site
automatically.** Neither of you needs to touch Vercel again for normal changes.

### Phase F — Custom domain (optional)

1. Buy the domain — Cloudflare and Namecheap are both around $12–15/year.
2. In Vercel: **Settings → Domains → Add**, enter the domain.
3. Vercel shows the exact DNS records to create. Add them at the registrar.
4. Wait for propagation (usually minutes, up to 48 hours). HTTPS is automatic.

### Phase G — Verify it actually works

Walk through these in order. Each one confirms a different service is connected.

- [ ] Homepage loads with images
- [ ] `/book` shows the six real services **with the prices from the database** — if prices are wrong or missing, Supabase is not connected
- [ ] Calendar shows availability matching what's in the `availability` table, not a flat 9–3 Mon–Fri (that's the demo fallback)
- [ ] The deposit step loads a real card field with no console errors — if it errors, the Square keys are wrong
- [ ] Complete a test booking with Square's sandbox test card `4111 1111 1111 1111`, any future expiry, any CVV
- [ ] The booking appears in Supabase under **Table Editor → bookings**
- [ ] A confirmation email arrives
- [ ] `/admin/login` accepts the user created in Phase B
- [ ] After the Part 2 fix: visiting `/admin` while logged out redirects to the login page

---

## Part 5 — Ongoing changes (Jerry codes, she hosts)

Once Part 4 is done, this is the permanent working arrangement. **She never
touches code, and he never needs access to her accounts.**

### How a change reaches the live site

Her Vercel watches her GitHub repository. A push *is* the deploy — there is no
separate handoff step.

Work on a branch rather than `main`:

```bash
git checkout -b whatever-is-changing
```

Push the branch, and Vercel automatically builds a **preview deployment** — a
complete working copy of the site at its own URL, using her real data, that does
not affect the live site. Send her that link. She looks at it on her phone, and
only once she approves does it get merged into `main` and go live.

That preview step is the whole point of this setup: she gets veto power over
every change without needing to understand any of it.

### Her safety net

If something broken does reach the live site: **Vercel → Deployments → Instant
Rollback.** Two clicks and the site returns to the previous working version, with
no developer involved. Worth walking through once so she is never stuck waiting.

### Local development credentials

Jerry's machine should **never** hold her production keys. Set up a separate dev
stack, all free:

- A second Supabase project, with the same `001_initial_schema.sql` applied
- Square **sandbox** credentials rather than production
- Any Resend key, or leave `EMAIL_FROM` as `onboarding@resend.dev`

Those go in his local `.env.local`, which is gitignored and never committed.

Beyond the security argument, this is what guarantees that **test bookings can
never land in her live database and test emails can never reach her real
clients.** Her production keys exist only in her Vercel dashboard.

### Vercel seats

Jerry does **not** need a Vercel account. Pushing to GitHub is enough to trigger
her deploys. This matters because Vercel Pro bills per seat, so adding him as a
team member would roughly double the monthly cost for no benefit.

The tradeoff: he cannot read build logs when a deploy fails. In practice she
screenshots the error, or adds him to the team temporarily while something is
actually broken.

---

## Realistic effort

| Task | Who | Time |
|---|---|---|
| Phases A–G above | Non-technical, following this guide | 2–3 hours |
| Re-enable admin protection | Developer | ~15 minutes |
| Build reminder emails + scheduling | Developer | 2–4 hours |
| Google Calendar sync, if wanted | Developer | 1–2 days |

The site can take real bookings after Phases A–G plus the admin protection fix.
Reminders and calendar sync are enhancements, not blockers.

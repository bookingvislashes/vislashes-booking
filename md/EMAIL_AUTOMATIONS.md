# Email Automations — Resend Integration

## Setup

```bash
npm install resend
```

```env
RESEND_API_KEY=re_...
EMAIL_FROM=bookings@vislashes.com  # Or use Resend's default: onboarding@resend.dev for testing
```

## Resend Client

```typescript
// lib/email.ts
import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);
```

## Email Templates

Build email templates as React components using Resend's `@react-email/components` package for styled HTML emails. Alternatively, use simple HTML string templates.

```bash
npm install @react-email/components
```

### Brand Styling for Emails
- Background: #F5F0EB (cream)
- Card background: #FFFFFF
- Text color: #2C2C2C
- Accent color: #8B6F47 (deep brown)
- Font: Arial or system sans-serif (web-safe for email clients)
- Logo: "VIS LASHES" text treatment (Playfair won't render in most email clients, use Arial + letter-spacing)

## Email Types

### 1. Booking Confirmation
**Trigger**: After successful payment (Stripe webhook) or cash booking creation
**To**: Client email
**Subject**: "Your VIS Lashes Appointment is Confirmed ✨"

Content:
- VIS LASHES logo/text header
- "You're all set, [First Name]!"
- Appointment details card:
  - Service name
  - Date (formatted: "Saturday, March 12, 2026")
  - Time (formatted: "10:00 AM")
  - Duration
  - Deposit paid: $10.00 ✓ (or "Cash payment due at appointment")
  - Remaining balance: $XX.00
- "Before you come" — the four PREP_NOTES lines, shared verbatim with the
  reminder so the second email is a glance rather than a second read. The
  15-minute grace period is one of them: "am I allowed to be five minutes
  late" is the question clients actually have, and answering it warmly is
  worth more than the line costs.
- Location, when Settings has one
- "Need to reschedule?" with contact info
- Footer: VIS LASHES, then Instagram and TikTok icons

### 2. 24-Hour Reminder
**Trigger**: Vercel Cron Job runs daily, finds bookings for tomorrow
**To**: Client email
**Subject**: "Reminder: Your Lash Appointment is Tomorrow 🕐"

Content:
- "Hi [First Name], just a friendly reminder!"
- Appointment details (same card format as confirmation)
- Prep tips:
  - Arrive with clean, makeup-free eyes
  - Avoid caffeine beforehand (helps you stay still!)
- Cancellation policy reminder
- Footer

### 3. Cancellation Notice
**Trigger**: Admin cancels a booking
**To**: Client email
**Subject**: "Your VIS Lashes Appointment Has Been Cancelled"

Content:
- "Hi [First Name], your appointment on [date] at [time] has been cancelled."
- If deposit was paid: "Your deposit will be refunded within 5-10 business days."
- "Want to rebook?" with link to /book
- Footer

### 4. Post-Appointment Follow-Up
**Trigger**: The daily cron, two days after an appointment (`/api/reminders`)
**To**: Client email. She is **not** blind-copied — her copies exist for
bookings, which she acts on; a copy of every follow-up would be noise.
**Subject**: "How are your lashes, [First Name]?"

Three sections, in the order they earn their place, and under a hundred words:

1. **Aftercare.** Poor retention is the most common reason a lash client does
   not come back, and it is usually aftercare rather than application. Three
   tips, on day two, while there is still time for them to matter.
2. **The refill window.** Two to three weeks is the accepted rhythm; clients
   who are not told simply drift. Saying it plainly is what turns one
   appointment into a standing one.
3. **The ask.** A client is never more in love with their lashes than in the
   first few days, which is when a tag or a recommendation costs them nothing.
   Deliberately no discount attached — that is the salon's money to decide.

Sent for any appointment whose status is `confirmed` or `completed`;
`cancelled` and `no_show` are skipped, because asking someone how they are
loving lashes they never got is worse than saying nothing.

`bookings.followup_sent_at` (migration 022) is what stops it going twice, and
is stamped only once a send resolves — the same contract the two `reminder_*`
columns use. The pass is fenced in its own try/catch and its own query, so the
window where the code is deployed and the migration has not run costs the
follow-up and never the reminders.

### 5. Rescheduled Confirmation
**Trigger**: A client moves their own appointment from the link in their
confirmation (`POST /api/reschedule`)
**To**: Client email, Bcc the salon
**Subject**: "Your new time — Sat, Sep 26 at 1:00 PM"

The same template as the confirmation with `variant: "moved"` — one email, two
headings, so the two can never drift apart.

## Her Blind Copy

There is no separate owner email. She is **Bcc'd on the client's own
confirmation** (and on cancellations), so she sees exactly what they saw and
nothing in their copy reveals she is on it. Every booking: the website
checkout, and appointments she enters in the admin.

Addresses come from `getEmailSettings()`:

| Field | Source | Visible to the client? |
|---|---|---|
| `bcc` | `owner_inbox_email`, else `business_email`; `OWNER_NOTIFICATION_EMAIL` overrides both | **No** — Bcc genuinely is hidden |
| `replyTo` | `owner_inbox_email`, else `business_email` | **Yes** — shown in the To field of their reply |

Reply-To is deliberately her real inbox rather than the `bookings@` address in
From. Routing replies through the public address would keep the personal one
off a client's screen, but only if that mailbox actually receives mail —
pointed at an address nobody reads, a reply vanishes. Working beats hidden.

`EMAIL_FROM` still has to be an address at a domain verified in Resend
(`VIS Lashes <bookings@vislashes.com>`); Resend cannot send as `@gmail.com`,
and Gmail's own DMARC policy would reject it if it could.

One case has no client email to ride on: an admin-created booking with "send
confirmation" unticked, or an imported client with no address. The same
confirmation is then addressed to her alone rather than not sent, so she still
has every appointment on record.

## Self-Serve Rescheduling

The confirmation carries a **Change my date or time** button
(`/reschedule/<token>`).

- **The token is signed, not stored** (`lib/reschedule-link.ts`): an HMAC of
  the booking id, so there is no migration and no backfill — every booking,
  past or future, already has a working link. `RESCHEDULE_LINK_SECRET`, else
  the service-role key.
- **Only the date and time can change.** Service, price and deposit are never
  read from the request, so a moved appointment cannot become a cheaper one.
- **The slot engine is the authority.** The new time has to appear in
  `slotsForDate()`, not merely be free of a clash — that is what rules out a
  closed Sunday, a blocked afternoon, or a start that runs past closing. The
  booking being moved is excluded from availability so its own length does not
  hide the times either side of it.
- **The notice window is `advance_booking_hours`** from Settings, the same
  number the booking calendar uses. Inside it, the page tells the client to
  message her.
- **The write is conditional** on the booking still being confirmed at the date
  and time the page was drawn from, so a page left open cannot overwrite a
  change she made in the meantime.
- Afterwards: Google Calendar re-syncs, both reminder stamps clear, the client
  gets the "moved" confirmation with her Bcc'd, and she gets a push alert.

## Testing the Whole Flow

`/book?test=1`, with an admin session, adds a **Book it without paying** button
to the payment step (`POST /api/bookings/test`).

The route requires a signed-in admin — the public pay-on-the-day endpoint was
retired for writing confirmed bookings with nothing behind them, and its own
note said any replacement "would need to be admin-authenticated rather than
public". Everything downstream is the real path: the same `createBooking`, the
same confirmation email and blind copy, the same calendar sync, the same
confirmation page. Only the card is skipped.

The booking it writes is real and holds a real slot. `booking_source` is set to
`test` and `notes` says so, so it is obvious in the admin and easy to cancel.

### 6. Birthday
**Trigger**: The daily cron, on the first run of a client's birth month
**To**: Client email
**Subject**: "Happy birthday, [First Name]! $15 off this month"

Keyed on `clients.birthday_email_year` rather than a date, so a cron that
misses the 1st still greets everyone on the 2nd and nobody is greeted twice.
**The credit is granted before the email sends** — an email promising money
that then failed to land is worse than a credit sitting on an unopened inbox.

### 7. Win-back
**Trigger**: The daily cron, 42 days after an appointment
**To**: Client email, when they have nothing booked since
**Subject**: "We miss you, [First Name]"

Driven off bookings on one date rather than scanning every client: one query
finds that day's clients, a second rules out anyone with a later booking (past
or future — a client with a set next Tuesday is not missing). No discount
attached, deliberately: leading with money teaches clients to wait for a sale
before rebooking.

`clients.winback_sent_at` is compared against the appointment date rather than
merely being non-null, so a client who returns and drifts again is eligible a
second time.

## Reviews

The follow-up email carries a **Leave a review** link to `/review/<token>`,
signed exactly like the reschedule link but with its own label, so one cannot
be used as the other.

There is no open review form on the site. The only people who can leave one
are people who had an appointment, and only once each — a unique index on
`booking_id` enforces that rather than the route trusting itself.

**Where a review ends up is decided from the rating alone**, in
`statusForRating()`, never from the request:

| Rating | Status | Visible where |
|---|---|---|
| 4–5 | `published` | The home page slideshow, immediately |
| 1–3 | `private` | Admin → Reviews only. She gets a push alert. |

The gate is an RLS policy (`using (status = 'published')`), not a filter in a
query: an anonymous visitor cannot read a one-star review even by asking for
it directly. That is deliberate — the home page is her shop window and "only
the positive ones" was the ask, but a low rating is still worth having,
because it tells her something before the client tells everyone else.

`Testimonials` renders published reviews as a slideshow and falls back to her
four curated quotes when there are none or the read fails, so the section is
never a hole. Reviews with no comment are skipped: five stars and nothing to
read is a rating, not a testimonial.

**Trade-off worth knowing:** a 4- or 5-star review appears on the home page
before she has seen it. That is what makes it effortless. Flipping to
approve-first is a change to `statusForRating()` and the admin page's buttons.

## Credits

`lib/credits.ts`. A credit is money owed to a client against their next
appointment — $10 for tagging her within 24 hours, $15 in their birthday
month. Both amounts are settings (`referral_credit_amount`,
`birthday_credit_amount`), not constants.

**It never touches the deposit.** The deposit holds the slot, is read from the
`services` table and charged by Square; a credit that reduced it would be a
client-influenceable charge, which is the bug this project has already had
once. It comes off the balance settled at the chair.

Granted from a client's profile in the admin, or by the birthday cron. Spent
by `consumeCreditForBooking()` after the booking row exists, on both booking
paths. The clear is conditional on the amount still being what was read, so
two bookings racing cannot both claim the same $10. Cancelling an appointment
calls `returnCreditFromBooking()`, so a client who cancels does not lose it.

Credits replace rather than accumulate, larger wins: two $10 tags are not $20
off, and a birthday must never downgrade a credit already sitting there.

**Everything in that file fails soft.** Migration 023 is run by hand, so there
is a window where the code is deployed and the columns do not exist. A booking
must not fail because a discount could not be looked up — least of all on the
card path, where it would fail after capture. Birthdays are written by
`saveBirthday()` in a separate statement for the same reason: they are never
part of the client upsert that runs post-capture.

## Cron Jobs for Automated Emails

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/reminders",
      "schedule": "0 10 * * *"
    }
  ]
}
```

```typescript
// app/api/reminders/route.ts
// Runs daily at 10:00 AM UTC (6:00 AM ET)

export async function GET(req: NextRequest) {
  // Verify cron secret header (Vercel adds this automatically)
  
  const supabase = createServiceClient();
  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");

  // Find confirmed bookings for tomorrow
  const { data: bookings } = await supabase
    .from("bookings")
    .select("*, clients(*), services(*)")
    .eq("booking_date", tomorrow)
    .eq("status", "confirmed");

  // Send reminder email to each
  for (const booking of bookings || []) {
    await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: booking.clients.email,
      subject: "Reminder: Your Lash Appointment is Tomorrow 🕐",
      // html or react template
    });
  }

  return NextResponse.json({ sent: bookings?.length || 0 });
}
```

## Resend Free Tier Limits
- 3,000 emails/month
- 100 emails/day
- This is more than enough for a solo lash artist (~30 bookings/month = ~90 emails max)

## Domain Setup (For Production)
1. Add your domain in Resend Dashboard
2. Add DNS records (SPF, DKIM, DMARC) to your domain registrar
3. Update `EMAIL_FROM` to your custom domain email
4. Until domain is verified, use `onboarding@resend.dev` for testing

## Important Notes
- All emails should be non-blocking — if sending fails, log the error but don't break the booking flow
- Store email send status/errors in a simple log if needed for debugging
- Always use the client's timezone (America/New_York) when formatting dates in emails
- Include an unsubscribe mechanism if required (Resend handles this for transactional emails)

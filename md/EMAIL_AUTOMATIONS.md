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
- "What to expect" section:
  - Come with clean lashes, no makeup
  - Appointment duration reminder
  - Location/address if applicable
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

### 4. Post-Appointment Follow-Up (Optional / Phase 2)
**Trigger**: Cron job runs daily, finds bookings completed yesterday
**To**: Client email
**Subject**: "Thanks for Visiting VIS Lashes! 💕"

Content:
- "Hi [First Name], hope you're loving your new lashes!"
- Aftercare tips (brief)
- "Book your refill" CTA button → /book
- "Follow us on Instagram" link
- Footer

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
| `replyTo` | `business_email`, else `owner_inbox_email` | **Yes** — shown in the To field of their reply |

That split is the whole point: her personal inbox gets the copy without ever
appearing on a client's screen, provided `business_email` is a forwarding
address at the domain. With `business_email` blank, Reply-To falls back to her
personal address — a reply that reaches her beats a reply that reaches nobody.

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

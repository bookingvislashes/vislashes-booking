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
- Footer: VIS LASHES, Instagram link, "Orlando · Saint Cloud · Kissimmee"

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

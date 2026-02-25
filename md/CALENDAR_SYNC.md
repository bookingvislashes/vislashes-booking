# Calendar Sync — Google Calendar Integration

## Purpose

The admin (lash artist) wants to:
1. See all bookings on her iPhone calendar automatically
2. Block time from her phone and have it reflected in the booking app's availability

Google Calendar is the sync target because it works seamlessly on iPhone via the Google Calendar app or by adding the Google account to iOS Settings > Calendar.

## Setup

### Google Cloud Console
1. Create a project in Google Cloud Console
2. Enable the Google Calendar API
3. Create OAuth 2.0 credentials (Web Application type)
4. Set redirect URI to `https://yourdomain.com/api/calendar-sync/callback`
5. Store credentials in `.env.local`

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://yourdomain.com/api/calendar-sync/callback
```

### Scopes Required
```
https://www.googleapis.com/auth/calendar.events
https://www.googleapis.com/auth/calendar.readonly
```

## OAuth Flow

1. Admin clicks "Connect Google Calendar" in `/admin/settings`
2. Redirect to Google OAuth consent screen
3. On approval, Google redirects back with auth code
4. Exchange code for access token + refresh token
5. Store tokens securely in `settings` table (encrypted)

```typescript
// app/api/calendar-sync/connect/route.ts
// Generates Google OAuth URL and redirects admin

// app/api/calendar-sync/callback/route.ts
// Handles OAuth callback, stores tokens in Supabase settings table
```

## Sync: Booking → Google Calendar

When a booking is created (via Stripe webhook or manual admin creation):

```typescript
// lib/calendar.ts
import { google } from "googleapis";

export async function createCalendarEvent(booking, client, service) {
  const auth = await getAuthClient(); // Uses stored refresh token
  const calendar = google.calendar({ version: "v3", auth });

  await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: `${service.name} — ${client.full_name}`,
      description: `Service: ${service.name}\nClient: ${client.full_name}\nPhone: ${client.phone}\nEmail: ${client.email}\nDeposit: $${booking.deposit_amount}`,
      start: {
        dateTime: `${booking.booking_date}T${booking.start_time}`,
        timeZone: "America/New_York",
      },
      end: {
        dateTime: `${booking.booking_date}T${booking.end_time}`,
        timeZone: "America/New_York",
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: "popup", minutes: 60 },
          { method: "popup", minutes: 15 },
        ],
      },
    },
  });
}
```

Store the Google Calendar event ID in the booking record so we can update/delete it later if the booking is cancelled or rescheduled.

Add column to bookings:
```sql
ALTER TABLE bookings ADD COLUMN google_calendar_event_id TEXT;
```

## Sync: Google Calendar → Blocked Time

To pull blocked time from her Google Calendar into the app's availability:

### Option A: Periodic Sync (Recommended for MVP)

Use a Vercel Cron Job that runs every 5-10 minutes:

```typescript
// app/api/calendar-sync/pull/route.ts
// Triggered by Vercel Cron

export async function GET() {
  const auth = await getAuthClient();
  const calendar = google.calendar({ version: "v3", auth });

  // Fetch events for the next 60 days
  const events = await calendar.events.list({
    calendarId: "primary",
    timeMin: new Date().toISOString(),
    timeMax: addDays(new Date(), 60).toISOString(),
    singleEvents: true,
  });

  // For each event NOT created by our app (no matching google_calendar_event_id):
  // Create or update a blocked_date record
  // This way, if she blocks time on her phone calendar, it blocks in the app

  return NextResponse.json({ synced: events.data.items?.length });
}
```

Vercel Cron config in `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/calendar-sync/pull",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

### Option B: Google Calendar Push Notifications (Advanced)

Google Calendar supports push notifications via webhooks. More real-time but more complex to set up. Save for post-MVP.

## Cancellation Sync

When admin cancels a booking:
1. Update booking status to `cancelled` in Supabase
2. Delete the Google Calendar event using stored `google_calendar_event_id`
3. Send cancellation email to client

## Disconnect

Admin can disconnect Google Calendar in settings:
1. Revoke OAuth token
2. Clear stored tokens from settings table
3. Set `google_calendar_connected` to `false`

## Dependency

```bash
npm install googleapis
```

## Important Notes

- Always use `America/New_York` timezone (client is in Orlando, FL)
- Handle token refresh automatically — Google access tokens expire after 1 hour
- If Google API fails, the booking should still succeed (calendar sync is non-blocking)
- Log sync errors to console but don't break the booking flow

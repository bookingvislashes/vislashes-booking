# Admin Dashboard — Implementation Guide

## Authentication

Single admin user. Use Supabase Auth with email/password.

### Setup
1. Create admin user in Supabase Dashboard > Authentication > Users > Add User
2. Admin login page at `/admin/login`
3. Use Supabase `createServerClient` in Next.js middleware to protect all `/admin/*` routes

### Middleware

```typescript
// middleware.ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  // Allow login page
  if (request.nextUrl.pathname === "/admin/login") {
    return NextResponse.next();
  }

  // Check auth — redirect to login if not authenticated
  // Create Supabase client with request cookies
  // If no session, redirect to /admin/login
}

export const config = {
  matcher: ["/admin/:path*"],
};
```

## Layout

### Desktop (md+)
- Left sidebar (180-200px width) with navigation links
- Main content area fills remaining width
- Sidebar items: Dashboard, Bookings, Calendar, Clients, Agreements, Services, Settings
- Active item highlighted with left border accent + background

### Mobile (< md)
- No sidebar — use bottom tab bar (fixed position bottom)
- 5 key tabs: Dashboard, Bookings, Calendar, Clients, Settings
- Active tab highlighted with color

## Pages

### `/admin` — Dashboard
Server Component that fetches:
- Today's bookings (ordered by start_time)
- Count of bookings this month
- Sum of deposits collected this month
- Total client count

Displays:
- 3 stat cards at top (Today's Bookings, This Month count, Total Clients)
- "Today's Schedule" list below with booking rows
- Each row: client name, service name, time, status badge
- "Add Booking" button opens a modal for manual booking creation

### `/admin/bookings` — Booking Management
- Default view: list of upcoming bookings (soonest first)
- Toggle to calendar view (use a simple month grid with booking dots)
- Filters: date range picker, status dropdown, service type dropdown
- Click a booking row → expand or navigate to detail view
- Detail view shows ALL collected data: client info, intake answers, medical form, agreement with signature
- Action buttons: Cancel (with confirmation dialog), Mark Complete, Mark No-Show, Reschedule

### `/admin/calendar` — Availability
Two sections:

**Weekly Hours**
- Table with 7 rows (Mon-Sun)
- Each row: day name, start time input, end time input, active toggle
- Save button persists to `availability` table

**Blocked Dates**
- "Block Date" button → date picker + optional time range + reason text input
- "Block Range" button → start date, end date, reason
- List of all blocked dates with remove (trash) button on each
- Sorted by date ascending

### `/admin/clients` — Client Directory
- Search input filters by name or email (client-side filter is fine for < 500 clients)
- Table/list: avatar initial, name, email, visit count, last visit date
- Click row → client detail page (`/admin/clients/[id]`)
- Detail page: contact info, full booking history, most recent medical form, list of signed agreements with "View PDF" links

### `/admin/agreements` — Agreement Viewer
- List of all signed agreements, newest first
- Each row: client name, signed date, which agreements were checked (filming, waiver, terms)
- "View PDF" button generates/downloads the agreement PDF
- PDF contains: agreement text, client name, date, signature image, IP, timestamp

### `/admin/services` — Service Management
- List of all services with inline edit capability
- Fields: name, description, category, price, deposit amount, duration, photo, active toggle
- Reorder via drag or sort_order number input
- Add new service button

### `/admin/settings` — Settings
- Buffer minutes between appointments (number input)
- Minimum advance booking hours (number input)
- Maximum advance booking days (number input)
- Business name, email, phone (text inputs)
- Google Calendar: connect/disconnect button, sync status indicator

## Manual Booking Creation

Admin needs to create bookings for phone calls and walk-ins.

Modal or page with:
1. Service selector (dropdown)
2. Date picker
3. Time slot selector (shows available slots for selected date)
4. Client info: name, email, phone (search existing clients by typing)
5. Deposit status: toggle paid/unpaid
6. Notes field
7. Skip intake/medical/agreement forms (admin-created bookings don't need these)

## PWA Configuration

The admin dashboard should be installable on iPhone home screen.

```json
// public/manifest.json
{
  "name": "VIS Lashes Admin",
  "short_name": "VIS Admin",
  "start_url": "/admin",
  "display": "standalone",
  "background_color": "#F5F0EB",
  "theme_color": "#8B6F47",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Add to `app/admin/layout.tsx`:
```html
<link rel="manifest" href="/manifest.json" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<meta name="apple-mobile-web-app-title" content="VIS Admin" />
<link rel="apple-touch-icon" href="/icon-192.png" />
```

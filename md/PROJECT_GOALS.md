# Project Goals — VIS Lashes Booking App

## The Problem

The client (a solo lash extension artist) currently uses Acuity Scheduling at $16-33/month. Acuity handles booking, but:

- She can't customize the design to match her brand
- She's paying monthly for features she barely uses
- She wants digital waivers, medical forms, and deposit collection in one seamless flow
- She wants to manage everything from her iPhone
- She wants clients to sign agreements before appointments, and she needs access to those signed documents

## The Solution

A fully custom booking web app that:

1. **Looks and feels like HER brand** — warm beige/brown palette, serif typography, premium lash photography. Not a generic scheduling widget.
2. **Costs $0/month** — hosted on Vercel free tier, Supabase free tier, Stripe charges only per transaction.
3. **Handles the entire booking flow in 7 steps** — service selection → date/time → customer info → intake questions → medical form → agreements/signature → deposit payment.
4. **Gives her a mobile-friendly admin dashboard** — view bookings, block dates, manage clients, access signed waivers, all from her phone.
5. **Syncs with her phone calendar** — Google Calendar two-way sync so she can see bookings on her phone and block time from her phone.
6. **Automates communication** — confirmation emails, 24-hour reminders, post-appointment follow-ups.

## Core User Stories

### As a Client (person booking an appointment):
- I can browse available lash services with photos, descriptions, durations, and prices
- I can see a real-time calendar showing only available dates and time slots
- I can fill out my contact info, medical history, and pre-appointment questions in one smooth flow
- I can read and digitally sign liability waivers and consent forms
- I can pay a $10 deposit via credit card, Apple Pay, or PayPal
- I can choose to pay cash (with a $3 convenience fee acknowledgment)
- I receive a confirmation email immediately after booking
- I receive a reminder email/SMS 24 hours before my appointment

### As the Admin (lash artist / business owner):
- I can log in to a protected admin dashboard from my iPhone or desktop
- I can see today's bookings at a glance with client names, services, and times
- I can view a monthly/weekly calendar of all bookings
- I can block specific dates or date ranges when I'm unavailable
- I can set my recurring weekly availability (e.g., Mon-Fri 9am-5pm, weekends off)
- I can view any client's full profile: booking history, medical forms, signed agreements
- I can download or view signed waiver PDFs for any booking
- I can manually create bookings for phone/walk-in clients
- I can cancel or reschedule bookings (client gets notified automatically)
- I can mark bookings as completed or no-show
- I can edit my service offerings: prices, descriptions, durations, photos
- I can toggle services active/inactive without deleting them
- I can see basic stats: bookings this month, revenue from deposits, total clients
- My bookings sync to my Google Calendar so I see them on my phone
- I can add the admin dashboard to my iPhone home screen as a PWA

## Services Offered

### Full Sets
| Service | Duration | Price | Deposit |
|---------|----------|-------|---------|
| Natural Glam | 1 hr 50 min | $50.00 | $10.00 |
| Premium Wispy Glam | 1 hr 50 min | $55.00 | $10.00 |
| Premium Wispy Glam (Custom) | 1 hr 50 min | $55.00 | $10.00 |

### Refills
| Service | Duration | Price | Deposit |
|---------|----------|-------|---------|
| Natural Glam Refill | 1 hr | $25.00 | $10.00 |
| Premium Wispy Glam Refill | 1 hr | $30.00 | $10.00 |
| Premium Wispy Glam Refill (Custom) | 1 hr | $30.00 | $10.00 |

## The 7-Step Booking Flow

Each step is a section within a single-page multi-step form at `/book`. Data persists across steps using React Hook Form context. A progress bar at the top shows which step the user is on.

### Step 1: Select Your Lash Set
- Grid of service cards with photo, name, description, duration, price
- Full sets displayed in first row, refills in second row
- User selects ONE service — card shows visual selected state
- "Continue" button only active after selection

### Step 2: Choose Your Availability
- Visual calendar component (month view)
- Past dates grayed out and unclickable
- Blocked dates visually struck through
- Fully-booked dates grayed out
- Clicking an available date reveals time slot buttons below
- Time slots calculated from: recurring availability MINUS blocked dates MINUS existing bookings (accounting for service duration + 15-min buffer)
- User must select both a date AND a time slot to continue

### Step 3: Customer Info
- Full name (required)
- Phone number (required, validated format)
- Email address (required, validated format)
- If email matches existing client record, silently link to existing profile

### Step 4: Pre-Appointment Questions
- "Have you ever had eyelash extensions before?" (Yes/No radio)
- "Is this for a special occasion?" (Yes/No radio)
- If special occasion = Yes, show text field: "What occasion?"

### Step 5: Medical Health Form
- Checkboxes: Cataracts, Conjunctivitis, Dry Eye Syndrome, Glaucoma
- Text fields: "Any other complaints?", "Name of Doctor", "Surgery notes"
- Required checkbox: "I have read and understood the above information"

### Step 6: Agreements
- Three consent checkboxes, each with a "Read Terms" link that opens a modal with the full text:
  1. Filming consent — "Will you allow us to film our work?"
  2. Liability waiver — "Check to Accept our Lash Consents, Release, and Waiver of Liability Agreement"
  3. Terms and conditions — "I have read and agree to the terms and conditions"
- Digital signature canvas (react-signature-canvas) — user signs with finger (mobile) or mouse (desktop)
- "Clear signature" button to reset
- All three checkboxes + signature required to continue

### Step 7: Payment
- Booking summary: service name, date, time, duration, total price
- Deposit amount prominently displayed: "$10.00 due today"
- Remaining balance note: "Remaining $XX due at appointment"
- Cash option checkbox: "I will bring cash as payment or pay a $3 convenience fee"
- Three payment buttons: "Pay $10 Deposit" (card via Stripe Checkout), "Apple Pay", "PayPal"
- On successful payment → Stripe webhook creates the booking in Supabase → redirect to confirmation page → send confirmation email
- On cash selection → booking created with status "pending_cash" → redirect to confirmation → send confirmation email noting cash payment expected

### Confirmation Page (`/confirmation/[bookingId]`)
- Success checkmark animation
- "You're All Set!" heading
- Booking details: service, date, time, deposit paid status
- "Back to Home" button
- "Add to Calendar" button (generates .ics file)

## Admin Dashboard Pages

### `/admin` — Dashboard Home
- Today's bookings list with client name, service, time, status
- Quick stats cards: bookings today, bookings this month, total deposits this month, total clients
- "Add Booking" button for manual entry

### `/admin/bookings` — All Bookings
- Toggle between calendar view (month/week/day) and list view
- Filter by: date range, status (confirmed/completed/cancelled/no-show), service type
- Click any booking → slide-out panel or modal with full details:
  - Client info, service, date/time
  - Intake form responses
  - Medical form responses
  - Signed agreement with signature image
  - Actions: cancel, reschedule, mark complete, mark no-show

### `/admin/calendar` — Availability Management
- Recurring weekly hours: set start/end time for each day of the week, toggle days on/off
- Blocked dates list with add/remove functionality
- "Block Date" button → date picker + optional reason field
- "Block Date Range" for vacation mode → start date, end date, reason
- Visual calendar showing which dates are blocked vs available

### `/admin/clients` — Client Directory
- Searchable/filterable list of all clients
- Each row: name, email, visit count, last visit date
- Click client → full profile page:
  - Contact info
  - Booking history (all past and upcoming)
  - Medical form from most recent booking
  - All signed agreements with "View PDF" buttons

### `/admin/services` — Service Management
- List of all services with name, price, duration, status
- Edit button → inline editing or modal for price, description, duration, photo
- Toggle active/inactive
- Drag to reorder display order

### `/admin/agreements` — Signed Agreements
- Chronological list of all signed agreements
- Each row: client name, date signed, agreement types checked, "View PDF" button
- PDF contains: full agreement text, client name, date, signature image, IP address, timestamp

### `/admin/settings` — Business Settings
- Buffer time between appointments (default: 15 minutes)
- Minimum advance booking time (default: 24 hours)
- Maximum advance booking days (default: 60 days)
- Business name, phone, email (shown in confirmation emails)
- Google Calendar connection toggle

## Non-Functional Requirements

- **Mobile-first**: Every page must look great on iPhone Safari. Admin dashboard especially.
- **Fast**: Pages should load in under 2 seconds. Use Server Components where possible.
- **Accessible**: Form inputs must have labels, proper focus states, and keyboard navigation.
- **Secure**: All API routes validate input with Zod. Stripe webhook signatures verified. Admin routes auth-protected.
- **SEO**: Home page should have proper meta tags, Open Graph, and structured data for local business.
- **PWA**: Admin dashboard installable on iPhone home screen via manifest.json + service worker.
- **Responsive emails**: Confirmation and reminder emails should render well on mobile email clients.

## What This App Does NOT Need (Out of Scope)
- E-commerce / online shopping cart (strip lash collections are in-person only for now)
- Client-side account creation or login (clients don't need accounts)
- Multi-user admin (single admin user only)
- Recurring/subscription bookings
- SMS sending (email-only for MVP, SMS can be added later)
- Online chat or messaging between client and admin
- Blog or content management
- Multi-location support

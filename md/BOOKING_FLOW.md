# Booking Flow — Implementation Guide

## Architecture

The booking flow is a single-page multi-step form at `/book`. It is a Client Component (`"use client"`).

### State Management
- Use React Hook Form with a single `useForm` wrapping all 7 steps
- Zod schema validates each step independently before allowing "Continue"
- A `BookingFlow` orchestrator component manages current step state and renders the active step
- Form data persists across steps — no data lost when going back

### Component Structure

```
app/book/page.tsx              → Server component, fetches services, renders BookingFlow
components/booking/
  BookingFlow.tsx               → Client component, manages step state, holds useForm
  ProgressBar.tsx               → Visual step indicator (7 segments)
  ServiceSelector.tsx           → Step 1
  CalendarPicker.tsx            → Step 2
  CustomerForm.tsx              → Step 3
  IntakeQuestions.tsx            → Step 4
  MedicalForm.tsx               → Step 5
  AgreementForm.tsx             → Step 6
  PaymentStep.tsx               → Step 7
```

## Zod Schema

```typescript
import { z } from "zod";

export const bookingSchema = z.object({
  // Step 1
  serviceId: z.string().uuid("Please select a service"),
  
  // Step 2
  bookingDate: z.string().min(1, "Please select a date"),
  timeSlot: z.string().min(1, "Please select a time"),
  
  // Step 3
  fullName: z.string().min(2, "Name is required"),
  phone: z.string().regex(/^\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/, "Enter a valid phone number"),
  email: z.string().email("Enter a valid email"),
  
  // Step 4
  hasHadExtensions: z.boolean().nullable(),
  isSpecialOccasion: z.boolean().default(false),
  occasionDetails: z.string().optional(),
  
  // Step 5
  hasCataracts: z.boolean().default(false),
  hasConjunctivitis: z.boolean().default(false),
  hasDryEye: z.boolean().default(false),
  hasGlaucoma: z.boolean().default(false),
  otherComplaints: z.string().optional(),
  doctorName: z.string().optional(),
  surgeryNotes: z.string().optional(),
  medicalAcknowledgment: z.boolean().refine(val => val === true, "You must acknowledge"),
  
  // Step 6
  filmingConsent: z.boolean().default(false),
  liabilityWaiverSigned: z.boolean().refine(val => val === true, "Waiver signature required"),
  termsAccepted: z.boolean().refine(val => val === true, "You must accept terms"),
  signatureData: z.string().min(1, "Please sign above"),
  
  // Step 7
  paymentMethod: z.enum(["stripe", "apple_pay", "paypal", "cash"]),
});
```

## Step-by-Step Validation

Only validate the fields relevant to the current step before allowing "Continue":

```typescript
const stepFields: Record<number, (keyof BookingFormData)[]> = {
  1: ["serviceId"],
  2: ["bookingDate", "timeSlot"],
  3: ["fullName", "phone", "email"],
  4: ["hasHadExtensions"],
  5: ["medicalAcknowledgment"],
  6: ["liabilityWaiverSigned", "termsAccepted", "signatureData"],
  7: ["paymentMethod"],
};
```

## Calendar & Time Slot Component (Step 2)

- Use shadcn/ui `Calendar` component as the base
- Fetch available dates from `/api/availability?month=2026-03&serviceId=xxx`
- On date select, fetch time slots from `/api/availability?date=2026-03-12&serviceId=xxx`
- Disabled dates: past dates, blocked dates, fully-booked dates
- Time slots displayed as button grid (3 columns on mobile, flexible on desktop)
- Selected time gets a prominent visual indicator

## Signature Capture (Step 6)

```bash
npm install react-signature-canvas @types/react-signature-canvas
```

- Canvas fills available width, height ~120px
- On mobile: user draws with finger
- On desktop: user draws with mouse
- "Clear" button resets canvas
- On step submit, export canvas as base64 PNG via `sigCanvas.toDataURL()`
- Store base64 string in form state as `signatureData`

## Payment Flow (Step 7)

See `agent_docs/STRIPE_INTEGRATION.md` for full Stripe implementation details.

Summary:
1. User clicks a payment button
2. Frontend calls `/api/stripe/checkout` with all booking data
3. API route validates data, creates Stripe Checkout Session with `mode: "payment"` and `amount: deposit_amount`
4. User redirected to Stripe's hosted checkout page
5. On success: Stripe redirects to `/confirmation/[bookingId]`
6. Stripe webhook (`/api/stripe/webhook`) fires → creates booking + client + intake_form + agreement records in Supabase → sends confirmation email
7. On cancel/failure: user returned to booking page, nothing saved

For cash option:
1. User checks "cash" checkbox and clicks "Confirm Booking"
2. Frontend calls `/api/bookings` directly (no Stripe)
3. API route creates all records with `deposit_paid: false`, `payment_method: 'cash'`
4. Redirect to confirmation page
5. Send confirmation email noting cash payment expected at appointment

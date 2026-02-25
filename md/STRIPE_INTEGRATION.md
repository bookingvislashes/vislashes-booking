# Stripe Integration — Deposits & Payments

## Setup

```bash
npm install stripe @stripe/stripe-js
```

```env
# .env.local
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Stripe Dashboard Configuration

Before coding, configure these in the Stripe Dashboard:
1. Enable Apple Pay in Settings > Payment Methods
2. Enable PayPal in Settings > Payment Methods (if available in your region)
3. Register your domain for Apple Pay (Settings > Apple Pay > Add Domain)
4. Set up webhook endpoint pointing to `https://yourdomain.com/api/stripe/webhook`
5. Subscribe to event: `checkout.session.completed`

## Stripe Client Config

```typescript
// lib/stripe.ts
import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-12-18.acacia",
  typescript: true,
});
```

## Checkout Session Creation

```typescript
// app/api/stripe/checkout/route.ts
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { z } from "zod";

const checkoutSchema = z.object({
  serviceId: z.string().uuid(),
  serviceName: z.string(),
  depositAmount: z.number().positive(),
  bookingDate: z.string(),
  timeSlot: z.string(),
  customerEmail: z.string().email(),
  customerName: z.string(),
  // Include all form data as metadata so webhook can create records
  formData: z.record(z.unknown()),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const data = checkoutSchema.parse(body);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    // Apple Pay and PayPal are enabled via Stripe Dashboard, not code
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `VIS Lashes Deposit — ${data.serviceName}`,
            description: `${data.bookingDate} at ${data.timeSlot}`,
          },
          unit_amount: Math.round(data.depositAmount * 100), // Stripe uses cents
        },
        quantity: 1,
      },
    ],
    customer_email: data.customerEmail,
    metadata: {
      // Store all booking data as JSON string in metadata
      // Webhook will parse this to create database records
      booking_data: JSON.stringify(data.formData),
      service_id: data.serviceId,
    },
    success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/confirmation/{CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/book?cancelled=true`,
  });

  return NextResponse.json({ url: session.url });
}
```

## Webhook Handler

This is the critical path. When Stripe confirms payment, the webhook creates ALL database records.

```typescript
// app/api/stripe/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;

  // IMPORTANT: Always verify webhook signature
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const bookingData = JSON.parse(session.metadata!.booking_data);

    const supabase = createClient();

    // 1. Upsert client (find by email or create new)
    const { data: client } = await supabase
      .from("clients")
      .upsert(
        {
          full_name: bookingData.fullName,
          email: bookingData.email,
          phone: bookingData.phone,
        },
        { onConflict: "email" }
      )
      .select()
      .single();

    // 2. Create booking
    const { data: booking } = await supabase
      .from("bookings")
      .insert({
        client_id: client!.id,
        service_id: session.metadata!.service_id,
        booking_date: bookingData.bookingDate,
        start_time: bookingData.timeSlot,
        end_time: bookingData.calculatedEndTime,
        status: "confirmed",
        deposit_paid: true,
        deposit_amount: session.amount_total! / 100,
        payment_method: "stripe",
        stripe_payment_id: session.payment_intent as string,
        stripe_session_id: session.id,
      })
      .select()
      .single();

    // 3. Create intake form
    await supabase.from("intake_forms").insert({
      booking_id: booking!.id,
      has_had_extensions: bookingData.hasHadExtensions,
      is_special_occasion: bookingData.isSpecialOccasion,
      occasion_details: bookingData.occasionDetails,
      has_cataracts: bookingData.hasCataracts,
      has_conjunctivitis: bookingData.hasConjunctivitis,
      has_dry_eye: bookingData.hasDryEye,
      has_glaucoma: bookingData.hasGlaucoma,
      other_complaints: bookingData.otherComplaints,
      doctor_name: bookingData.doctorName,
      surgery_notes: bookingData.surgeryNotes,
      medical_acknowledgment: bookingData.medicalAcknowledgment,
    });

    // 4. Create agreement record
    await supabase.from("agreements").insert({
      booking_id: booking!.id,
      filming_consent: bookingData.filmingConsent,
      liability_waiver_signed: bookingData.liabilityWaiverSigned,
      terms_accepted: bookingData.termsAccepted,
      signature_data: bookingData.signatureData,
      ip_address: req.headers.get("x-forwarded-for") || "unknown",
      user_agent: req.headers.get("user-agent") || "unknown",
    });

    // 5. Send confirmation email (see EMAIL_AUTOMATIONS.md)
    // await sendConfirmationEmail(client, booking, service);

    // 6. Create Google Calendar event (see CALENDAR_SYNC.md)
    // await createCalendarEvent(booking, client, service);
  }

  return NextResponse.json({ received: true });
}

// IMPORTANT: Disable Next.js body parsing for webhooks
export const config = {
  api: { bodyParser: false },
};
```

## Confirmation Page

The confirmation page receives the Stripe Checkout Session ID in the URL and fetches booking details.

```typescript
// app/confirmation/[sessionId]/page.tsx
// Fetch booking by stripe_session_id to display confirmation details
// Show: service name, date, time, deposit amount paid
// Include "Back to Home" and "Add to Calendar" (.ics download) buttons
```

## Testing Locally

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Forward webhooks to local dev server
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Use test card numbers:
# Success: 4242 4242 4242 4242
# Decline: 4000 0000 0000 0002
# 3D Secure: 4000 0025 0000 3155
```

## Going Live Checklist

1. Switch `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` to live keys
2. Update `STRIPE_WEBHOOK_SECRET` to the live webhook's signing secret
3. Verify Apple Pay domain in Stripe Dashboard (production domain)
4. Test a real $10 deposit end-to-end
5. Verify webhook fires and creates records in production Supabase

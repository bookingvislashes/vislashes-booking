import { NextRequest, NextResponse } from "next/server";
import { WebhooksHelper } from "square";
import { createServiceClient } from "@/lib/supabase/server";
import { recordOrphanPayment } from "@/lib/orphan-payments";
import { salonDateOf } from "@/lib/salon-time";
import { parseCheckoutRef } from "@/lib/square-pos";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("x-square-hmacsha256-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  // Verify webhook signature using Square SDK helper
  const notificationUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/square/webhook`;
  // verifySignature returns a Promise. Without await it is always a truthy
  // object, so the guard below never fired and this endpoint accepted any
  // anonymous POST as a genuine Square event.
  let isValid = false;
  try {
    isValid = await WebhooksHelper.verifySignature({
      requestBody: body,
      signatureHeader: signature,
      signatureKey: process.env.SQUARE_WEBHOOK_SIGNATURE_KEY!,
      notificationUrl,
    });
  } catch (err) {
    // Thrown when the signature key is missing entirely — previously an
    // unhandled rejection while the route still answered 200.
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json(
      { error: "Verification unavailable" },
      { status: 500 }
    );
  }

  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(body);

  // Square emits payment.created and payment.updated. The old handler branched
  // on "payment.completed", which Square does not send, so that branch was
  // dead and only the second ever ran.
  if (event.type === "payment.created" || event.type === "payment.updated") {
    const payment = event.data?.object?.payment;

    // Only a payment this site created can be "missing a booking". The salon
    // also takes card payments in person through the Square app, and those
    // legitimately have no booking row — flagging every one of them would
    // bury the handful of real cases in a list nobody could then trust. The
    // note is set by /api/square/process-payment on every deposit it charges.
    const isSiteDeposit =
      typeof payment?.note === "string" &&
      payment.note.startsWith("VIS Lashes Deposit");

    // A refund does not change the payment's own status — it stays COMPLETED
    // and Square re-fires payment.updated. process-payment already refunds
    // automatically when the booking fails after capture, so without this the
    // path that handled itself correctly would still be reported as money
    // owed to someone.
    const capturedCents = payment?.amount_money?.amount;
    const refundedCents = payment?.refunded_money?.amount ?? 0;
    const fullyRefunded =
      typeof capturedCents === "number" && refundedCents >= capturedCents;

    if (payment?.status === "COMPLETED" && payment.id && isSiteDeposit && !fullyRefunded) {
      const supabase = await createServiceClient();
      const { data: booking, error } = await supabase
        .from("bookings")
        .select("id")
        .eq("square_payment_id", payment.id)
        .maybeSingle();

      if (error) {
        console.error("Webhook: booking lookup failed:", error);
      } else if (!booking) {
        // A completed payment with no booking behind it: money taken and
        // nothing delivered. Loud, and with everything needed to find the
        // customer in the Square dashboard.
        console.error(
          "ORPHAN PAYMENT — captured with no matching booking.",
          {
            paymentId: payment.id,
            amount: payment.amount_money?.amount,
            currency: payment.amount_money?.currency,
            email: payment.buyer_email_address,
            createdAt: payment.created_at,
          }
        );

        // Square reports money in the smallest denomination, so a $25 deposit
        // arrives as 2500. The ledger stores dollars, matching bookings and
        // services, so that a reconciliation screen never compares 2500
        // against 25.00 and calls them different.
        await recordOrphanPayment(supabase, {
          squarePaymentId: payment.id,
          amount:
            typeof capturedCents === "number" ? capturedCents / 100 : null,
          currency: payment.amount_money?.currency ?? null,
          customerEmail: payment.buyer_email_address ?? null,
          failureReason:
            "Square reported a completed payment with no matching booking.",
        });
      }
    }

    // A completed payment that is NOT one of this site's own deposits is the
    // other half of her money: what she collects in person, with her phone
    // or a reader, through the Square app itself — including whatever a
    // client added as a tip. Nothing prompted this site to charge a card, so
    // there is no idempotency key to reuse from process-payment; the row's
    // uniqueness on square_payment_id is what stops Square's retries from
    // being counted twice, and the upsert below only ever touches the money
    // fields, never an attribution she — or a later pass here — already set.
    if (
      payment?.status === "COMPLETED" &&
      payment.id &&
      !isSiteDeposit &&
      !fullyRefunded &&
      typeof capturedCents === "number"
    ) {
      const supabase = await createServiceClient();
      const tipCents = payment.tip_money?.amount ?? 0;
      const serviceAmount = (capturedCents - tipCents) / 100;
      const tipAmount = tipCents / 100;
      const paidOn = salonDateOf(payment.created_at ?? new Date());

      let bookingId: string | null = null;
      let clientId: string | null = null;
      let clientName: string | null = null;

      // Exact attribution first. When the checkout was started from the Today
      // screen, the site wrote a reference into the payment's note before
      // handing the sale to the Square app — so this is not a guess at all,
      // it is the appointment she was looking at when she charged the card.
      const ref = parseCheckoutRef(payment.note);
      if (ref) {
        const { data: referenced } = await supabase
          .from("bookings")
          .select("id, client_id, client:clients(full_name)")
          .eq("checkout_ref", ref)
          .maybeSingle();

        if (referenced) {
          bookingId = referenced.id;
          clientId = referenced.client_id ?? null;
          const clientRow = Array.isArray(referenced.client)
            ? referenced.client[0]
            : referenced.client;
          clientName = clientRow?.full_name ?? null;
        }
      }

      // Otherwise fall back to the guess, which is all there is for a card
      // she rings up in the Square app on her own: today's confirmed
      // appointment, if there is exactly one that has not already collected a
      // payment. A card charged in the salon almost always belongs to whoever
      // is in the chair right now, but with more than one appointment that
      // day (or none) a guess is worse than no guess — she can attribute it
      // from the Today screen in ten seconds, and a wrong guess she never
      // checks is a wrong tax number.
      const { data: candidates } = bookingId
        ? { data: null }
        : await supabase
            .from("bookings")
            .select("id, client_id, client:clients(full_name)")
            .eq("booking_date", paidOn)
            .in("status", ["confirmed", "completed"]);

      if (!bookingId && candidates && candidates.length) {
        const unclaimed: typeof candidates = [];
        for (const c of candidates) {
          const { count } = await supabase
            .from("payments")
            .select("id", { count: "exact", head: true })
            .eq("booking_id", c.id);
          if (!count) unclaimed.push(c);
        }
        if (unclaimed.length === 1) {
          const match = unclaimed[0];
          bookingId = match.id;
          clientId = match.client_id ?? null;
          const clientRow = Array.isArray(match.client)
            ? match.client[0]
            : match.client;
          clientName = clientRow?.full_name ?? null;
        }
      }

      // A plain upsert would overwrite booking_id/client_id on every retry,
      // silently undoing an attribution she makes from the Today screen
      // after the first event lands. Insert once; if the row already exists
      // (Square re-fired, or amended the tip), update only the money fields.
      const { error: insertError } = await supabase.from("payments").insert({
        square_payment_id: payment.id,
        booking_id: bookingId,
        client_id: clientId,
        client_name: clientName,
        paid_at: payment.created_at ?? new Date().toISOString(),
        paid_on: paidOn,
        method: "card",
        source: "square",
        service_amount: serviceAmount,
        tip_amount: tipAmount,
      });

      if (insertError?.code === "23505") {
        const { error: updateError } = await supabase
          .from("payments")
          .update({
            paid_at: payment.created_at ?? undefined,
            service_amount: serviceAmount,
            tip_amount: tipAmount,
          })
          .eq("square_payment_id", payment.id);
        if (updateError) {
          console.error("Webhook: could not update in-person payment:", updateError);
        }
      } else if (insertError) {
        console.error("Webhook: could not record in-person payment:", insertError);
      }
    }
  }

  return NextResponse.json({ received: true });
}

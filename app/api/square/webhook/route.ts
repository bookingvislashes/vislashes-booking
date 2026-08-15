import { NextRequest, NextResponse } from "next/server";
import { WebhooksHelper } from "square";
import { createServiceClient } from "@/lib/supabase/server";
import { recordOrphanPayment } from "@/lib/orphan-payments";

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
  }

  return NextResponse.json({ received: true });
}

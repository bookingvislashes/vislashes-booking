import { NextRequest, NextResponse } from "next/server";
import { WebhooksHelper } from "square";
import { createServiceClient } from "@/lib/supabase/server";

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

    if (payment?.status === "COMPLETED" && payment.id) {
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
      }
    }
  }

  return NextResponse.json({ received: true });
}

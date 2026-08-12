import { NextRequest, NextResponse } from "next/server";
import { WebhooksHelper } from "square";

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

  // Log payment events for reconciliation
  if (event.type === "payment.completed") {
    console.log(
      "Square payment completed:",
      event.data?.object?.payment?.id
    );
  }

  if (event.type === "payment.updated") {
    console.log(
      "Square payment updated:",
      event.data?.object?.payment?.id
    );
  }

  return NextResponse.json({ received: true });
}

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
  const isValid = WebhooksHelper.verifySignature({
    requestBody: body,
    signatureHeader: signature,
    signatureKey: process.env.SQUARE_WEBHOOK_SIGNATURE_KEY!,
    notificationUrl,
  });

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

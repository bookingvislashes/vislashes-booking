import { NextRequest, NextResponse } from "next/server";
import { getSquareClient, toCents } from "@/lib/square";
import { SquareError } from "square";
import { createServiceClient } from "@/lib/supabase/server";
import { createBooking } from "@/lib/create-booking";
import { z } from "zod";
import { randomUUID } from "crypto";

const paymentSchema = z.object({
  sourceId: z.string().min(1),
  serviceId: z.string().min(1),
  serviceName: z.string(),
  depositAmount: z.number().positive(),
  bookingDate: z.string(),
  timeSlot: z.string(),
  customerEmail: z.string().email(),
  customerName: z.string(),
  formData: z.record(z.string(), z.unknown()),
  verificationToken: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = paymentSchema.parse(body);

    const client = getSquareClient();
    const { payment } = await client.payments.create({
      sourceId: data.sourceId,
      idempotencyKey: randomUUID(),
      amountMoney: {
        amount: toCents(data.depositAmount),
        currency: "USD",
      },
      locationId: process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID!,
      buyerEmailAddress: data.customerEmail,
      note: `VIS Lashes Deposit - ${data.serviceName}`,
      referenceId: data.serviceId,
      verificationToken: data.verificationToken,
    });

    if (!payment || payment.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "Payment was not completed" },
        { status: 400 }
      );
    }

    // Payment succeeded — create booking synchronously
    const supabase = await createServiceClient();
    const bookingResult = await createBooking({
      supabase,
      formData: data.formData as unknown as Parameters<typeof createBooking>[0]["formData"],
      depositPaid: true,
      depositAmount: data.depositAmount,
      squarePaymentId: payment.id,
    });

    return NextResponse.json({
      bookingId: bookingResult.bookingId,
      paymentId: payment.id,
    });
  } catch (error: unknown) {
    console.error("Square payment error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data" },
        { status: 400 }
      );
    }
    if (error instanceof SquareError) {
      return NextResponse.json(
        { error: error.errors?.[0]?.detail || "Payment failed" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Payment processing failed" },
      { status: 500 }
    );
  }
}

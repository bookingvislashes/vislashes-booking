import { NextRequest, NextResponse } from "next/server";
import { getSquareClient, toCents } from "@/lib/square";
import { SquareError } from "square";
import { createServiceClient } from "@/lib/supabase/server";
import { createBooking } from "@/lib/create-booking";
import { bookingSchema } from "@/lib/schemas";
import { notifyAdmins } from "@/lib/push";
import { recordOrphanPayment } from "@/lib/orphan-payments";
import { z } from "zod";

const paymentSchema = z.object({
  sourceId: z.string().min(1),
  serviceId: z.string().min(1),
  serviceName: z.string(),
  // One id per mounted payment form, so a customer tapping Pay twice after a
  // failure collapses onto a single Square payment instead of being charged
  // again. Previously a fresh randomUUID() was minted per request, which made
  // Square's deduplication impossible by construction.
  attemptId: z.string().uuid(),
  bookingDate: z.string(),
  timeSlot: z.string(),
  customerEmail: z.string().email(),
  customerName: z.string(),
  // Was z.record(z.string(), z.unknown()) — anything at all. The cash route
  // validated the identical payload properly, so a booking that the cash path
  // rejected could be charged here and only then fail at insert time.
  formData: bookingSchema,
  verificationToken: z.string().optional(),
});

export async function POST(req: NextRequest) {
  let paymentId: string | undefined;
  const square = getSquareClient();

  try {
    const body = await req.json();
    const data = paymentSchema.parse(body);

    const supabase = await createServiceClient();

    // The amount is resolved from the database, never from the request. It used
    // to be a client-supplied number, so editing it in devtools bought a $55
    // set for a cent and still produced a confirmed, deposit_paid booking.
    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("id, name, deposit_amount")
      .eq("id", data.serviceId)
      .eq("is_active", true)
      .maybeSingle();

    if (serviceError || !service) {
      return NextResponse.json(
        { error: "That service is no longer available." },
        { status: 400 }
      );
    }

    // Cheap guard against the obvious double-book: someone taking the slot
    // between the availability call and this request. Not a substitute for a
    // unique index, which is the only thing that closes the race properly.
    const { data: clash } = await supabase
      .from("bookings")
      .select("id")
      .eq("booking_date", data.formData.bookingDate)
      .eq("time_slot", data.formData.timeSlot)
      .eq("status", "confirmed")
      .maybeSingle();

    if (clash) {
      return NextResponse.json(
        { error: "SLOT_TAKEN", message: "That time was just booked. Please pick another." },
        { status: 409 }
      );
    }

    const depositAmount = Number(service.deposit_amount);

    // Removal price and length come from settings, never from the request —
    // the same rule the deposit follows. The deposit itself is unchanged by a
    // removal: it secures the slot, and the removal is part of the balance
    // settled at the appointment.
    const { data: removalSettings } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", ["removal_price", "removal_duration_minutes"]);

    const removalMap = Object.fromEntries(
      (removalSettings || []).map((r) => [r.key, r.value])
    );
    const removalPrice = Number(removalMap.removal_price ?? 25) || 0;
    const removalMinutes = Number(removalMap.removal_duration_minutes ?? 30) || 0;

    const { payment } = await square.payments.create({
      sourceId: data.sourceId,
      idempotencyKey: data.attemptId,
      amountMoney: {
        amount: toCents(depositAmount),
        currency: "USD",
      },
      locationId: process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID!,
      buyerEmailAddress: data.customerEmail,
      note: `VIS Lashes Deposit - ${service.name}`,
      referenceId: data.serviceId,
      verificationToken: data.verificationToken,
    });

    // `id` is optional on Square's Payment type. A completed capture without
    // one cannot be refunded, reconciled or even referred to in a support
    // conversation, so it is treated as a failure here rather than carried
    // forward as an undefined that quietly disables both recovery paths below.
    if (!payment || payment.status !== "COMPLETED" || !payment.id) {
      if (payment && payment.status === "COMPLETED" && !payment.id) {
        console.error(
          "Square returned a COMPLETED payment with no id — cannot reconcile.",
          { amount: depositAmount, email: data.customerEmail }
        );
      }
      return NextResponse.json(
        { error: "Payment was not completed" },
        { status: 400 }
      );
    }

    paymentId = payment.id;

    // From here the card has been charged. Any failure below must either undo
    // the charge or tell the customer exactly what happened — previously a
    // throw in createBooking returned a generic 500 and the money was simply
    // gone, with the payment id never logged or returned.
    try {
      const bookingResult = await createBooking({
        supabase,
        formData: data.formData,
        depositPaid: true,
        depositAmount,
        squarePaymentId: payment.id,
        removalPrice,
        removalMinutes,
      });

      // Best-effort: notifyAdmins swallows its own errors internally, so this
      // can never turn a successful, already-charged booking into a failed
      // response just because a phone was unreachable.
      await notifyAdmins(supabase, {
        title: "New booking",
        body: `${data.formData.fullName} · ${service.name} · ${data.formData.bookingDate} at ${data.formData.timeSlot}`,
        // Straight to the appointment rather than the list — tapping an alert
        // should land on the thing the alert was about.
        url: `/admin/bookings/${bookingResult.bookingId}`,
      });

      return NextResponse.json({
        bookingId: bookingResult.bookingId,
        paymentId: payment.id,
      });
    } catch (bookingError) {
      console.error(
        `Booking failed AFTER capture. paymentId=${payment.id} amount=${depositAmount} email=${data.customerEmail}`,
        bookingError
      );

      let refunded = false;
      try {
        await square.refunds.refundPayment({
          idempotencyKey: `refund-${data.attemptId}`,
          paymentId: payment.id,
          amountMoney: { amount: toCents(depositAmount), currency: "USD" },
          reason: "Booking could not be created",
        });
        refunded = true;
      } catch (refundError) {
        console.error(
          `REFUND ALSO FAILED — manual action required for paymentId=${payment.id}`,
          refundError
        );

        // Charged, no booking, and the money could not be handed back. This
        // is the only state where the customer is genuinely out of pocket
        // with nothing to show for it, so it goes somewhere durable rather
        // than living in a log line — Settings → Payments surfaces it.
        await recordOrphanPayment(supabase, {
          squarePaymentId: payment.id,
          amount: depositAmount,
          currency: "USD",
          customerEmail: data.customerEmail,
          serviceId: data.serviceId,
          bookingDate: data.formData.bookingDate,
          timeSlot: data.formData.timeSlot,
          failureReason:
            "Card was charged but the booking could not be saved, and the automatic refund also failed.",
        });
      }

      return NextResponse.json(
        {
          error: "PAID_BOOKING_FAILED",
          paymentId: payment.id,
          refunded,
          message: refunded
            ? "Your card was charged and automatically refunded — the booking could not be saved. Please try again."
            : "Your card was charged but the booking could not be saved. Please contact the salon with this reference.",
        },
        { status: 409 }
      );
    }
  } catch (error: unknown) {
    // paymentId is set only once capture succeeded, so its presence here means
    // money moved and the failure is not a plain validation error.
    console.error("Square payment error:", { paymentId }, error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request data" }, { status: 400 });
    }
    if (error instanceof SquareError) {
      return NextResponse.json(
        { error: error.errors?.[0]?.detail || "Payment failed" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Payment processing failed", paymentId },
      { status: 500 }
    );
  }
}

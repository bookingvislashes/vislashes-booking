import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { createBookingEvent, deleteBookingEvent } from "@/lib/google-calendar";
import { sendCancellationEmail } from "@/lib/email";

/**
 * Cancel and reschedule, run server-side.
 *
 * The admin can write `status` straight from the browser, but the two side
 * effects that make these actions correct — moving the Google Calendar event
 * and emailing the client — need the service role and secrets the browser
 * does not have. Doing the whole thing here also means the calendar can never
 * disagree with the booking because only half the work ran.
 */

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("cancel"),
    bookingId: z.string().uuid(),
    reason: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal("reschedule"),
    bookingId: z.string().uuid(),
    bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    timeSlot: z.string().min(1),
  }),
]);

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const admin = await createServiceClient();

  const { data: booking, error: loadError } = await admin
    .from("bookings")
    .select(
      "id, booking_date, time_slot, status, deposit_paid, client:clients(full_name, email, phone), service:services(name, duration_minutes)"
    )
    .eq("id", input.bookingId)
    .maybeSingle();

  if (loadError || !booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const client = Array.isArray(booking.client) ? booking.client[0] : booking.client;
  const service = Array.isArray(booking.service) ? booking.service[0] : booking.service;

  if (input.action === "cancel") {
    const { error } = await admin
      .from("bookings")
      .update({
        status: "cancelled",
        cancellation_reason: input.reason?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.bookingId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Both best-effort: the cancellation itself is saved, and neither a
    // stale calendar entry nor an unsent email is worth reporting it as
    // failed and having her try again.
    await deleteBookingEvent(admin, input.bookingId);

    if (client?.email) {
      try {
        await sendCancellationEmail({
          clientName: client.full_name,
          clientEmail: client.email,
          bookingDate: booking.booking_date,
          timeSlot: booking.time_slot,
          depositPaid: Boolean(booking.deposit_paid),
        });
      } catch (err) {
        console.error("Cancellation email failed:", err);
      }
    }

    return NextResponse.json({ ok: true });
  }

  // ---- reschedule ----

  // Same guard the payment route uses: another confirmed booking already in
  // that slot means moving this one would double-book the salon.
  const { data: clash } = await admin
    .from("bookings")
    .select("id")
    .eq("booking_date", input.bookingDate)
    .eq("time_slot", input.timeSlot)
    .eq("status", "confirmed")
    .neq("id", input.bookingId)
    .maybeSingle();

  if (clash) {
    return NextResponse.json(
      { error: "SLOT_TAKEN", message: "Another appointment already has that time." },
      { status: 409 }
    );
  }

  // The old event is removed before the new one is written, so a failure
  // midway leaves one event rather than two competing ones on her calendar.
  await deleteBookingEvent(admin, input.bookingId);

  const { error: updateError } = await admin
    .from("bookings")
    .update({
      booking_date: input.bookingDate,
      time_slot: input.timeSlot,
      // The client is being told about the new time by hand, and a reminder
      // already sent refers to the old one — clearing this lets the cron send
      // a correct reminder for the new date.
      reminder_sent_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.bookingId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (client && service) {
    await createBookingEvent(admin, {
      bookingId: input.bookingId,
      serviceName: service.name,
      durationMinutes: service.duration_minutes,
      clientName: client.full_name,
      clientEmail: client.email,
      clientPhone: client.phone,
      bookingDate: input.bookingDate,
      timeSlot: input.timeSlot,
    });
  }

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { syncBookingEvent, deleteBookingEvent } from "@/lib/google-calendar";
import { getEmailSettings, sendCancellationEmail } from "@/lib/email";
import { cancellationText, isSmsConfigured, sendSms, toE164 } from "@/lib/sms";

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
      "id, booking_date, time_slot, status, deposit_paid, client:clients(full_name, email, phone, sms_consent, sms_opt_out)"
    )
    .eq("id", input.bookingId)
    .maybeSingle();

  if (loadError || !booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const client = Array.isArray(booking.client) ? booking.client[0] : booking.client;

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
      // Reply-To is her Business Email from Settings: a cancellation is the
      // message a client is most likely to answer, and the answer has to
      // reach her rather than the send-only address it came from.
      const { businessEmail } = await getEmailSettings(admin);
      try {
        await sendCancellationEmail({
          clientName: client.full_name,
          clientEmail: client.email,
          bookingDate: booking.booking_date,
          timeSlot: booking.time_slot,
          depositPaid: Boolean(booking.deposit_paid),
          replyTo: businessEmail,
        });
      } catch (err) {
        console.error("Cancellation email failed:", err);
      }
    }

    // Also by text. Of all the messages this site sends, this is the one a
    // client most needs to see today rather than whenever she next opens her
    // email — otherwise she drives to an appointment that is not happening.
    // Best-effort, like the email: the cancellation is already saved. Still
    // gated on consent — a cancellation being urgent is not a reason to text
    // someone who never agreed to be texted; her email still goes out.
    if (client?.sms_consent && !client?.sms_opt_out && isSmsConfigured()) {
      const phone = toE164(client?.phone);
      if (phone) {
        try {
          await sendSms(
            phone,
            cancellationText({
              clientName: client.full_name,
              bookingDate: booking.booking_date,
              timeSlot: booking.time_slot,
            })
          );
        } catch (err) {
          console.error("Cancellation text failed:", err);
        }
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

  // Moves the existing event rather than deleting and re-creating it, so the
  // entry keeps its id and whatever reminder she had set on it. It also
  // re-reads the booking instead of being handed the few fields this route
  // happened to load — a reschedule used to drop the deposit line and the
  // intake answers, leaving the event thinner every time it moved.
  await syncBookingEvent(admin, input.bookingId);

  return NextResponse.json({ ok: true });
}

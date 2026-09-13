import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { bookingIdFromToken } from "@/lib/reschedule-link";
import { loadAvailabilityContext, slotsForDate } from "@/lib/availability-range";
import { syncBookingEvent } from "@/lib/google-calendar";
import {
  getEmailSettings,
  ownerRecipients,
  sendConfirmationEmail,
} from "@/lib/email";
import { notifyAdmins } from "@/lib/push";
import { loadReschedulable, rescheduleBlock } from "@/lib/reschedule";

/**
 * A client moving their own appointment, from the link in their confirmation.
 *
 * The signed token is the only credential — there is no login — so everything
 * this route trusts is derived from it: which booking, and therefore which
 * client, service and deposit. Nothing about the appointment other than the
 * date and time can be changed here, and the deposit is never re-read from
 * the request, so a moved appointment cannot become a cheaper one.
 */

const schema = z.object({
  token: z.string().min(1).max(200),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeSlot: z.string().min(1).max(20),
});

function formatDuration(mins: number): string {
  const hrs = Math.floor(mins / 60);
  const m = mins % 60;
  if (hrs && m) return `${hrs} hr ${m} min`;
  if (hrs) return `${hrs} hr`;
  return `${m} min`;
}

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Rescheduling is temporarily unavailable." },
      { status: 503 }
    );
  }

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const bookingId = bookingIdFromToken(input.token);
  if (!bookingId) {
    return NextResponse.json({ error: "That link isn't valid." }, { status: 404 });
  }

  const admin = await createServiceClient();
  const booking = await loadReschedulable(admin, bookingId);

  if (!booking) {
    return NextResponse.json({ error: "That link isn't valid." }, { status: 404 });
  }

  // The same check the page ran before it drew a calendar, repeated because
  // the page's answer is minutes old by the time someone presses the button —
  // and because nothing stops a request arriving without the page having run.
  const blocked = rescheduleBlock(booking);
  if (blocked === "cancelled") {
    return NextResponse.json(
      { error: "That appointment isn't active any more." },
      { status: 409 }
    );
  }
  if (blocked) {
    return NextResponse.json(
      {
        error: "TOO_LATE",
        message:
          "Your appointment is coming up too soon to move online. Reply to your confirmation email and we'll sort it out.",
      },
      { status: 409 }
    );
  }

  // The authority on whether the new time is real. A bare "is anyone else in
  // that slot" check would happily accept a Sunday, a blocked afternoon, or a
  // start time that runs the appointment past closing — the slot engine is
  // what the calendar was drawn from, so it is what the write is checked
  // against. This booking is excluded so its own length doesn't rule out the
  // times either side of where it currently sits.
  const ctx = await loadAvailabilityContext(
    admin,
    input.bookingDate,
    input.bookingDate,
    bookingId
  );
  const offered = slotsForDate(
    ctx,
    input.bookingDate,
    booking.service.duration_minutes,
    booking.has_removal
  );

  if (!offered.includes(input.timeSlot)) {
    return NextResponse.json(
      {
        error: "SLOT_TAKEN",
        message: "That time was just taken. Please pick another.",
      },
      { status: 409 }
    );
  }

  const { error: updateError } = await admin
    .from("bookings")
    .update({
      booking_date: input.bookingDate,
      time_slot: input.timeSlot,
      // Both windows are cleared, or the cron would consider this booking
      // already reminded and the client would never hear about the new time.
      reminder_2day_sent_at: null,
      reminder_2hour_sent_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", bookingId)
    // Nothing else may have moved it in the meantime — she cancelled it, or
    // rescheduled it herself, while this page sat open.
    .eq("status", "confirmed")
    .eq("booking_date", booking.booking_date)
    .eq("time_slot", booking.time_slot)
    .select("id")
    .maybeSingle();

  if (updateError) {
    console.error("Reschedule: update failed:", updateError);
    return NextResponse.json(
      { error: "Couldn't move that appointment. Please try again." },
      { status: 500 }
    );
  }

  // Everything below is best-effort: the appointment has moved, and neither a
  // calendar Google refused nor an email Resend dropped is worth telling the
  // client it failed and having them move it twice.
  await syncBookingEvent(admin, bookingId);

  const appointmentMinutes =
    booking.service.duration_minutes +
    (booking.has_removal ? ctx.removalMinutes : 0);
  const appointmentTotal =
    Number(booking.service.price) + booking.removalPrice;

  const { studioAddress, ownerInbox, replyTo } = await getEmailSettings(admin);

  if (booking.client?.email) {
    await sendConfirmationEmail({
      variant: "moved",
      clientName: booking.client.full_name,
      clientEmail: booking.client.email,
      serviceName: booking.has_removal
        ? `${booking.service.name} + lash removal`
        : booking.service.name,
      bookingDate: input.bookingDate,
      timeSlot: input.timeSlot,
      duration: formatDuration(appointmentMinutes),
      depositAmount: Number(booking.deposit_amount ?? 0),
      depositPaid: Boolean(booking.deposit_paid),
      totalPrice: appointmentTotal,
      paymentMethod: booking.payment_method || "square",
      studioAddress,
      replyTo,
      bcc: ownerRecipients(ownerInbox),
      bookingId,
    });
  }

  await notifyAdmins(admin, {
    title: "Appointment moved",
    body: `${booking.client?.full_name || "A client"} moved to ${input.bookingDate} at ${input.timeSlot}`,
    url: `/admin/bookings/${bookingId}`,
  });

  return NextResponse.json({
    ok: true,
    bookingDate: input.bookingDate,
    timeSlot: input.timeSlot,
  });
}

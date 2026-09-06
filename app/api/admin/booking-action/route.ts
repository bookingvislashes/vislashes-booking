import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { syncBookingEvent, deleteBookingEvent } from "@/lib/google-calendar";
import { sendCancellationEmail } from "@/lib/email";
import { recordVisit, undoVisit, releaseReward } from "@/lib/loyalty";

/**
 * Cancel, reschedule, and closing an appointment out, run server-side.
 *
 * The admin can write `status` straight from the browser, but the side
 * effects that make these actions correct — moving the Google Calendar event,
 * emailing the client, counting the visit, issuing a loyalty reward — need
 * the service role and secrets the browser does not have. Doing the whole
 * thing here also means the calendar can never disagree with the booking
 * because only half the work ran.
 *
 * Marking an appointment completed used to happen in the browser, alongside a
 * read-then-write of the client's visit count. It moved here when loyalty
 * arrived: a reward is money off a bill, so nothing about it is writable from
 * a browser, and the guard below is what stops a second tap on Completed
 * counting a second visit.
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
  z.object({
    action: z.literal("close-out"),
    bookingId: z.string().uuid(),
    status: z.enum(["completed", "no_show"]),
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
      "id, booking_date, time_slot, status, deposit_paid, client_id, client:clients(full_name, email)"
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

    // A loyalty reward that was waiting on this appointment goes back to the
    // client rather than down with it. They earned it; it lands on whatever
    // they book next. Called unconditionally rather than gated on the
    // booking's loyalty_discount, so that the select above never has to name
    // a column migration 019 adds — cancel and reschedule read through that
    // same select, and neither may stop working while the migration is still
    // waiting to be run by hand. releaseReward is a no-op when there is
    // nothing to release, and swallows its own errors.
    await releaseReward(admin, input.bookingId);

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

  if (input.action === "close-out") {
    // Nothing to do if it is already sitting at that status. This is the
    // guard that makes the visit count safe: without it a second tap on
    // Completed counted a second visit, and five taps bought a $15 reward.
    if (booking.status === input.status) {
      return NextResponse.json({ ok: true, unchanged: true });
    }

    const { error } = await admin
      .from("bookings")
      .update({ status: input.status, updated_at: new Date().toISOString() })
      .eq("id", input.bookingId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!booking.client_id) {
      return NextResponse.json({ ok: true });
    }

    if (input.status === "completed") {
      // Visit history counts appointments actually kept, so it is recorded
      // here rather than when the booking was made.
      const recorded = await recordVisit(admin, {
        clientId: booking.client_id,
        bookingDate: booking.booking_date,
      });

      return NextResponse.json({
        ok: true,
        // Surfaced so the page can tell her, while the client is still in
        // front of her, that this visit just earned a reward.
        rewardEarned: recorded?.rewardEarned ?? null,
        loyaltyVisits: recorded?.loyaltyVisits ?? null,
      });
    }

    // Completed, then No show a second later — the mis-tap. Put the count
    // back where it was, and withdraw a reward the mistake had just issued
    // if it has not been promised to another appointment yet.
    if (booking.status === "completed") {
      await undoVisit(admin, { clientId: booking.client_id });
    }

    // Nobody sat in the chair, so nothing was spent. A reward waiting on this
    // appointment goes back to the client for whatever they book next — they
    // earned it by turning up five times, and a missed appointment is not a
    // reason to take it off them.
    await releaseReward(admin, input.bookingId);

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

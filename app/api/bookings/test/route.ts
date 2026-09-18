import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createBooking } from "@/lib/create-booking";
import { bookingSchema } from "@/lib/schemas";
import { notifyAdmins } from "@/lib/push";

/**
 * A dry run of the whole booking flow, for the salon only.
 *
 * The public pay-on-the-day route was retired precisely because it wrote a
 * confirmed booking with no payment behind it — anyone could hold the
 * calendar open for free. Its own note said such a thing "would need to be
 * admin-authenticated rather than public", and this is that: it requires a
 * signed-in admin session, so it is hers and nobody else's.
 *
 * Everything downstream is the real thing — the same createBooking, the same
 * confirmation email with her blind copy, the same Google Calendar sync, the
 * same confirmation page. Only the card is skipped, so she can verify the
 * flow end to end without charging herself.
 *
 * The booking it writes is real and holds a real slot. `booking_source` marks
 * it as a test and the note says so, so it is obvious in the admin and she
 * can cancel it when she is done.
 */

const schema = z.object({
  serviceId: z.string().min(1),
  formData: bookingSchema,
});

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Not available without a database." },
      { status: 503 }
    );
  }

  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Sign in to the admin first, then reload this page." },
      { status: 401 }
    );
  }

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  // Read exactly what the paid route reads, from the same places, so the
  // confirmation email this produces is the one a real client would get
  // rather than a lookalike built from different numbers.
  const { data: service } = await supabase
    .from("services")
    .select("id, name, deposit_amount")
    .eq("id", input.serviceId)
    .eq("is_active", true)
    .maybeSingle();

  if (!service) {
    return NextResponse.json(
      { error: "That service is no longer available." },
      { status: 400 }
    );
  }

  const { data: clash } = await supabase
    .from("bookings")
    .select("id")
    .eq("booking_date", input.formData.bookingDate)
    .eq("time_slot", input.formData.timeSlot)
    .eq("status", "confirmed")
    .maybeSingle();

  if (clash) {
    return NextResponse.json(
      { error: "SLOT_TAKEN", message: "That time is already booked. Pick another." },
      { status: 409 }
    );
  }

  const { data: removalSettings } = await supabase
    .from("settings")
    .select("key, value")
    .in("key", ["removal_price", "removal_duration_minutes"]);

  const removalMap = Object.fromEntries(
    (removalSettings || []).map((r) => [r.key, r.value])
  );

  try {
    // depositPaid: true with no Square payment id behind it. The point of the
    // exercise is to see the email a paying client receives, and a deposit
    // marked unpaid would print "due to hold your spot" instead of the line
    // she is checking. The row is stamped as a test either way.
    const { bookingId } = await createBooking({
      supabase,
      formData: input.formData,
      depositPaid: true,
      depositAmount: Number(service.deposit_amount),
      removalPrice: Number(removalMap.removal_price ?? 25) || 0,
      removalMinutes: Number(removalMap.removal_duration_minutes ?? 30) || 0,
      bookingSource: "test",
    });

    await supabase
      .from("bookings")
      .update({
        notes: "TEST BOOKING — no payment was taken. Safe to cancel.",
      })
      .eq("id", bookingId);

    // Included deliberately: "does the phone alert still work" is one of the
    // things this dry run is meant to answer.
    await notifyAdmins(supabase, {
      title: "Test booking",
      body: `${input.formData.fullName} · ${service.name} · ${input.formData.bookingDate} at ${input.formData.timeSlot}`,
      url: `/admin/bookings/${bookingId}`,
    });

    return NextResponse.json({ bookingId });
  } catch (err) {
    console.error("Test booking failed:", err);
    return NextResponse.json(
      { error: "Couldn't create that test booking." },
      { status: 500 }
    );
  }
}

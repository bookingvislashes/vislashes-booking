import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { bookingIdFromToken } from "@/lib/booking-links";
import { statusForRating } from "@/lib/reviews";
import { notifyAdmins } from "@/lib/push";

/**
 * A client leaving a review, from the link in their follow-up email.
 *
 * The signed token is the only credential and it is the whole gate: there is
 * no open review form on this site, so the only people who can leave one are
 * people who actually had an appointment — and only once each, which the
 * unique index on booking_id enforces rather than this route trusting itself.
 *
 * Where it ends up is decided here from the rating alone, never from the
 * request: four and five stars publish, anything lower is private feedback.
 */

const schema = z.object({
  token: z.string().min(1).max(200),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Reviews are temporarily unavailable." },
      { status: 503 }
    );
  }

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const bookingId = bookingIdFromToken(input.token, "review");
  if (!bookingId) {
    return NextResponse.json({ error: "That link isn't valid." }, { status: 404 });
  }

  const admin = await createServiceClient();

  const { data: booking } = await admin
    .from("bookings")
    .select("id, client_id, client:clients(full_name)")
    .eq("id", bookingId)
    .maybeSingle();

  if (!booking) {
    return NextResponse.json({ error: "That link isn't valid." }, { status: 404 });
  }

  const client = Array.isArray(booking.client) ? booking.client[0] : booking.client;
  const status = statusForRating(input.rating);
  const comment = (input.comment || "").trim() || null;

  const { error } = await admin.from("reviews").insert({
    booking_id: bookingId,
    client_id: booking.client_id,
    client_name: client?.full_name || "A client",
    rating: input.rating,
    comment,
    status,
    published_at: status === "published" ? new Date().toISOString() : null,
  });

  if (error) {
    // 23505 is the one-per-booking unique index. Not an error worth showing
    // as one — they have already left a review, and saying so is kinder than
    // "something went wrong".
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "ALREADY_REVIEWED", message: "You've already left a review — thank you!" },
        { status: 409 }
      );
    }
    console.error("Review insert failed:", error);
    return NextResponse.json(
      { error: "Couldn't save that. Please try again." },
      { status: 500 }
    );
  }

  // A low rating is the one she wants to know about today rather than
  // whenever she next opens the admin — it is usually fixable, and only for
  // a little while.
  if (status === "private") {
    await notifyAdmins(admin, {
      title: `${input.rating}-star feedback`,
      body: `${client?.full_name || "A client"} left private feedback. Worth a look.`,
      url: "/admin/reviews",
    });
  }

  return NextResponse.json({ ok: true, published: status === "published" });
}

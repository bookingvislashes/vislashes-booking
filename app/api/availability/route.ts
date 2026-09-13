import { NextRequest, NextResponse } from "next/server";
import {
  loadAvailabilityContext,
  previewContext,
  slotsForDate,
  PREVIEW_SERVICE_DURATIONS,
} from "@/lib/availability-range";
import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { bookingIdFromToken } from "@/lib/reschedule-link";

/**
 * A signed reschedule link makes one booking invisible to the slot engine, so
 * the client moving it can see the times their own appointment is currently
 * holding. The token is verified rather than trusted: a raw booking id here
 * would let anyone free up somebody else's slot on screen and double-book it.
 */
function excludedBooking(searchParams: URLSearchParams): string | null {
  const token = searchParams.get("token");
  return token ? bookingIdFromToken(token) : null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const serviceId = searchParams.get("serviceId");
  // A removal is done in the same appointment, so it lengthens it. Without
  // this the slot generator would size the visit as a set alone and offer a
  // start time that runs the removal straight into the next client.
  const withRemoval = searchParams.get("removal") === "1";

  if (!date || !serviceId) {
    return NextResponse.json(
      { error: "date and serviceId are required" },
      { status: 400 }
    );
  }

  // Local preview only. In production this used to answer 200 with a
  // fabricated Mon-Fri 09:00-17:00 week that ignored real hours, blocked dates
  // and existing bookings — so one mistyped env var showed customers an
  // invented calendar, and the POST then failed because /api/bookings has no
  // equivalent fallback. Failing closed is the only safe behaviour.
  if (!isSupabaseConfigured()) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "Availability requested but Supabase is not configured. Refusing to serve mock slots."
      );
      return NextResponse.json(
        { error: "Booking is temporarily unavailable. Please try again shortly." },
        { status: 503 }
      );
    }

    const slots = slotsForDate(
      previewContext(),
      date,
      PREVIEW_SERVICE_DURATIONS[serviceId] || 110,
      withRemoval
    );
    return NextResponse.json({ slots });
  }

  try {
    const supabase = await createServiceClient();

    // Fetch service duration. The error used to be discarded and the duration
    // defaulted to 110, so a deactivated or unknown service returned a full,
    // confident slot list — spacing a 60-minute refill as a 110-minute job, or
    // letting the customer complete seven steps and pay before hitting
    // "Service not found" at insert time.
    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("duration_minutes")
      .eq("id", serviceId)
      .eq("is_active", true)
      .maybeSingle();

    if (serviceError) {
      console.error("Availability: service lookup failed:", serviceError);
      return NextResponse.json(
        { error: "Failed to fetch availability" },
        { status: 500 }
      );
    }

    if (!service) {
      return NextResponse.json(
        { error: "That service is no longer available." },
        { status: 404 }
      );
    }

    // One date, so the range collapses to a single day. Everything the slot
    // engine needs — hours, overrides, blocks, bookings, buffer and advance
    // notice — comes back from the same loader the month grid uses, which is
    // what keeps a day drawn bookable and its time list in agreement.
    const ctx = await loadAvailabilityContext(
      supabase,
      date,
      date,
      excludedBooking(searchParams)
    );
    const slots = slotsForDate(
      ctx,
      date,
      service.duration_minutes,
      withRemoval
    );

    return NextResponse.json({ slots });
  } catch (error) {
    console.error("Availability error:", error);
    return NextResponse.json(
      { error: "Failed to fetch availability" },
      { status: 500 }
    );
  }
}

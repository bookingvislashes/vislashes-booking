import { NextRequest, NextResponse } from "next/server";
import {
  loadAvailabilityContext,
  previewContext,
  slotsForDate,
  PREVIEW_SERVICE_DURATIONS,
  type AvailabilityContext,
} from "@/lib/availability-range";
import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * Which dates in a range can actually be booked for one service.
 *
 * The booking calendar used to draw every future date identically, so a client
 * had to click a Sunday, a fully booked Saturday and a blocked week in turn to
 * discover each was empty. This answers the whole grid at once: a date is
 * returned only when the slot engine would offer at least one start time for
 * it, which is the same question /api/availability answers one date at a time.
 *
 * Six weeks of dates cost one set of queries, not forty-two.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Inclusive list of ISO dates. Pure string maths, so no timezone drift. */
function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  const cursor = new Date(from + "T00:00:00");
  const end = new Date(to + "T00:00:00");
  // Bounded so a reversed or absurd range cannot spin; the cap below rejects
  // anything longer anyway.
  while (cursor <= end && out.length < 100) {
    out.push(
      `${cursor.getFullYear()}-${(cursor.getMonth() + 1)
        .toString()
        .padStart(2, "0")}-${cursor.getDate().toString().padStart(2, "0")}`
    );
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

function bookableDates(
  ctx: AvailabilityContext,
  dates: string[],
  durationMinutes: number,
  withRemoval: boolean
): string[] {
  return dates.filter(
    (date) => slotsForDate(ctx, date, durationMinutes, withRemoval).length > 0
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const serviceId = searchParams.get("serviceId");
  const withRemoval = searchParams.get("removal") === "1";

  if (!from || !to || !ISO_DATE.test(from) || !ISO_DATE.test(to)) {
    return NextResponse.json(
      { error: "from and to are required, as YYYY-MM-DD" },
      { status: 400 }
    );
  }

  if (!serviceId) {
    return NextResponse.json(
      { error: "serviceId is required" },
      { status: 400 }
    );
  }

  const dates = eachDate(from, to);
  // A month grid draws 42 days. Anything beyond two months of dates is not the
  // calendar asking.
  if (dates.length === 0 || dates.length > 62) {
    return NextResponse.json(
      { error: "Ask for a range between 1 and 62 days." },
      { status: 400 }
    );
  }

  // Same stance as /api/availability: never invent a schedule in production.
  // The calendar treats a failure here as "don't know" and leaves every date
  // clickable, so a bad deploy degrades to the old behaviour rather than
  // showing the salon as fully booked.
  if (!isSupabaseConfigured()) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "Month availability requested but Supabase is not configured. Refusing to serve mock dates."
      );
      return NextResponse.json(
        { error: "Booking is temporarily unavailable. Please try again shortly." },
        { status: 503 }
      );
    }

    return NextResponse.json({
      dates: bookableDates(
        previewContext(),
        dates,
        PREVIEW_SERVICE_DURATIONS[serviceId] || 110,
        withRemoval
      ),
    });
  }

  try {
    const supabase = await createServiceClient();

    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("duration_minutes")
      .eq("id", serviceId)
      .eq("is_active", true)
      .maybeSingle();

    if (serviceError) {
      console.error("Month availability: service lookup failed:", serviceError);
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

    const ctx = await loadAvailabilityContext(supabase, from, to);

    return NextResponse.json({
      dates: bookableDates(ctx, dates, service.duration_minutes, withRemoval),
    });
  } catch (error) {
    console.error("Month availability error:", error);
    return NextResponse.json(
      { error: "Failed to fetch availability" },
      { status: 500 }
    );
  }
}

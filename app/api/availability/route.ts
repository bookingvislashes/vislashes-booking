import { NextRequest, NextResponse } from "next/server";
import { generateTimeSlots, to24Hour } from "@/lib/availability";
import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const serviceId = searchParams.get("serviceId");

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

    const serviceDurations: Record<string, number> = {
      "svc-natural-glam": 110,
      "svc-premium-wispy": 110,
      "svc-premium-custom": 110,
      "svc-natural-refill": 60,
      "svc-premium-refill": 60,
      "svc-premium-custom-refill": 60,
    };
    const mockAvailability = [
      { day_of_week: 1, start_time: "09:00", end_time: "17:00", is_active: true },
      { day_of_week: 2, start_time: "09:00", end_time: "17:00", is_active: true },
      { day_of_week: 3, start_time: "09:00", end_time: "17:00", is_active: true },
      { day_of_week: 4, start_time: "09:00", end_time: "17:00", is_active: true },
      { day_of_week: 5, start_time: "09:00", end_time: "17:00", is_active: true },
    ];
    const duration = serviceDurations[serviceId] || 110;
    // Use shorter advance window in preview mode so nearby dates show slots
    const slots = generateTimeSlots(date, duration, mockAvailability, [], [], 15, 2);
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

    const serviceDuration = service.duration_minutes;

    // Fetch recurring availability hours
    const { data: availability } = await supabase
      .from("availability")
      .select("day_of_week, start_time, end_time, is_active")
      .eq("is_active", true);

    // Fetch blocked dates for this date
    const { data: blockedDates } = await supabase
      .from("blocked_dates")
      .select("date, start_time, end_time")
      .eq("date", date);

    // Fetch existing bookings for this date (only confirmed ones block slots)
    const { data: existingBookings } = await supabase
      .from("bookings")
      .select("time_slot, service_id, services(duration_minutes)")
      .eq("booking_date", date)
      .eq("status", "confirmed");

    // Fetch settings for buffer and advance hours
    const { data: settings } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", ["buffer_minutes", "advance_booking_hours"]);

    const settingsMap = Object.fromEntries(
      (settings || []).map((s) => [s.key, s.value])
    );
    const bufferMinutes = parseInt(settingsMap.buffer_minutes || "15", 10);
    const advanceHours = parseInt(
      settingsMap.advance_booking_hours || "24",
      10
    );

    // Map blocked dates to the format generateTimeSlots expects
    // The function expects { blocked_date, start_time, end_time }
    // Truncated to HH:mm to match the slot strings they are compared against.
    // Postgres `time` arrives as "12:00:00", and "12:00" < "12:00:00" is true
    // lexicographically — so the slot starting exactly when a partial block
    // ended was treated as overlapping and silently dropped. Block 09:00-12:00
    // and the 12:00 appointment disappeared while the salon was free. The same
    // route already truncates booking times this way.
    const blockedForSlots = (blockedDates || []).map((b) => ({
      blocked_date: b.date as string,
      start_time: b.start_time ? (b.start_time as string).substring(0, 5) : null,
      end_time: b.end_time ? (b.end_time as string).substring(0, 5) : null,
    }));

    // Map bookings to { start_time, end_time } time ranges
    // Convert "10:00 AM" time_slot + duration into HH:mm start/end
    const bookingsForSlots = (existingBookings || []).map((b) => {
      const dur =
        (b.services as unknown as { duration_minutes: number })
          ?.duration_minutes || serviceDuration;
      const start24 = to24Hour(b.time_slot);
      const [h, m] = start24.split(":").map(Number);
      const endMins = h * 60 + m + dur;
      const end24 = `${Math.floor(endMins / 60)
        .toString()
        .padStart(2, "0")}:${(endMins % 60).toString().padStart(2, "0")}`;
      return { start_time: start24, end_time: end24 };
    });

    const slots = generateTimeSlots(
      date,
      serviceDuration,
      availability || [],
      blockedForSlots,
      bookingsForSlots,
      bufferMinutes,
      advanceHours
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

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { resolveWindow, to24Hour } from "@/lib/availability";
import type { ScheduleDay } from "@/lib/schedule";

/**
 * The salon's whole schedule across a date range, in one request.
 *
 * /api/availability answers one date at a time and returns bookable slots for
 * a customer. This answers the opposite question for the owner: for every date
 * in a range, what are the hours, what is blocked, and what is already booked.
 * A month grid needs all of that at once — thirty round trips to draw one
 * screen is why the admin has never had a calendar.
 *
 * Read-only. Every write goes through /api/admin/availability, which checks
 * for stranded bookings first.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Inclusive list of ISO dates. Pure string maths, so no timezone drift. */
function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  const cursor = new Date(from + "T00:00:00");
  const end = new Date(to + "T00:00:00");
  while (cursor <= end) {
    out.push(
      `${cursor.getFullYear()}-${(cursor.getMonth() + 1)
        .toString()
        .padStart(2, "0")}-${cursor.getDate().toString().padStart(2, "0")}`
    );
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to || !ISO_DATE.test(from) || !ISO_DATE.test(to)) {
    return NextResponse.json(
      { error: "from and to are required, as YYYY-MM-DD" },
      { status: 400 }
    );
  }

  const dates = eachDate(from, to);
  if (dates.length === 0 || dates.length > 120) {
    return NextResponse.json(
      { error: "Ask for a range between 1 and 120 days." },
      { status: 400 }
    );
  }

  try {
    const admin = await createServiceClient();

    const [availabilityRes, overridesRes, blocksRes, bookingsRes] =
      await Promise.all([
        // All seven rows, not just the active ones: the calendar needs the
        // active set to resolve windows, and the weekly-hours panel needs every
        // row including the days that are switched off. Fetching both here is
        // what lets that panel be a controlled component with no fetch of its
        // own — one request draws the entire page.
        admin
          .from("availability")
          .select("id, day_of_week, start_time, end_time, is_active")
          .order("day_of_week", { ascending: true }),
        // Absent until migration 008 is run. Treated as "no overrides", which
        // renders exactly the weekly hours the admin had before.
        admin
          .from("date_overrides")
          .select("date, is_open, start_time, end_time, note")
          .gte("date", from)
          .lte("date", to),
        admin
          .from("blocked_dates")
          .select("id, date, start_time, end_time, reason")
          .gte("date", from)
          .lte("date", to),
        admin
          .from("bookings")
          .select(
            "id, booking_date, time_slot, services(name, duration_minutes), clients(full_name)"
          )
          .gte("booking_date", from)
          .lte("booking_date", to)
          .eq("status", "confirmed"),
      ]);

    const allAvailability = availabilityRes.data || [];
    const availability = allAvailability.filter((a) => a.is_active);
    const overrides = overridesRes.data || [];
    const blocks = blocksRes.data || [];
    const bookings = bookingsRes.data || [];

    const overrideByDate = new Map(
      overrides.map((o) => [o.date as string, o])
    );

    const days: ScheduleDay[] = dates.map((date) => {
      const o = overrideByDate.get(date);
      const override = o
        ? {
            date: o.date as string,
            is_open: o.is_open as boolean,
            start_time: (o.start_time as string | null) ?? null,
            end_time: (o.end_time as string | null) ?? null,
          }
        : null;

      return {
        date,
        window: resolveWindow(date, availability, override),
        hasOverride: Boolean(o),
        overrideNote: (o?.note as string | null) ?? null,
        blocks: blocks
          .filter((b) => b.date === date)
          .map((b) => ({
            id: b.id as string,
            start: b.start_time
              ? (b.start_time as string).substring(0, 5)
              : null,
            end: b.end_time ? (b.end_time as string).substring(0, 5) : null,
            reason: (b.reason as string | null) ?? null,
          }))
          .sort((a, b) => (a.start ?? "").localeCompare(b.start ?? "")),
        bookings: bookings
          .filter((b) => b.booking_date === date)
          .map((b) => {
            const svc = b.services as unknown as {
              name: string;
              duration_minutes: number;
            } | null;
            const start = to24Hour(b.time_slot as string);
            const [h, m] = start.split(":").map(Number);
            const endMins = h * 60 + m + (svc?.duration_minutes ?? 0);
            return {
              id: b.id as string,
              start,
              end: `${Math.floor(endMins / 60)
                .toString()
                .padStart(2, "0")}:${(endMins % 60)
                .toString()
                .padStart(2, "0")}`,
              timeSlot: b.time_slot as string,
              client:
                (b.clients as unknown as { full_name: string } | null)
                  ?.full_name ?? null,
              service: svc?.name ?? null,
            };
          })
          .sort((a, b) => a.start.localeCompare(b.start)),
      };
    });

    return NextResponse.json({
      days,
      weeklyHours: allAvailability.map((a) => ({
        id: a.id as string,
        dayOfWeek: a.day_of_week as number,
        startTime: a.start_time
          ? (a.start_time as string).substring(0, 5)
          : "",
        endTime: a.end_time ? (a.end_time as string).substring(0, 5) : "",
        isActive: a.is_active as boolean,
      })),
    });
  } catch (err) {
    console.error("Admin schedule fetch failed:", err);
    return NextResponse.json(
      { error: "Failed to load the schedule" },
      { status: 500 }
    );
  }
}

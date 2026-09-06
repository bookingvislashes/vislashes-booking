import type { SupabaseClient } from "@supabase/supabase-js";
import {
  generateTimeSlots,
  to24Hour,
  type AvailabilityRow,
  type DateOverride,
} from "./availability";

/**
 * Everything the slot engine needs for a span of dates, fetched once.
 *
 * Two callers ask overlapping questions: /api/availability wants the bookable
 * times for one date, and /api/availability/month wants only "does this date
 * have any" for the six weeks a calendar draws. Answering the second by
 * calling the first forty-two times is forty-two round trips per month the
 * customer pages through; answering it with a second copy of the queries and
 * the duration maths is how the calendar ends up marking a day open that the
 * time list then shows as empty.
 *
 * So both go through here. The queries, the HH:mm truncation and the booked
 * duration maths exist once, and a date can only ever be drawn bookable if
 * this same code would offer a time for it.
 */

interface BlockedRange {
  blocked_date: string;
  start_time: string | null;
  end_time: string | null;
}

interface OccupiedRange {
  start_time: string;
  end_time: string;
}

export interface AvailabilityContext {
  availability: AvailabilityRow[];
  /** Per-date hours override; replaces the weekday window entirely. */
  overrides: Map<string, DateOverride>;
  blocked: Map<string, BlockedRange[]>;
  bookings: Map<string, OccupiedRange[]>;
  bufferMinutes: number;
  advanceHours: number;
  removalMinutes: number;
}

/**
 * How long to assume a booked appointment runs when its service row is gone.
 *
 * Overestimating hides a start time that might have been fine; underestimating
 * offers one that runs into a client already in the chair. Only one of those is
 * recoverable, so this is the longest service on the menu rather than an
 * average.
 */
const FALLBACK_BOOKING_MINUTES = 110;

/** Postgres `time` arrives as "09:00:00"; every comparison downstream is a
 *  lexicographic string compare, where "12:00" < "12:00:00". Truncate once. */
function hhmm(value: string | null): string | null {
  return value ? value.substring(0, 5) : null;
}

/**
 * Load the schedule inputs for every date in [from, to] inclusive.
 *
 * `from` and `to` may be the same date — that is the single-date case.
 */
export async function loadAvailabilityContext(
  admin: SupabaseClient,
  from: string,
  to: string
): Promise<AvailabilityContext> {
  const [availabilityRes, overridesRes, blockedRes, bookingsRes, settingsRes] =
    await Promise.all([
      admin
        .from("availability")
        .select("day_of_week, start_time, end_time, is_active")
        .eq("is_active", true),
      // Absent until migration 008 is run. The error is deliberately ignored:
      // the right behaviour then is to fall through to the weekday hours
      // exactly as before rather than fail the whole request.
      admin
        .from("date_overrides")
        .select("date, is_open, start_time, end_time")
        .gte("date", from)
        .lte("date", to),
      admin
        .from("blocked_dates")
        .select("date, start_time, end_time")
        .gte("date", from)
        .lte("date", to),
      // Only confirmed bookings hold a slot.
      admin
        .from("bookings")
        .select(
          "booking_date, time_slot, has_removal, services(duration_minutes)"
        )
        .gte("booking_date", from)
        .lte("booking_date", to)
        .eq("status", "confirmed"),
      admin
        .from("settings")
        .select("key, value")
        .in("key", [
          "buffer_minutes",
          "advance_booking_hours",
          "removal_duration_minutes",
        ]),
    ]);

  const settingsMap = Object.fromEntries(
    (settingsRes.data || []).map((s) => [s.key as string, s.value as string])
  );
  const bufferMinutes = parseInt(settingsMap.buffer_minutes || "15", 10);
  const advanceHours = parseInt(settingsMap.advance_booking_hours || "24", 10);
  const removalMinutes = parseInt(
    settingsMap.removal_duration_minutes || "30",
    10
  );

  const overrides = new Map<string, DateOverride>();
  for (const o of overridesRes.data || []) {
    overrides.set(o.date as string, {
      date: o.date as string,
      is_open: o.is_open as boolean,
      start_time: hhmm(o.start_time as string | null),
      end_time: hhmm(o.end_time as string | null),
    });
  }

  const blocked = new Map<string, BlockedRange[]>();
  for (const b of blockedRes.data || []) {
    const date = b.date as string;
    const list = blocked.get(date) || [];
    list.push({
      blocked_date: date,
      start_time: hhmm(b.start_time as string | null),
      end_time: hhmm(b.end_time as string | null),
    });
    blocked.set(date, list);
  }

  const bookings = new Map<string, OccupiedRange[]>();
  for (const b of bookingsRes.data || []) {
    const date = b.booking_date as string;
    const svc = b.services as unknown as { duration_minutes: number } | null;
    // Their removal lengthened the appointment when they booked it, so it has
    // to hold the same longer window here.
    const duration =
      (svc?.duration_minutes || FALLBACK_BOOKING_MINUTES) +
      (b.has_removal ? removalMinutes : 0);
    const start = to24Hour(b.time_slot as string);
    const [h, m] = start.split(":").map(Number);
    const endMins = h * 60 + m + duration;
    const list = bookings.get(date) || [];
    list.push({
      start_time: start,
      end_time: `${Math.floor(endMins / 60)
        .toString()
        .padStart(2, "0")}:${(endMins % 60).toString().padStart(2, "0")}`,
    });
    bookings.set(date, list);
  }

  return {
    availability: (availabilityRes.data || []) as AvailabilityRow[],
    overrides,
    blocked,
    bookings,
    bufferMinutes,
    advanceHours,
    removalMinutes,
  };
}

/** The bookable start times for one date, in "10:00 AM" form. */
export function slotsForDate(
  ctx: AvailabilityContext,
  date: string,
  serviceDurationMinutes: number,
  withRemoval: boolean
): string[] {
  return generateTimeSlots(
    date,
    serviceDurationMinutes + (withRemoval ? ctx.removalMinutes : 0),
    ctx.availability,
    ctx.blocked.get(date) || [],
    ctx.bookings.get(date) || [],
    ctx.bufferMinutes,
    ctx.advanceHours,
    ctx.overrides.get(date) || null
  );
}

/**
 * Local preview only, when Supabase is not configured. Both routes fail closed
 * in production instead — see the guards at their call sites.
 */
export const PREVIEW_SERVICE_DURATIONS: Record<string, number> = {
  "svc-natural-glam": 110,
  "svc-premium-wispy": 110,
  "svc-premium-custom": 110,
  "svc-natural-refill": 60,
  "svc-premium-refill": 60,
  "svc-premium-custom-refill": 60,
};

export function previewContext(): AvailabilityContext {
  return {
    availability: [1, 2, 3, 4, 5].map((day_of_week) => ({
      day_of_week,
      start_time: "09:00",
      end_time: "17:00",
      is_active: true,
    })),
    overrides: new Map(),
    blocked: new Map(),
    bookings: new Map(),
    bufferMinutes: 15,
    // Shorter than production's 24 so nearby dates show slots while developing.
    advanceHours: 2,
    removalMinutes: 30,
  };
}

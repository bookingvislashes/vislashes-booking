/**
 * The salon is in Florida; anything that touches "today" or "this appointment
 * day" has to be reasoned about in America/New_York, not the server's UTC.
 * A card tapped at 9pm Eastern is already tomorrow in UTC, and that one hour
 * is enough to file a payment under the wrong day — or, on Dec 31, the wrong
 * tax year.
 *
 * Shared so every place that needs "what salon-day was this" — the reminder
 * cron, the Square webhook, manual payment entry — agrees with the others.
 */

export const SALON_TIMEZONE = "America/New_York";

/** YYYY-MM-DD for `when` (default: now) in the salon's own timezone. */
export function salonDateOf(when: Date | string = new Date()): string {
  const d = typeof when === "string" ? new Date(when) : when;
  // en-CA renders as YYYY-MM-DD, matching booking_date/paid_on's shape.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SALON_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Minutes since midnight, right now, in the salon's timezone. */
export function salonMinutesNow(): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SALON_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  // en-US with hour12:false renders midnight as 24 in some runtimes.
  return (hour % 24) * 60 + minute;
}

/** "2:30 PM" — the shape bookings.time_slot uses — as minutes since midnight. */
export function slotToMinutes(slot: string): number | null {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(slot.trim());
  if (!match) return null;
  let hour = Number(match[1]) % 12;
  if (match[3].toUpperCase() === "PM") hour += 12;
  return hour * 60 + Number(match[2]);
}

/**
 * How many hours from now until an appointment starts, in salon time.
 * Negative once it has begun; null when the slot cannot be parsed.
 *
 * Calendar-day arithmetic, so a clock change inside the gap can shift the
 * answer by an hour. Every caller uses this against a notice window measured
 * in whole days, where an hour either way changes nothing.
 */
export function hoursUntilAppointment(
  bookingDate: string,
  timeSlot: string
): number | null {
  const slotMinutes = slotToMinutes(timeSlot);
  if (slotMinutes === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bookingDate)) return null;

  const [by, bm, bd] = bookingDate.split("-").map(Number);
  const [ty, tm, td] = salonDateOf().split("-").map(Number);
  const dayDiff =
    (Date.UTC(by, bm - 1, bd) - Date.UTC(ty, tm - 1, td)) / 86_400_000;

  return (dayDiff * 1440 + slotMinutes - salonMinutesNow()) / 60;
}

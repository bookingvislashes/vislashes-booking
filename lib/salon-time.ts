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

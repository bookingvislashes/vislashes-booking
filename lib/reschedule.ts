import type { SupabaseClient } from "@supabase/supabase-js";
import { hoursUntilAppointment } from "./salon-time";

/**
 * Shared between the client-facing reschedule page and the route that writes
 * the change, so the two can never disagree about what an appointment is or
 * whether it is still movable.
 */

export interface ReschedulableBooking {
  id: string;
  booking_date: string;
  time_slot: string;
  status: string;
  has_removal: boolean;
  deposit_paid: boolean;
  deposit_amount: number | null;
  payment_method: string | null;
  service: {
    id: string;
    name: string;
    price: number;
    duration_minutes: number;
  };
  client: { full_name: string; email: string | null } | null;
  /**
   * From Settings, not from the booking: `bookings` records only whether a
   * removal was added, and the salon owns the price in the admin. It has not
   * changed what this client owes — the deposit is already taken and the rest
   * is settled at the chair — it only makes the total in the email correct.
   */
  removalPrice: number;
  /**
   * How much notice a client must give to move an appointment themselves,
   * from Settings → advance booking hours. The same window the booking
   * calendar already uses, so "how late can I book" and "how late can I move
   * it" are one number she controls rather than two.
   */
  noticeHours: number;
}

/** Null when the id matches nothing. Status is returned, never filtered on. */
export async function loadReschedulable(
  admin: SupabaseClient,
  bookingId: string
): Promise<ReschedulableBooking | null> {
  const [bookingRes, settingsRes] = await Promise.all([
    admin
      .from("bookings")
      .select(
        "id, booking_date, time_slot, status, has_removal, deposit_paid, deposit_amount, payment_method, service:services(id, name, price, duration_minutes), client:clients(full_name, email)"
      )
      .eq("id", bookingId)
      .maybeSingle(),
    admin
      .from("settings")
      .select("key, value")
      .in("key", ["removal_price", "advance_booking_hours"]),
  ]);

  const row = bookingRes.data;
  if (bookingRes.error || !row) return null;

  // PostgREST returns an embedded one-to-one as an array in some shapes.
  const service = Array.isArray(row.service) ? row.service[0] : row.service;
  const client = Array.isArray(row.client) ? row.client[0] : row.client;
  if (!service) return null;

  const settings = Object.fromEntries(
    (settingsRes.data || []).map((s) => [s.key as string, s.value as string])
  );

  return {
    id: row.id,
    booking_date: row.booking_date,
    time_slot: row.time_slot,
    status: row.status,
    has_removal: Boolean(row.has_removal),
    deposit_paid: Boolean(row.deposit_paid),
    deposit_amount: row.deposit_amount,
    payment_method: row.payment_method,
    service,
    client: client ?? null,
    removalPrice: row.has_removal ? Number(settings.removal_price || 0) : 0,
    noticeHours: Number(settings.advance_booking_hours || 24) || 24,
  };
}

/** Why a link can't be used, or null when it can. */
export type RescheduleBlock = "cancelled" | "past" | "too-late";

export function rescheduleBlock(
  booking: ReschedulableBooking
): RescheduleBlock | null {
  if (booking.status !== "confirmed") return "cancelled";

  const hoursAway = hoursUntilAppointment(
    booking.booking_date,
    booking.time_slot
  );
  if (hoursAway === null || hoursAway <= 0) return "past";
  if (hoursAway < booking.noticeHours) return "too-late";
  return null;
}

import { NextResponse } from "next/server";

/**
 * Retired: the pay-on-the-day booking endpoint.
 *
 * The deposit is what secures an appointment, and it is now taken at booking
 * time. This route created a `confirmed` booking with `deposit_paid = false`
 * and no payment behind it, so leaving it reachable would let anyone hold the
 * salon's calendar open for free — the booking form no longer calls it, but a
 * public POST does not need a form.
 *
 * Paid bookings go through /api/square/process-payment, which charges first and
 * only then writes the booking.
 *
 * The original implementation is in git history if cash-by-phone bookings are
 * ever wanted; they would need to be admin-authenticated rather than public.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "DEPOSIT_REQUIRED",
      message:
        "Appointments are confirmed by paying the deposit. Please complete payment to book.",
    },
    { status: 410 }
  );
}

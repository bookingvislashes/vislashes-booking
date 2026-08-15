import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A Square capture with no booking behind it — the customer paid and received
 * nothing. Two paths produce one:
 *
 *   1. /api/square/process-payment charged the card, then failed to write the
 *      booking AND failed to refund. The money is sitting in Square with
 *      nothing owed against it.
 *   2. The payment webhook saw a COMPLETED payment whose id matches no
 *      booking row at all — the catch-all for anything the request path
 *      missed entirely, including a request that died mid-flight.
 *
 * Both used to be a console.error and nothing else, which is invisible the
 * moment the log window rolls over.
 */
export interface OrphanPaymentInput {
  squarePaymentId: string;
  amount?: number | null;
  currency?: string | null;
  customerEmail?: string | null;
  serviceId?: string | null;
  bookingDate?: string | null;
  timeSlot?: string | null;
  failureReason: string;
}

/**
 * Never throws. Every caller is already on a failure path where the customer's
 * card has been charged — turning a logging step into a second exception would
 * lose the very record it exists to keep.
 *
 * Upserts on square_payment_id: the webhook fires on both payment.created and
 * payment.updated, so the same capture arrives more than once and must not
 * produce duplicate rows. An existing row's resolution is preserved — once
 * someone has cleared a case, a late webhook retry must not reopen it.
 */
export async function recordOrphanPayment(
  supabase: SupabaseClient,
  input: OrphanPaymentInput
): Promise<void> {
  try {
    const { error } = await supabase.from("orphan_payments").upsert(
      {
        square_payment_id: input.squarePaymentId,
        amount: input.amount ?? null,
        currency: input.currency ?? null,
        customer_email: input.customerEmail ?? null,
        service_id: input.serviceId ?? null,
        booking_date: input.bookingDate ?? null,
        time_slot: input.timeSlot ?? null,
        failure_reason: input.failureReason,
      },
      { onConflict: "square_payment_id", ignoreDuplicates: true }
    );

    if (error) {
      console.error(
        `Could not record orphan payment ${input.squarePaymentId}:`,
        error
      );
    }
  } catch (err) {
    console.error(
      `Could not record orphan payment ${input.squarePaymentId}:`,
      err
    );
  }
}

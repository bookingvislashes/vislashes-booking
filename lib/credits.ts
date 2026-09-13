import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Credits: money the salon owes a client against their next appointment.
 *
 * Two ways one appears. She grants a $10 tag credit from a client's profile
 * when they post and tag her within 24 hours of their appointment, and the
 * birthday email grants one automatically in a client's birthday month.
 *
 * Spent automatically, once, on the next booking that client makes — whether
 * they book it themselves on the website or she enters it in the admin.
 *
 * THE DEPOSIT IS NEVER TOUCHED. A credit comes off the balance settled at
 * the chair. The deposit holds the slot, is read from the services table and
 * charged by Square, and nothing in this file goes near that path — a credit
 * that reduced the charge would be a client-influenced amount, which is the
 * bug this project has already had once.
 *
 * EVERY FUNCTION HERE FAILS SOFT. These columns arrive with migration 023,
 * which is run by hand, so there is a window where this code is deployed and
 * the columns do not exist. A booking must not fail because a discount could
 * not be looked up — least of all on the card path, where it would fail after
 * capture. A missing column costs the credit and nothing else.
 */

/** Used when Settings has not been read, or holds something unparseable. */
export const CREDIT_DEFAULTS = { referral: 10, birthday: 15 };

export interface CreditAmounts {
  /** What tagging her within 24 hours is worth. */
  referral: number;
  /** What a client gets in their birthday month. */
  birthday: number;
}

export async function loadCreditAmounts(
  supabase: SupabaseClient
): Promise<CreditAmounts> {
  try {
    const { data } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", ["referral_credit_amount", "birthday_credit_amount"]);

    const byKey = Object.fromEntries(
      (data || []).map((row) => [row.key as string, row.value as string])
    );

    const parse = (raw: string | undefined, fallback: number) => {
      const value = Number(raw);
      return Number.isFinite(value) && value >= 0 ? value : fallback;
    };

    return {
      referral: parse(byKey.referral_credit_amount, CREDIT_DEFAULTS.referral),
      birthday: parse(byKey.birthday_credit_amount, CREDIT_DEFAULTS.birthday),
    };
  } catch {
    return { ...CREDIT_DEFAULTS };
  }
}

/**
 * Put a credit on a client.
 *
 * Replaces rather than accumulates. Two $10 credits stacking into $20 off is
 * not what she promised anyone, and "they tagged me twice" is not two
 * rewards — the larger of the two wins so a birthday never downgrades a
 * credit already sitting there.
 */
export async function grantCredit(
  supabase: SupabaseClient,
  clientId: string,
  amount: number,
  reason: string
): Promise<boolean> {
  try {
    const { data: current } = await supabase
      .from("clients")
      .select("credit_amount")
      .eq("id", clientId)
      .maybeSingle();

    const existing = Number(current?.credit_amount ?? 0) || 0;
    if (existing >= amount) return true;

    const { error } = await supabase
      .from("clients")
      .update({
        credit_amount: amount,
        credit_reason: reason,
        credit_granted_at: new Date().toISOString(),
      })
      .eq("id", clientId);

    if (error) {
      console.error("grantCredit failed:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("grantCredit threw:", err);
    return false;
  }
}

export interface AppliedCredit {
  amount: number;
  reason: string;
}

/**
 * Move a client's credit onto the booking they just made, and clear it.
 *
 * Called after the booking row exists, so a credit can never be spent
 * against an appointment that failed to save. The clear is conditional on
 * the amount still being what was read, so two bookings racing cannot both
 * claim the same $10 — the loser's update matches no row and it simply does
 * not get the discount.
 *
 * Returns what was applied, or null when there was nothing to apply.
 */
export async function consumeCreditForBooking(
  supabase: SupabaseClient,
  clientId: string,
  bookingId: string
): Promise<AppliedCredit | null> {
  try {
    const { data: client, error: readError } = await supabase
      .from("clients")
      .select("credit_amount, credit_reason")
      .eq("id", clientId)
      .maybeSingle();

    if (readError || !client) return null;

    const amount = Number(client.credit_amount ?? 0) || 0;
    if (amount <= 0) return null;

    const reason = (client.credit_reason || "").trim() || "Loyalty credit";

    const { data: cleared, error: clearError } = await supabase
      .from("clients")
      .update({ credit_amount: 0, credit_reason: null, credit_granted_at: null })
      .eq("id", clientId)
      .eq("credit_amount", amount)
      .select("id")
      .maybeSingle();

    // Somebody else spent it between the read and the write. Not an error —
    // the booking is fine, it just doesn't carry a discount.
    if (clearError || !cleared) return null;

    const { error: attachError } = await supabase
      .from("bookings")
      .update({ discount_amount: amount, discount_reason: reason })
      .eq("id", bookingId);

    if (attachError) {
      // The credit is cleared but did not land on the booking. Put it back
      // rather than leaving the client silently out of pocket.
      console.error("consumeCreditForBooking: re-granting after failure:", attachError);
      await grantCredit(supabase, clientId, amount, reason);
      return null;
    }

    return { amount, reason };
  } catch (err) {
    console.error("consumeCreditForBooking threw:", err);
    return null;
  }
}

/**
 * Hand a discount back when its appointment is cancelled.
 *
 * Without this, a client who earned $10 and then had to cancel would lose it
 * — which is the opposite of what a reward is for.
 */
export async function returnCreditFromBooking(
  supabase: SupabaseClient,
  bookingId: string
): Promise<void> {
  try {
    const { data: booking } = await supabase
      .from("bookings")
      .select("client_id, discount_amount, discount_reason")
      .eq("id", bookingId)
      .maybeSingle();

    const amount = Number(booking?.discount_amount ?? 0) || 0;
    if (!booking?.client_id || amount <= 0) return;

    await grantCredit(
      supabase,
      booking.client_id,
      amount,
      (booking.discount_reason || "").trim() || "Loyalty credit"
    );

    await supabase
      .from("bookings")
      .update({ discount_amount: 0, discount_reason: null })
      .eq("id", bookingId);
  } catch (err) {
    console.error("returnCreditFromBooking threw:", err);
  }
}

/**
 * Store a birthday without risking the booking that carried it.
 *
 * Deliberately a separate write rather than part of the client upsert: on the
 * card path that upsert runs after the deposit has been captured, and naming
 * a column PostgREST cannot see fails the whole statement. An un-run
 * migration 023 must cost a birthday, never a paid-for appointment.
 */
export async function saveBirthday(
  supabase: SupabaseClient,
  clientId: string,
  month: number | null,
  day: number | null
): Promise<void> {
  if (!month || !day) return;
  if (month < 1 || month > 12 || day < 1 || day > 31) return;

  try {
    const { error } = await supabase
      .from("clients")
      .update({ birth_month: month, birth_day: day })
      .eq("id", clientId);
    if (error) console.error("saveBirthday failed:", error);
  } catch (err) {
    console.error("saveBirthday threw:", err);
  }
}

import { SupabaseClient } from "@supabase/supabase-js";

/**
 * The loyalty program: five completed appointments earn $15 off the next
 * appointment, whatever it is.
 *
 * Every service counts, both ways: a lash lift is a visit like any other, and
 * the $15 can be spent on one. Anyone who sat in the chair earned it, and the
 * salon does not want to be the one telling a client the reward they earned
 * is not valid on the thing they came in for.
 *
 * Everything that moves a reward lives here, and every one of these functions
 * expects the SERVICE client. A reward is money off a bill, so nothing about
 * it is writable from a browser — not the client's, and not the salon's. The
 * RLS policy in migration 019 grants read only.
 *
 * The three pieces of state, and who owns each:
 *
 *   clients.loyalty_visits     how far through the current five they are.
 *                              Moved by recordVisit / undoVisit only, which
 *                              run when an appointment is marked completed.
 *
 *   loyalty_rewards            one row per $15 earned, and where it went.
 *                              Issued by recordVisit, spent by claimReward.
 *
 *   bookings.loyalty_discount  what has already been taken off this
 *                              appointment. Written by claimReward, cleared
 *                              by releaseReward.
 */

/** 1st, 2nd, 3rd, 5th — for naming the visit a reward was earned on. */
export function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th";
  return `${n}${suffix}`;
}

/**
 * What the discount is called wherever a balance is printed — on Today, on
 * the appointment, on the checkout sheet and on the client's receipt line.
 * Stored on the booking so none of those screens has to join anything.
 */
export function loyaltyNote(visitNumber: number): string {
  return `Loyalty · ${ordinal(visitNumber)} visit`;
}

/** Used when Settings has no value — the program as the salon described it. */
export const LOYALTY_DEFAULTS = {
  rewardAmount: 15,
  visitsRequired: 5,
} as const;

export interface LoyaltyConfig {
  rewardAmount: number;
  visitsRequired: number;
}

/**
 * Read from Settings, the same way the removal price is, so she can change
 * either without a deploy. Setting the reward to $0 turns the program off:
 * no rewards are issued, none are spent, and the progress bar disappears
 * from the confirmation page.
 */
export async function getLoyaltyConfig(
  supabase: SupabaseClient
): Promise<LoyaltyConfig> {
  const { data } = await supabase
    .from("settings")
    .select("key, value")
    .in("key", ["loyalty_reward_amount", "loyalty_visits_required"]);

  const map = Object.fromEntries(
    (data || []).map((row) => [row.key as string, row.value as string])
  );

  const rewardAmount = Number(map.loyalty_reward_amount);
  const visitsRequired = Number(map.loyalty_visits_required);

  return {
    rewardAmount:
      Number.isFinite(rewardAmount) && rewardAmount >= 0
        ? rewardAmount
        : LOYALTY_DEFAULTS.rewardAmount,
    // Floored at 1. A zero here would make every visit a multiple of the
    // cycle length and hand out a reward per appointment.
    visitsRequired:
      Number.isFinite(visitsRequired) && visitsRequired >= 1
        ? Math.floor(visitsRequired)
        : LOYALTY_DEFAULTS.visitsRequired,
  };
}

export interface AppliedReward {
  amount: number;
  /** 5, 10, 15 — the visit that earned it. What she says out loud. */
  visitNumber: number;
}

/**
 * Attach the client's oldest unspent reward to a booking that has just been
 * created, and take it off what they owe.
 *
 * Done at booking time rather than at checkout so the discount is visible for
 * the whole life of the appointment — on the confirmation page, in the
 * confirmation email, on the calendar entry, and on Today when the client is
 * in the chair. Checking out then charges a number that has been on screen
 * since the moment they booked.
 *
 * Best-effort by design: every caller has already created the booking (and,
 * on the card path, already charged a card). A reward that could not be
 * attached stays unspent and lands on their next appointment instead, which
 * is a far better failure than a booking that errors after capture.
 */
export async function claimReward(
  supabase: SupabaseClient,
  input: { bookingId: string; clientId: string }
): Promise<AppliedReward | null> {
  try {
    const { rewardAmount } = await getLoyaltyConfig(supabase);
    if (rewardAmount <= 0) return null;

    // A handful rather than one: the claim below can lose a race with another
    // booking made in the same second, and trying the next one is cheaper
    // than making the client wait for their reward.
    const { data: candidates } = await supabase
      .from("loyalty_rewards")
      .select("id, amount, earned_visit_number")
      .eq("client_id", input.clientId)
      .is("redeemed_at", null)
      .order("earned_at", { ascending: true })
      .limit(3);

    for (const candidate of candidates || []) {
      // `.is("redeemed_at", null)` is what makes this a claim rather than an
      // overwrite: if two bookings go for the same reward, exactly one update
      // matches a row and the other comes back empty.
      const { data: claimed } = await supabase
        .from("loyalty_rewards")
        .update({
          redeemed_at: new Date().toISOString(),
          redeemed_booking_id: input.bookingId,
        })
        .eq("id", candidate.id)
        .is("redeemed_at", null)
        .select("id, amount, earned_visit_number")
        .maybeSingle();

      if (!claimed) continue;

      const amount = Number(claimed.amount);
      const { error: bookingError } = await supabase
        .from("bookings")
        .update({
          loyalty_discount: amount,
          loyalty_note: loyaltyNote(claimed.earned_visit_number),
        })
        .eq("id", input.bookingId);

      if (bookingError) {
        // The booking is the only place the discount is ever read from, so a
        // reward marked spent against a booking that does not show it is $15
        // the client never receives. Hand it back.
        await supabase
          .from("loyalty_rewards")
          .update({ redeemed_at: null, redeemed_booking_id: null })
          .eq("id", claimed.id);
        console.error("Loyalty: could not apply reward to booking:", bookingError);
        return null;
      }

      return { amount, visitNumber: claimed.earned_visit_number };
    }

    return null;
  } catch (error) {
    console.error("Loyalty: could not claim a reward:", error);
    return null;
  }
}

/**
 * Hand a reward back when the appointment it was attached to is cancelled.
 * The client keeps what they earned; it simply waits for the next booking.
 */
export async function releaseReward(
  supabase: SupabaseClient,
  bookingId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from("loyalty_rewards")
      .update({ redeemed_at: null, redeemed_booking_id: null })
      .eq("redeemed_booking_id", bookingId);

    if (error) {
      console.error("Loyalty: could not release the reward:", error);
      return;
    }

    await supabase
      .from("bookings")
      .update({ loyalty_discount: 0, loyalty_note: null })
      .eq("id", bookingId);
  } catch (error) {
    console.error("Loyalty: could not release the reward:", error);
  }
}

export interface RecordedVisit {
  visitCount: number;
  loyaltyVisits: number;
  /** Set when this visit completed a run of five. */
  rewardEarned: AppliedReward | null;
}

/**
 * Count an appointment that was kept.
 *
 * Both counters move here and nowhere else. visit_count is lifetime history
 * (the Clients page, the calendar brief); loyalty_visits is the current run
 * of five. They are separate because visit_count came across from Acuity with
 * years of history on it, and deriving rewards from that would have handed
 * every regular several backdated $15s the day the program shipped.
 */
export async function recordVisit(
  supabase: SupabaseClient,
  input: { clientId: string; bookingDate: string }
): Promise<RecordedVisit | null> {
  try {
    const { data: client, error: readError } = await supabase
      .from("clients")
      .select("visit_count, loyalty_visits")
      .eq("id", input.clientId)
      .maybeSingle();

    // The one thing that can fail here for a reason that is nobody's fault:
    // migration 019 has not been run yet, so there is no loyalty_visits to
    // select. Count the visit the way the app did before loyalty existed
    // rather than losing it — a client's history is not allowed to stop being
    // recorded because a schema change is still sitting in Migrations.
    if (readError) {
      return await recordVisitOnly(supabase, input);
    }

    if (!client) {
      console.error("Loyalty: could not read the client.");
      return null;
    }

    const visitCount = Number(client.visit_count ?? 0) + 1;
    const loyaltyVisits = Number(client.loyalty_visits ?? 0) + 1;

    const { error: updateError } = await supabase
      .from("clients")
      .update({
        visit_count: visitCount,
        loyalty_visits: loyaltyVisits,
        last_visit_date: input.bookingDate,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.clientId);

    if (updateError) {
      console.error("Loyalty: could not record the visit:", updateError);
      return null;
    }

    const { rewardAmount, visitsRequired } = await getLoyaltyConfig(supabase);

    if (rewardAmount <= 0 || loyaltyVisits % visitsRequired !== 0) {
      return { visitCount, loyaltyVisits, rewardEarned: null };
    }

    // The unique index on (client_id, earned_visit_number) is what makes this
    // safe to run twice — a double tap on Completed is a duplicate key, not a
    // second $15.
    const { data: reward, error: rewardError } = await supabase
      .from("loyalty_rewards")
      .insert({
        client_id: input.clientId,
        earned_visit_number: loyaltyVisits,
        amount: rewardAmount,
      })
      .select("amount, earned_visit_number")
      .maybeSingle();

    if (rewardError) {
      // 23505 is that duplicate key, and means the reward already exists.
      if (rewardError.code !== "23505") {
        console.error("Loyalty: could not issue the reward:", rewardError);
      }
      return { visitCount, loyaltyVisits, rewardEarned: null };
    }

    return {
      visitCount,
      loyaltyVisits,
      rewardEarned: reward
        ? {
            amount: Number(reward.amount),
            visitNumber: reward.earned_visit_number,
          }
        : null,
    };
  } catch (error) {
    console.error("Loyalty: could not record the visit:", error);
    return null;
  }
}

/**
 * The pre-loyalty behaviour, kept as the fallback for the window between this
 * shipping and migration 019 being run: lifetime visit count and last visit
 * date, nothing else.
 */
async function recordVisitOnly(
  supabase: SupabaseClient,
  input: { clientId: string; bookingDate: string }
): Promise<RecordedVisit | null> {
  const { data: client, error } = await supabase
    .from("clients")
    .select("visit_count")
    .eq("id", input.clientId)
    .maybeSingle();

  if (error || !client) {
    console.error("Loyalty: could not read the client:", error);
    return null;
  }

  const visitCount = Number(client.visit_count ?? 0) + 1;

  const { error: updateError } = await supabase
    .from("clients")
    .update({
      visit_count: visitCount,
      last_visit_date: input.bookingDate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.clientId);

  if (updateError) {
    console.error("Loyalty: could not record the visit:", updateError);
    return null;
  }

  return { visitCount, loyaltyVisits: 0, rewardEarned: null };
}

/**
 * Undo a visit, for the mis-tap: Completed, then No show a second later.
 *
 * A reward the mistake had just issued is withdrawn with it — but only while
 * it is still unspent. Once it has been attached to an appointment the client
 * has been told about it, and taking it back off their next set is not a
 * correction they would understand.
 */
export async function undoVisit(
  supabase: SupabaseClient,
  input: { clientId: string }
): Promise<void> {
  try {
    const { data: client, error } = await supabase
      .from("clients")
      .select("visit_count, loyalty_visits")
      .eq("id", input.clientId)
      .maybeSingle();

    // Migration 019 not run yet — put the lifetime count back and stop there.
    if (error) {
      const { data: legacy } = await supabase
        .from("clients")
        .select("visit_count")
        .eq("id", input.clientId)
        .maybeSingle();

      if (!legacy) return;

      await supabase
        .from("clients")
        .update({
          visit_count: Math.max(0, Number(legacy.visit_count ?? 0) - 1),
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.clientId);
      return;
    }

    if (!client) return;

    const visitCount = Math.max(0, Number(client.visit_count ?? 0) - 1);
    const loyaltyVisits = Math.max(0, Number(client.loyalty_visits ?? 0) - 1);

    await supabase
      .from("clients")
      .update({
        visit_count: visitCount,
        loyalty_visits: loyaltyVisits,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.clientId);

    await supabase
      .from("loyalty_rewards")
      .delete()
      .eq("client_id", input.clientId)
      .is("redeemed_at", null)
      .gt("earned_visit_number", loyaltyVisits);
  } catch (error) {
    console.error("Loyalty: could not undo the visit:", error);
  }
}

export interface LoyaltyStatus {
  /** How many kept appointments a reward costs. */
  visitsRequired: number;
  /** What one is worth, in dollars. */
  rewardAmount: number;
  /** Segments already filled before this appointment: 0…visitsRequired - 1. */
  completedInCycle: number;
  /** Which segment this appointment is, 1…visitsRequired. */
  position: number;
  /** True while the appointment is still ahead of them. */
  pending: boolean;
  /** True when this appointment is the last of the run. */
  completesCycle: boolean;
  /** A reward already taken off this appointment, when there is one. */
  applied: { amount: number; note: string } | null;
}

/**
 * Everything the confirmation page needs to draw the progress bar, worked out
 * server-side so the browser is never handed a number it could disagree with.
 *
 * The appointment they have just booked is counted as the segment they are
 * standing on — a client who has kept four and just booked a fifth sees four
 * filled and the fifth lit up, which is the honest version of "you're one
 * away". Nothing here promises a reward before the visit is kept: the reward
 * itself is only issued when the salon marks the appointment completed.
 *
 * Reads the booking's own loyalty columns rather than being handed them, so
 * that the confirmation page can keep its existing query. That page is the
 * first thing a client sees after paying a deposit, and it must not turn into
 * the reference-only fallback in the window between this shipping and
 * migration 019 being run by hand.
 *
 * Returns null when the program is off, when the booking can no longer be
 * part of a run, or when anything at all goes wrong. There is no version of
 * this worth showing an error for.
 */
export async function getLoyaltyStatus(
  supabase: SupabaseClient,
  booking: { id: string; clientId: string | null; status: string }
): Promise<LoyaltyStatus | null> {
  try {
    if (!booking.clientId) return null;
    if (booking.status === "cancelled" || booking.status === "no_show") {
      return null;
    }

    const { rewardAmount, visitsRequired } = await getLoyaltyConfig(supabase);
    if (rewardAmount <= 0) return null;

    const [clientRes, bookingRes] = await Promise.all([
      supabase
        .from("clients")
        .select("loyalty_visits")
        .eq("id", booking.clientId)
        .maybeSingle(),
      supabase
        .from("bookings")
        .select("loyalty_discount, loyalty_note")
        .eq("id", booking.id)
        .maybeSingle(),
    ]);

    // Either query failing means migration 019 has not been run yet. Nothing
    // to show, and nothing to shout about on a client's receipt.
    if (clientRes.error || bookingRes.error) return null;

    const loyaltyVisits = Number(clientRes.data?.loyalty_visits ?? 0);
    const discount = Math.max(0, Number(bookingRes.data?.loyalty_discount ?? 0));

    // A completed appointment has already been counted, so it is the segment
    // it filled. One still ahead of them is the next segment along.
    const banked =
      booking.status === "completed"
        ? Math.max(0, loyaltyVisits - 1)
        : loyaltyVisits;

    const completedInCycle = banked % visitsRequired;
    const position = completedInCycle + 1;

    return {
      visitsRequired,
      rewardAmount,
      completedInCycle,
      position,
      pending: booking.status !== "completed",
      completesCycle: position === visitsRequired,
      applied:
        discount > 0
          ? {
              amount: discount,
              note:
                (bookingRes.data?.loyalty_note as string | null) ??
                "Loyalty reward",
            }
          : null,
    };
  } catch (error) {
    console.error("Loyalty: could not read the status:", error);
    return null;
  }
}

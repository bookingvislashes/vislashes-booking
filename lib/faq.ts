/**
 * The questions clients ask before they book, answered on the page.
 *
 * WHY THIS EXISTS. Every one of these used to arrive as a DM, and each one is
 * a booking that pauses until it is answered. Answered here, the client books
 * without waiting on a reply and without Vianney breaking off mid-set.
 *
 * WHERE THE ANSWERS COME FROM. Nothing here is guessed. The policy answers are
 * the clauses in lib/legal.ts (buildTerms) written in plain language, so the
 * FAQ and the terms a client signs cannot drift apart; each one names its
 * clause below. The numbers — the deposit, how long an appointment runs — are
 * derived at render from the `services` table, so a change made in Admin →
 * Services reaches this section on the next revalidate with no code change.
 *
 * Three answers are editorial rather than sourced — WHICH_SET, COMFORT and
 * AFTERCARE. They describe how lash extensions work in general, not anything
 * specific to this studio, and are the ones to re-read if the way she works
 * differs.
 */

export interface FaqItem {
  question: string;
  answer: string;
}

/** One row of the services table, narrowed to what this file needs. */
export interface ServiceTiming {
  category: string;
  duration_minutes: number;
  deposit_amount: number;
}

export interface FaqFacts {
  /** "$25". Null when the services table couldn't be read, or deposits differ. */
  deposit: string | null;
  /** "70 to 90 minutes", or null when no service of that kind is active. */
  fullSet: string | null;
  refill: string | null;
  lift: string | null;
}

export const EMPTY_FACTS: FaqFacts = {
  deposit: null,
  fullSet: null,
  refill: null,
  lift: null,
};

/** "about an hour" reads better than "about 60 minutes" for the round numbers. */
function single(minutes: number): string {
  if (minutes === 60) return "about an hour";
  if (minutes === 90) return "about an hour and a half";
  if (minutes === 120) return "about two hours";
  return `about ${minutes} minutes`;
}

function durationLabel(rows: ServiceTiming[], category: string): string | null {
  const minutes = rows
    .filter((r) => r.category === category)
    .map((r) => r.duration_minutes)
    .filter((m) => Number.isFinite(m) && m > 0);

  if (minutes.length === 0) return null;

  const min = Math.min(...minutes);
  const max = Math.max(...minutes);
  return min === max ? single(min) : `${min} to ${max} minutes`;
}

function money(amount: number): string {
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
}

/**
 * Reduce the live service menu to the handful of figures the answers quote.
 *
 * The deposit is only stated when every active service charges the same one.
 * When they differ there is no single number to name, and the booking flow
 * shows the real amount before anyone is charged — so the answer says that
 * instead, rather than quoting a figure that is wrong for some sets.
 */
export function summariseTimings(rows: ServiceTiming[]): FaqFacts {
  if (rows.length === 0) return EMPTY_FACTS;

  const deposits = Array.from(
    new Set(rows.map((r) => Number(r.deposit_amount)).filter((n) => Number.isFinite(n)))
  );

  return {
    deposit: deposits.length === 1 ? money(deposits[0]) : null,
    fullSet: durationLabel(rows, "full_set"),
    refill: durationLabel(rows, "refill"),
    lift: durationLabel(rows, "lift"),
  };
}

export function buildFaq(facts: FaqFacts): FaqItem[] {
  const items: FaqItem[] = [];

  // Durations, from services.duration_minutes. Each line is dropped when no
  // service of that kind is active, and the whole question with it — a studio
  // that stops offering lifts should not still be answering for them.
  const timings = [
    facts.fullSet && `A full set runs ${facts.fullSet}.`,
    facts.refill && `A refill is ${facts.refill}.`,
    facts.lift && `A lash lift is ${facts.lift}.`,
  ].filter(Boolean);

  if (timings.length > 0) {
    items.push({
      question: "How long does an appointment take?",
      answer: `${timings.join(" ")} It is one-on-one the whole time — no double-booking, so the time is yours.`,
    });
  }

  // Terms clause 1 and 5: non-refundable deposit, taken at booking by card,
  // Apple Pay or Google Pay. Clause 6: the balance is due at the appointment.
  items.push({
    question: "Do I have to pay a deposit?",
    answer:
      (facts.deposit
        ? `Yes — ${facts.deposit} holds your appointment, paid when you book by card, Apple Pay or Google Pay. `
        : "Yes — a deposit holds your appointment, paid when you book by card, Apple Pay or Google Pay. The amount is shown before you pay. ") +
      "It comes off your total, so you pay the rest at your appointment by cash or card. The deposit is non-refundable.",
  });

  // Terms clause 2 and 3.
  items.push({
    question: "What if I need to cancel or reschedule?",
    answer:
      "Just let me know at least 24 hours before your appointment and we will move it. Cancellations inside 24 hours, and no-shows, may lose the deposit.",
  });

  // Terms clause 7.
  items.push({
    question: "How often do I need a refill?",
    answer:
      "Every two to three weeks. Extensions shed as your own lashes do, so a refill tops up what has grown out rather than starting over — it is quicker and costs less than a new full set.",
  });

  // EDITORIAL — general to lash extensions, not specific to this studio.
  items.push({
    question: "I have never had extensions before. Which set should I start with?",
    answer:
      "Classic is the usual starting point: one extension per natural lash, defined but never dramatic. If you are not sure, say so when you book and we will map it to your eye shape when you arrive — you are not locked into what you picked online.",
  });

  // EDITORIAL — describes the technique, makes no claim about any client.
  items.push({
    question: "Does it hurt?",
    answer:
      "It should not. Your eyes stay closed for the whole appointment, and every extension is attached to a lash rather than to your skin. Tell me at any point if something does not feel right and I will stop.",
  });

  // Terms clause 4.
  items.push({
    question: "How should I come to my appointment?",
    answer:
      "With clean, makeup-free eyes — no mascara, no eye cream, no oils on the day. Anything left on the lashes stops the adhesive gripping, which is the most common reason a set does not last.",
  });

  // EDITORIAL — standard extension aftercare. Terms clause 8 puts aftercare on
  // the client, so it is worth saying here what that actually means.
  items.push({
    question: "How do I look after them?",
    answer:
      "Keep them dry for the first 24 hours, then wash them gently with a lash cleanser. Skip oil-based products around the eyes, skip mascara on the extensions, and try not to rub or pick at them. I will go over all of it before you leave.",
  });

  items.push({
    question: "Where is the studio?",
    answer:
      "It is a private home studio, by appointment only — which is why it stays quiet and one-on-one. You get the full address with your confirmation as soon as your appointment is booked.",
  });

  return items;
}

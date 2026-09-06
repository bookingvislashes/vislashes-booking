import type { SupabaseClient } from "@supabase/supabase-js";
import { getSquareClient } from "./square";

/**
 * Working out which Square customer profile is which site client.
 *
 * READ ONLY, ON PURPOSE. This never creates, updates or merges a Square
 * profile. Her directory is three years of Acuity pushing profiles into
 * Square and it shows: 147 profiles for far fewer people, with Tabitha Rosado
 * appearing three times — twice under one email, once with the wrong surname
 * — and Britney Vazquez three times as well. Writing into that would deepen
 * the mess rather than fix it, and merging duplicates is a decision about her
 * customers' history that belongs to her, in Square, where the merge tool is.
 *
 * So this does the one thing that is safe and useful: for each client, find
 * the profile that already exists and remember which one it is, so a checkout
 * can attach the sale to the right person without her searching a list that
 * offers her the same name three times.
 *
 * WHERE IT DELIBERATELY GIVES UP
 *
 * When more than one profile could be the same person, it records nothing.
 * A sale attached to the wrong one of Tabitha's three profiles is worse than
 * a sale attached to none: the money is right either way, but her history
 * silently splits, and nothing on the receipt would ever show it. Those are
 * returned as `ambiguous` so the admin can list them for her to merge.
 */

export interface MatchReport {
  /** Clients newly linked to a Square profile on this run. */
  matched: number;
  /** Already linked before this run. */
  alreadyLinked: number;
  /** More than one Square profile could be this person — left unlinked. */
  ambiguous: { clientName: string; squareProfiles: number }[];
  /** No Square profile found at all. Normal for anyone new to the salon. */
  unmatched: number;
  /** Profiles read from Square. */
  squareProfiles: number;
}

/** Last ten digits, so "(973) 851-0685" and "+19738510685" are one number. */
function digits(value: string | null | undefined): string {
  return (value || "").replace(/[^0-9]/g, "").slice(-10);
}

function normaliseEmail(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase();
}

export async function matchSquareCustomers(
  supabase: SupabaseClient
): Promise<MatchReport> {
  const square = getSquareClient();

  // ── Read the whole directory once ───────────────────────────────────────
  // 147 profiles today, and it only grows by a few a month. Pulling the lot
  // and matching in memory is one round trip; searching Square per client
  // would be 157 of them and would hit the rate limit long before it hit an
  // answer.
  const byEmail = new Map<string, string[]>();
  const byPhone = new Map<string, string[]>();
  let squareProfiles = 0;

  const page = await square.customers.list({ limit: 100 });
  for await (const customer of page) {
    if (!customer.id) continue;
    squareProfiles += 1;

    const email = normaliseEmail(customer.emailAddress);
    if (email) {
      byEmail.set(email, [...(byEmail.get(email) || []), customer.id]);
    }

    const phone = digits(customer.phoneNumber);
    if (phone.length === 10) {
      byPhone.set(phone, [...(byPhone.get(phone) || []), customer.id]);
    }
  }

  // ── Match each client ───────────────────────────────────────────────────
  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, full_name, email, phone, square_customer_id");

  if (error) throw new Error(`Could not read clients: ${error.message}`);

  const report: MatchReport = {
    matched: 0,
    alreadyLinked: 0,
    ambiguous: [],
    unmatched: 0,
    squareProfiles,
  };

  for (const client of clients || []) {
    if (client.square_customer_id) {
      report.alreadyLinked += 1;
      continue;
    }

    // Email first. It is the closest thing to an identifier either system
    // has, and it is what the client typed herself when she booked.
    let candidates = byEmail.get(normaliseEmail(client.email)) || [];

    // Phone only when email found nothing — not as a tie-breaker. A shared
    // household phone would otherwise quietly override a perfectly good
    // email match and file a sister's visit against her sister.
    if (candidates.length === 0) {
      const phone = digits(client.phone);
      if (phone.length === 10) candidates = byPhone.get(phone) || [];
    }

    if (candidates.length === 1) {
      const { error: updateError } = await supabase
        .from("clients")
        .update({ square_customer_id: candidates[0] })
        .eq("id", client.id);

      if (updateError) {
        console.error(
          `Square match: could not link ${client.full_name}:`,
          updateError
        );
        report.unmatched += 1;
      } else {
        report.matched += 1;
      }
    } else if (candidates.length > 1) {
      report.ambiguous.push({
        clientName: client.full_name,
        squareProfiles: candidates.length,
      });
    } else {
      report.unmatched += 1;
    }
  }

  return report;
}

export interface CatalogAddOn {
  id: string;
  name: string;
  priceCents: number;
}

/**
 * The sellable items in her Square library, for the add-ons list at checkout.
 *
 * Read from Square rather than kept here, because that is where she already
 * maintains them — the lash care kit, the shampoo, a removal for someone who
 * turns up still wearing a set. Nothing is filtered out: the library also
 * holds old service names from the Acuity years, and deciding on her behalf
 * which of her own items she is allowed to sell would be the wrong call. The
 * checkout sheet gives her a search box instead.
 */
export async function listSquareAddOns(): Promise<CatalogAddOn[]> {
  const square = getSquareClient();
  const response = await square.catalog.searchItems({ limit: 100 });

  const addOns: CatalogAddOn[] = [];

  for (const item of response.items || []) {
    // The catalog is a mixed bag — items, images, categories, taxes — and
    // only one of those is something she can sell.
    if (item.type !== "ITEM") continue;

    const data = item.itemData;
    if (!data || item.isDeleted) continue;

    // One row per priced variation, named for whichever is more useful. Most
    // of her items have a single "Regular" variation, where the item's own
    // name is the only one worth showing.
    for (const variation of data.variations || []) {
      if (variation.type !== "ITEM_VARIATION") continue;

      const variationData = variation.itemVariationData;
      const amount = variationData?.priceMoney?.amount;
      if (!variation.id || amount === undefined || amount === null) continue;
      if (variationData?.sellable === false) continue;

      const variationName = variationData?.name;
      const name =
        variationName && variationName.toLowerCase() !== "regular"
          ? `${data.name?.trim()} · ${variationName}`
          : (data.name || "").trim();

      addOns.push({
        id: variation.id,
        name: name || "Untitled item",
        priceCents: Number(amount),
      });
    }
  }

  return addOns.sort((a, b) => a.name.localeCompare(b.name));
}

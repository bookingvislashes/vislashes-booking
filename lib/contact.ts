import { createPublicClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { toE164 } from "@/lib/sms";

/**
 * The studio's public contact details, for the home page's Contact section.
 *
 * Read from `settings` rather than written down here, for the same reason the
 * confirmation email reads the address instead of baking it in: she owns these
 * three values in Admin → Settings, and a copy in the source would go stale the
 * first time she changed one. Anything missing comes back null and the section
 * renders nothing in its place — a contact link to a wrong number is worse than
 * no link at all.
 */
export interface ContactDetails {
  /** As stored — used for the mailto: and shown verbatim. */
  email: string | null;
  /** "(407) 552-2150", for display. Null when the stored number isn't a US 10-digit. */
  phoneDisplay: string | null;
  /** "+14075522150", for sms: and tel:. Null when the stored number can't be normalised. */
  phoneE164: string | null;
}

const EMPTY: ContactDetails = {
  email: null,
  phoneDisplay: null,
  phoneE164: null,
};

/**
 * Present a US number the way a client would read it back. Anything that isn't
 * a plain 10-digit US number (or 11 with the country code) is returned as
 * stored — an international number typed in full is still better shown than
 * dropped, and toE164 decides separately whether it can be dialled.
 */
export function formatUsPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (local.length !== 10) return raw.trim();
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
}

export async function getContactDetails(): Promise<ContactDetails> {
  if (!isSupabaseConfigured()) return EMPTY;

  try {
    const supabase = await createPublicClient();
    const { data, error } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", ["business_email", "business_phone"]);

    if (error) {
      console.error("getContactDetails: fetch failed, rendering no contacts:", error);
      return EMPTY;
    }

    const byKey = Object.fromEntries((data || []).map((r) => [r.key, r.value]));

    const email = (byKey.business_email || "").trim() || null;
    const rawPhone = (byKey.business_phone || "").trim();

    return {
      email,
      phoneDisplay: rawPhone ? formatUsPhone(rawPhone) : null,
      phoneE164: rawPhone ? toE164(rawPhone) : null,
    };
  } catch (err) {
    console.error("getContactDetails: threw, rendering no contacts:", err);
    return EMPTY;
  }
}

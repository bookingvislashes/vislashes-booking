import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { buildPrivacyPolicy } from "@/lib/legal";
import { createPublicClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Privacy Policy · VIS Lashes",
  description:
    "How VIS Lashes collects, uses and protects your information, including text message policy.",
};

// The contact block comes from Settings, so a change of address or email is
// made in the admin rather than here — and a missing value renders nothing
// rather than a placeholder.
// Five minutes, not an hour. These pages read the business details out of
// Settings, and an hour meant a correction made in the admin was invisible
// for an hour afterwards — which bit during the A2P review, when the legal
// name was saved and the page kept serving the version without it. They are
// three small documents behind a CDN; regenerating them more often costs
// almost nothing, and being slow to tell the truth costs a review cycle.
export const revalidate = 300;

export default async function PrivacyPage() {
  // Same contract as /terms: the policy still renders if Settings cannot be
  // read. Missing contact lines are simply omitted — never guessed at.
  // The address is intentionally not fetched here — see buildPrivacyPolicy.
  let rows: { key: string; value: string }[] = [];
  try {
    const supabase = await createPublicClient();
    const { data } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", [
        "business_name",
        "business_legal_name",
        "business_email",
        "business_phone",
      ]);
    rows = data ?? [];
  } catch {
    // Left empty: the contact block collapses to just the business name.
  }

  const get = (key: string) => rows.find((row) => row.key === key)?.value ?? null;

  const phone = get("business_phone");
  const formattedPhone =
    phone && phone.replace(/\D/g, "").length === 10
      ? `(${phone.replace(/\D/g, "").slice(0, 3)}) ${phone
          .replace(/\D/g, "")
          .slice(3, 6)}-${phone.replace(/\D/g, "").slice(6)}`
      : phone;

  return (
    <LegalPage
      title="Privacy Policy"
      updated="September 16, 2026"
      sections={[
        buildPrivacyPolicy({
          businessName: get("business_name") ?? "VIS Lashes",
          legalName: get("business_legal_name"),
          email: get("business_email"),
          phone: formattedPhone,
        }),
      ]}
    />
  );
}

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
export const revalidate = 3600;

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
      .in("key", ["business_name", "business_email", "business_phone"]);
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
      updated="September 6, 2026"
      sections={[
        buildPrivacyPolicy({
          businessName: get("business_name") ?? "VIS Lashes",
          email: get("business_email"),
          phone: formattedPhone,
        }),
      ]}
    />
  );
}

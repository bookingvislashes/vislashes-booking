import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { buildMessagingPolicy } from "@/lib/legal";
import { createPublicClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Text Message Policy · VIS Lashes",
  description:
    "What text messages VIS Lashes sends, how you opt in, how to stop them, and how your mobile number is handled.",
};

// Same contract as /privacy and /terms: the contact block comes from Settings,
// missing values render nothing rather than a placeholder, and the page still
// renders if the database cannot be read.
export const revalidate = 3600;

export default async function SmsPolicyPage() {
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
      title="Text Message Policy"
      updated="September 11, 2026"
      sections={[
        buildMessagingPolicy({
          businessName: get("business_name") ?? "VIS Lashes",
          email: get("business_email"),
          phone: formattedPhone,
        }),
      ]}
    />
  );
}

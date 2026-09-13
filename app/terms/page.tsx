import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { buildTerms, buildSmsTerms, WAIVER_TEXT } from "@/lib/legal";
import { createPublicClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Terms & Conditions · VIS Lashes",
  description:
    "Booking, deposit, cancellation and text message terms for VIS Lashes appointments.",
};

export const revalidate = 3600;

export default async function TermsPage() {
  // The deposit is read from the services table for the same reason the
  // checkout does it: it is hers to change in Services, and a number written
  // in here would quietly disagree with what a client is actually charged.
  // Wrapped because this page must render even when the database cannot be
  // reached — including at build time, where the credentials are not present.
  // A legal document that 500s is worse than one missing a figure.
  let deposit: number | null = null;
  // The messaging terms have to carry a support contact — the carriers check
  // for one — so this page reads the same Settings rows /privacy does.
  let rows: { key: string; value: string }[] = [];
  try {
    const supabase = await createPublicClient();
    const { data } = await supabase
      .from("services")
      .select("deposit_amount")
      .eq("is_active", true)
      .order("sort_order")
      .limit(1)
      .maybeSingle();
    if (data?.deposit_amount != null) deposit = Number(data.deposit_amount);

    const { data: settings } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", ["business_name", "business_email", "business_phone"]);
    rows = settings ?? [];
  } catch {
    // Left null/empty: buildTerms writes the clause without an amount, and the
    // support line collapses rather than printing a placeholder.
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
      title="Terms & Conditions"
      updated="September 13, 2026"
      sections={[
        buildTerms(deposit),
        buildSmsTerms({
          businessName: get("business_name") ?? "VIS Lashes",
          email: get("business_email"),
          phone: formattedPhone,
        }),
        WAIVER_TEXT,
      ]}
    />
  );
}

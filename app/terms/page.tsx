import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { buildTerms, SMS_TERMS, WAIVER_TEXT } from "@/lib/legal";
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
  } catch {
    // Left null: buildTerms writes the clause without an amount.
  }

  return (
    <LegalPage
      title="Terms & Conditions"
      updated="September 8, 2026"
      sections={[buildTerms(deposit), SMS_TERMS, WAIVER_TEXT]}
    />
  );
}

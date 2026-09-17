import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { SmsConsentBlock } from "@/components/booking/SmsConsentBlock";
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
// Five minutes, not an hour. These pages read the business details out of
// Settings, and an hour meant a correction made in the admin was invisible
// for an hour afterwards — which bit during the A2P review, when the legal
// name was saved and the page kept serving the version without it. They are
// three small documents behind a CDN; regenerating them more often costs
// almost nothing, and being slow to tell the truth costs a review cycle.
export const revalidate = 300;

export default async function SmsPolicyPage() {
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
      title="Text Message Policy"
      updated="September 17, 2026"
      sections={[
        buildMessagingPolicy({
          businessName: get("business_name") ?? "VIS Lashes",
          legalName: get("business_legal_name"),
          email: get("business_email"),
          phone: formattedPhone,
        }),
      ]}
    >
      {/* The consent control itself, server-rendered at a URL with nothing in
          front of it. Twilio's automated opt-in check fetches a page and reads
          the HTML; the real control is on step 3 of the booking wizard, which
          from outside is indistinguishable from "a chat widget or pop-up we
          can't read" — their words. This is the same component the booking
          form renders, disabled here, so what the checker reads and what a
          client sees cannot diverge. */}
      <div className="mt-8 pt-7 border-t border-light-tan">
        <h2 className="font-display text-[17px] font-bold text-dark-brown mb-2">
          THE CONSENT STEP, AS IT APPEARS ON THE BOOKING FORM
        </h2>
        <p className="font-sans text-[15px] leading-[1.7] text-charcoal mb-4">
          This is the exact checkbox and wording shown beneath the phone field
          at vislashes.com/book. It is reproduced here so it can be read
          without starting a booking. The box below is disabled and ticking it
          does nothing — the only place to opt in is the booking form itself.
        </p>
        <div className="rounded-control bg-cream p-4 border border-light-tan">
          <SmsConsentBlock id="smsConsentExample" />
        </div>
      </div>
    </LegalPage>
  );
}

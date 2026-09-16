import Link from "next/link";
import { legalEntityLine } from "@/lib/legal";
import { createPublicClient } from "@/lib/supabase/server";

export async function Footer() {
  // Who the business legally is, on every page rather than only the legal
  // ones. A carrier reviewing the messaging campaign lands on the home page
  // first, and the whole A2P rejection came down to nobody being able to tell
  // that vislashes.com and the name on the Twilio account were one business.
  // Same contract as everywhere else: unset renders nothing.
  let entity = "";
  try {
    const supabase = await createPublicClient();
    const { data } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", ["business_name", "business_legal_name"]);
    const get = (key: string) =>
      (data ?? []).find((row) => row.key === key)?.value ?? null;
    entity = legalEntityLine({
      businessName: get("business_name") ?? "VIS Lashes",
      legalName: get("business_legal_name"),
    });
  } catch {
    // Left blank: the footer renders without the line rather than failing.
  }

  return (
    <footer className="w-full bg-black py-[22px] px-6">
      <div className="max-w-[1440px] mx-auto flex flex-col items-center gap-2">
        <div className="flex items-center justify-center gap-3">
          {/* Instagram Icon */}
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none" className="text-instagram">
            <rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
          </svg>
          {/* Handle */}
          <Link
            href="https://www.instagram.com/vislashesbooking"
            target="_blank"
            rel="noopener noreferrer"
            className="font-sans font-medium text-[18px] text-instagram tracking-[0.25px] uppercase hover:text-white transition-colors"
          >
            @vislashesbooking
          </Link>
        </div>
        {/* Terms, privacy and the text message policy have to be reachable
            from every page: a carrier reviewing the messaging campaign looks
            for them, and a client deciding whether to hand over her phone
            number deserves to read them without starting a booking first.
            "Texts" is the one a carrier actually needs — the consent sentence
            itself is three steps into the booking flow, where no reviewer will
            ever see it, so /sms is the public copy of it. */}
        <div className="flex items-center gap-3 text-[12px] leading-none tracking-[0.3px]">
          <Link
            href="/terms"
            className="font-sans text-white/60 hover:text-white transition-colors"
          >
            Terms
          </Link>
          <span aria-hidden="true" className="text-white/20">
            ·
          </span>
          <Link
            href="/privacy"
            className="font-sans text-white/60 hover:text-white transition-colors"
          >
            Privacy
          </Link>
          <span aria-hidden="true" className="text-white/20">
            ·
          </span>
          <Link
            href="/sms"
            className="font-sans text-white/60 hover:text-white transition-colors"
          >
            Texts
          </Link>
        </div>

        {entity && (
          <p className="font-sans text-[11px] leading-[1.6] text-white/40 text-center max-w-[640px]">
            {entity}
          </p>
        )}

        {/* Staff entry point. Deliberately quiet and in the footer rather than
            the header — it is for the salon, not for clients. */}
        <div className="flex items-center gap-2 text-[11px] leading-none tracking-[0.4px]">
          <Link
            href="/admin/login"
            className="font-sans text-white/40 hover:text-white/70 focus-visible:text-white/70 transition-colors"
          >
            Staff Login
          </Link>
          <span aria-hidden="true" className="text-white/20">
            ·
          </span>
          <span className="font-sans text-white/40 tabular-nums">
            {process.env.NEXT_PUBLIC_BUILD_ID}
          </span>
        </div>
      </div>
    </footer>
  );
}

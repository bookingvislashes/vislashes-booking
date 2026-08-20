import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * "Have I been here before?" — the check that unlocks refills.
 *
 * Matches on email OR phone deliberately. 47 of the 159 clients in the Acuity
 * export have no email address on file, so an email-only check would lock
 * nearly a third of the salon's regulars out of the one thing refills exist
 * for. Almost all of them have a phone number.
 *
 * Returns a bare boolean and nothing else: no name, no history, no count. The
 * endpoint necessarily reveals whether a given contact is a client, which is
 * unavoidable for a self-service unlock, so it gives away as little as it can
 * beyond that and never echoes back stored data.
 */

const schema = z.object({
  contact: z.string().min(3).max(200),
});

/** Digits only. People write numbers as (407) 555-1234, 407-555-1234, +1407… */
function digits(value: string): string {
  return value.replace(/[^0-9]/g, "");
}

export async function POST(req: NextRequest) {
  let contact: string;
  try {
    contact = schema.parse(await req.json()).contact.trim();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const supabase = await createServiceClient();

    if (contact.includes("@")) {
      // maybeSingle() would error on a repeated address rather than answering,
      // and repeats exist: three real ones in the salon's export, plus any row
      // where her own address was typed in as a stand-in for a client without
      // email. An address shared by several clients identifies nobody, and if
      // it is the salon's own — printed on the site — it would let any visitor
      // unlock refills. Treated as no match.
      const { data } = await supabase
        .from("clients")
        .select("id")
        .ilike("email", contact)
        .limit(5);

      const matches = data || [];
      if (matches.length !== 1) {
        return NextResponse.json({ known: false });
      }

      const { data: business } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "business_email")
        .maybeSingle();

      const businessEmail = (business?.value || "").trim().toLowerCase();
      const fromEmail = (process.env.EMAIL_FROM || "").trim().toLowerCase();
      const given = contact.toLowerCase();
      if (given && (given === businessEmail || given === fromEmail)) {
        return NextResponse.json({ known: false });
      }

      return NextResponse.json({ known: true });
    }

    const phoneDigits = digits(contact);
    // A US number is 10 digits, 11 with the country code. Anything shorter is
    // a typo, and matching on it could match half the client list at once.
    if (phoneDigits.length < 10) {
      return NextResponse.json({ known: false });
    }

    // Compared digits-to-digits so a number stored as "(407) 555-1234" still
    // matches one typed as "4075551234". The last 10 digits are used so a
    // leading 1 on either side does not defeat the match.
    const last10 = phoneDigits.slice(-10);
    const { data } = await supabase
      .from("clients")
      .select("id, phone")
      .not("phone", "is", null)
      .limit(2000);

    const known = (data || []).some(
      (c) => digits(c.phone || "").slice(-10) === last10
    );

    return NextResponse.json({ known });
  } catch (err) {
    console.error("Client lookup failed:", err);
    // Fails closed: an outage must not hand out refill access.
    return NextResponse.json({ known: false });
  }
}

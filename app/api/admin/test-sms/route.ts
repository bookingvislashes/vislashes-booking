import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  fetchSmsStatus,
  isSmsConfigured,
  SmsOptedOutError,
  sendSms,
  testText,
  toE164,
} from "@/lib/sms";

/**
 * Send one text to her own phone, so the texting setup can be proved without
 * taking a real booking.
 *
 * WHY THIS EXISTS. Every other send in this app hangs off something real: a
 * client booking and paying, an appointment falling inside a reminder window,
 * an appointment being cancelled. That meant the only way to find out whether
 * Twilio worked was to make a real booking with a real card — which is a
 * ridiculous price for an answer to "is it on?", and which tests the payment
 * path and the texting path at once, so a failure tells you nothing about
 * which one broke.
 *
 * ACCEPTED IS NOT DELIVERED. Twilio answers a send in milliseconds, long
 * before a carrier has been anywhere near the message. Landlines, unreachable
 * handsets and carrier blocks are all accepted at the API and fail seconds
 * later, and an A2P campaign that is registered but not linked to the sending
 * number fails in exactly that way too. So GET takes a message SID and asks
 * Twilio what became of it; the admin calls it a few seconds after sending
 * rather than reporting "sent" and leaving her to find out from her clients.
 *
 * Her own number only by default, but any number may be given: testing
 * against a second handset is a fair thing to want, and this is behind the
 * admin login.
 */

const schema = z.object({
  phone: z.string().min(1).max(32).optional(),
});

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
}

/** The number to prefill, so the common case is press-the-button. */
async function businessDetails() {
  try {
    const admin = await createServiceClient();
    const { data } = await admin
      .from("settings")
      .select("key, value")
      .in("key", ["business_name", "business_phone"]);
    const get = (key: string) =>
      (data ?? []).find((row) => row.key === key)?.value ?? null;
    return {
      businessName: get("business_name") || "VIS Lashes",
      businessPhone: get("business_phone"),
    };
  } catch {
    return { businessName: "VIS Lashes", businessPhone: null };
  }
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sid = req.nextUrl.searchParams.get("sid");

  // No SID: just report whether the three Twilio settings are present, which
  // is the question the page asks on load.
  if (!sid) {
    const { businessPhone } = await businessDetails();
    return NextResponse.json({
      configured: isSmsConfigured(),
      defaultPhone: businessPhone,
    });
  }

  if (!isSmsConfigured()) {
    return NextResponse.json(
      { error: "Twilio is not configured." },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json(await fetchSmsStatus(sid));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Lookup failed" },
      { status: 502 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await req.json().catch(() => ({})));
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!isSmsConfigured()) {
    return NextResponse.json(
      {
        error:
          "Twilio is not set up. TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER all have to be in Vercel, and the site has to be redeployed after adding them.",
      },
      { status: 400 }
    );
  }

  const { businessName, businessPhone } = await businessDetails();
  const phone = toE164(input.phone || businessPhone);

  if (!phone) {
    return NextResponse.json(
      {
        error:
          "That does not look like a US mobile number. Enter it as 10 digits, or set your business phone in Settings.",
      },
      { status: 400 }
    );
  }

  try {
    const sid = await sendSms(phone, testText(businessName));
    return NextResponse.json({ sid, to: phone });
  } catch (err) {
    // An opt-out is the one failure that is not a fault: she replied STOP to
    // her own number at some point, which is worth saying plainly because the
    // fix is to text START back rather than to go looking at the settings.
    if (err instanceof SmsOptedOutError) {
      return NextResponse.json(
        {
          error:
            "That number replied STOP at some point, so Twilio refuses to text it. Text START to your Twilio number from that phone and try again.",
        },
        { status: 400 }
      );
    }
    // Twilio's own wording, unedited. Its error codes are searchable and a
    // paraphrase would cost her the one string worth pasting into Google.
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Send failed" },
      { status: 502 }
    );
  }
}

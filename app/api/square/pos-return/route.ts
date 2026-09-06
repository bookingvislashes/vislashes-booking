import { NextRequest, NextResponse } from "next/server";
import { parsePosReturn } from "@/lib/square-pos";

/**
 * Where the Square app sends her back after a sale.
 *
 * This route records nothing. It cannot be trusted to: the return is a
 * browser navigation, and it never happens if she switches apps, force-quits,
 * or walks the client to the door before the receipt screen clears. A payment
 * that only existed here would be a payment that vanished.
 *
 * The signature-verified webhook is what records the money, and it fires
 * whatever her phone does. So this does one honest job — put her back on the
 * Today screen, with a word about how it went — and gets out of the way.
 *
 * No auth check, deliberately: Square opens this in whatever browser it feels
 * like and a login wall here would strand her on a sign-in page holding a
 * client's card. It reads nothing and writes nothing, so there is nothing to
 * protect; the query string it carries is Square's word about a payment, and
 * it is used only to choose which of three words to show.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const result = parsePosReturn(searchParams);

  const base = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
  const target = new URL(`${base}/admin/today`);

  if (result.status === "error") {
    // Square's own codes are for developers ("payment_canceled",
    // "amount_too_small"); the Today screen turns them into something worth
    // reading. Passed through rather than interpreted here.
    target.searchParams.set("charge", "failed");
    if (result.errorCode) target.searchParams.set("reason", result.errorCode);
  } else {
    target.searchParams.set("charge", result.status === "ok" ? "done" : "back");
  }

  return NextResponse.redirect(target.toString());
}

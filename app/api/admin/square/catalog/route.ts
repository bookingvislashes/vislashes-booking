import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listSquareAddOns } from "@/lib/square-customers";

/**
 * Her Square library, for the extras list at checkout.
 *
 * Behind the admin session because it is her pricing, and read straight from
 * Square every time rather than cached here: she edits these in the Square
 * app, and a checkout sheet quoting last week's price would be worse than one
 * that takes half a second longer.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const items = await listSquareAddOns();
    return NextResponse.json({ items });
  } catch (err) {
    console.error("Square catalog: could not load items:", err);
    return NextResponse.json(
      { error: "Couldn't reach Square to load your library." },
      { status: 502 }
    );
  }
}

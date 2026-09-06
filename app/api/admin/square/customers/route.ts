import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { matchSquareCustomers } from "@/lib/square-customers";

/**
 * Links site clients to the Square profiles they already have.
 *
 * A POST because it writes — but only to `clients.square_customer_id` here.
 * Nothing in Square is created or changed; see the note at the top of
 * lib/square-customers.ts for why that line is drawn where it is.
 *
 * Safe to run as often as she likes: clients already linked are skipped, so a
 * second run only picks up whoever is new since the first.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = await createServiceClient();
    const report = await matchSquareCustomers(admin);
    return NextResponse.json(report);
  } catch (err) {
    console.error("Square customers: match failed:", err);
    return NextResponse.json(
      { error: "Couldn't reach Square to match your customers." },
      { status: 502 }
    );
  }
}

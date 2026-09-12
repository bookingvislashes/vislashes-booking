import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { syncUpcomingBookings } from "@/lib/google-calendar";

/**
 * "Sync now" from the Settings panel.
 *
 * Sync at booking time is best-effort and silent by design — the card has
 * already been charged by the time it runs, so it is never allowed to fail a
 * booking. The gap that leaves is an appointment that quietly never reached
 * the calendar, with no way to ask for it again short of cancelling and
 * rebooking. This is that way: it walks every upcoming appointment with no
 * calendar event and writes it.
 *
 * Safe to press repeatedly. An appointment already on the calendar has an
 * event id and is never looked at again, so this only ever fills gaps.
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
    // Service client: the refresh token lives in a table with RLS on and no
    // policies, so it is deliberately unreachable with the browser's key.
    const admin = await createServiceClient();
    const result = await syncUpcomingBookings(admin);

    // 200 even when Google refused. That failure is Google's, and it is
    // described in `problem` for the panel to show — a 500 here would only
    // make the browser print "something went wrong" over a message that says
    // exactly what to do about it.
    return NextResponse.json(result);
  } catch (err) {
    console.error("Google Calendar: manual sync failed:", err);
    return NextResponse.json(
      { error: "Couldn't run the sync. Please try again." },
      { status: 500 }
    );
  }
}

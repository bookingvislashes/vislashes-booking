import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  getConnection,
  getCalendarHealth,
  findUnsyncedUpcoming,
  isGoogleConfigured,
  googleConfigProblem,
} from "@/lib/google-calendar";

/**
 * Connection status for the Settings panel.
 *
 * This exists because the admin browser cannot query
 * google_calendar_connection directly — the table holds a refresh token and
 * so has no RLS policy for any browser-held key. Only non-secret fields are
 * returned; the token itself never leaves the server.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isGoogleConfigured()) {
    return NextResponse.json({ configured: false, connected: false });
  }

  // Configured but unusable. Reported here so Settings can say what is wrong,
  // rather than the admin finding out from Google's own error page.
  const problem = googleConfigProblem();
  if (problem) {
    return NextResponse.json({ configured: true, connected: false, problem });
  }

  try {
    const admin = await createServiceClient();
    const connection = await getConnection(admin);

    if (!connection) {
      return NextResponse.json({ configured: true, connected: false });
    }

    // Two questions the panel could not answer before, both of which matter
    // more than "is it connected": which calendar do appointments land on,
    // and is anything actually landing there. `health` asks Google directly,
    // so a connection that is saved but no longer works — the API switched
    // off, the permission revoked — reads as the fault it is instead of a
    // green tick.
    const [health, unsynced] = await Promise.all([
      getCalendarHealth(admin),
      findUnsyncedUpcoming(admin),
    ]);

    return NextResponse.json({
      configured: true,
      connected: true,
      email: connection.googleEmail,
      connectedAt: connection.connectedAt,
      calendarName: health.name,
      // Named `syncProblem` rather than reusing `problem`: that one means the
      // keys are wrong and she has never been connected, and the panel says
      // something quite different for each.
      syncProblem: health.problem,
      pendingSync: unsynced.length,
    });
  } catch (err) {
    console.error("Google Calendar: status check failed:", err);
    return NextResponse.json({ configured: true, connected: false });
  }
}

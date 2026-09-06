import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  getConnection,
  getCalendarSummary,
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

    // The name of the calendar appointments actually land on. Asked for only
    // when there is a connection to ask about, and a failure here is not a
    // failure of the status check — the panel prints what it knows.
    const calendarName = connection ? await getCalendarSummary(admin) : null;

    return NextResponse.json({
      configured: true,
      connected: Boolean(connection),
      email: connection?.googleEmail ?? null,
      connectedAt: connection?.connectedAt ?? null,
      calendarName,
    });
  } catch (err) {
    console.error("Google Calendar: status check failed:", err);
    return NextResponse.json({ configured: true, connected: false });
  }
}

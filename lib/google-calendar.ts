import type { SupabaseClient } from "@supabase/supabase-js";
import { to24Hour } from "./availability";

/**
 * Google Calendar sync for confirmed appointments.
 *
 * Everything here is best-effort and swallows its own errors: it is called
 * from the booking flow, immediately after a real card has been charged, and
 * a calendar that is briefly out of date is a far smaller problem than a
 * booking that fails because Google was unreachable.
 */

// The salon is in Orlando. Sending a local wall-clock time plus a zone lets
// Google resolve the UTC offset, so this stays correct across the DST change
// without any date maths here. next.config.ts pins the same zone for the
// build stamp.
const TIMEZONE = "America/New_York";

// calendar.events covers creating and removing the salon's own appointments.
// The original design note (md/CALENDAR_SYNC.md) also listed calendar.readonly
// for reading her manually-blocked time back into availability — that half is
// not built, and requesting a scope nothing uses only makes the consent screen
// more alarming for no benefit.
const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

// Trimmed at the point of use. Pasting into Vercel's field very easily carries
// a trailing newline or space, and Google rejects the result as an unknown
// client — a "401: invalid_client" page on Google's own domain, with nothing
// in it to suggest the cause is one invisible character.
const clientId = (process.env.GOOGLE_CLIENT_ID || "").trim();
const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || "").trim();

export function isGoogleConfigured(): boolean {
  return Boolean(clientId && clientSecret);
}

/**
 * Catches a credential that is present but cannot possibly work, so the admin
 * is told here instead of being handed to Google and bounced back with an
 * error page that never names the app.
 *
 * Returns null when configured correctly, or not configured at all — "not set
 * up yet" is a different state and has its own message.
 */
export function googleConfigProblem(): string | null {
  if (!clientId || !clientSecret) return null;

  // Every Google OAuth client ID ends this way. A value that doesn't is
  // almost always the client *secret*, an API key, or an ID truncated on
  // paste — all three produce the same opaque invalid_client from Google.
  if (!clientId.endsWith(".apps.googleusercontent.com")) {
    return "The Google Client ID doesn't look right — it should end in .apps.googleusercontent.com. Check it hasn't been swapped with the secret or cut short.";
  }

  if (clientId === clientSecret) {
    return "The Google Client ID and Client Secret are set to the same value.";
  }

  return null;
}

/**
 * Must match a redirect URI registered in the Google Cloud console exactly,
 * including scheme and trailing path. Derived from NEXT_PUBLIC_BASE_URL so
 * production and local development each point at themselves.
 */
export function getRedirectUri(): string {
  const base = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
  return `${base}/api/google/callback`;
}

async function createOAuthClient() {
  const { google } = await import("googleapis");
  return new google.auth.OAuth2(clientId, clientSecret, getRedirectUri());
}

export async function getAuthUrl(state: string): Promise<string> {
  const client = await createOAuthClient();
  return client.generateAuthUrl({
    // offline is what makes Google return a refresh token at all; without it
    // the connection would silently stop working in about an hour.
    access_type: "offline",
    scope: SCOPES,
    // Google omits the refresh token on a repeat authorisation unless consent
    // is forced. Reconnecting would otherwise store an empty token and appear
    // to succeed.
    prompt: "consent",
    include_granted_scopes: true,
    state,
  });
}

export interface GoogleConnection {
  refreshToken: string;
  calendarId: string;
  googleEmail: string | null;
  connectedAt: string;
}

export async function getConnection(
  supabase: SupabaseClient
): Promise<GoogleConnection | null> {
  const { data, error } = await supabase
    .from("google_calendar_connection")
    .select("refresh_token, calendar_id, google_email, connected_at")
    .maybeSingle();

  if (error || !data) return null;

  return {
    refreshToken: data.refresh_token,
    calendarId: data.calendar_id || "primary",
    googleEmail: data.google_email,
    connectedAt: data.connected_at,
  };
}

/**
 * Exchanges the one-time code for a refresh token and stores it. Returns the
 * connected Google account address for display, or null when Google declined
 * to issue a refresh token (which `prompt: "consent"` above should prevent).
 */
export async function saveConnectionFromCode(
  supabase: SupabaseClient,
  code: string
): Promise<{ email: string | null } | null> {
  const client = await createOAuthClient();
  const { tokens } = await client.getToken(code);

  if (!tokens.refresh_token) return null;

  client.setCredentials(tokens);

  // Best-effort label so Settings can show which account is connected. A
  // failure here must not fail the connection itself.
  let email: string | null = null;
  try {
    const { google } = await import("googleapis");
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const profile = await oauth2.userinfo.get();
    email = profile.data.email ?? null;
  } catch {
    email = null;
  }

  const { error } = await supabase.from("google_calendar_connection").upsert(
    {
      singleton: true,
      refresh_token: tokens.refresh_token,
      google_email: email,
      calendar_id: "primary",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "singleton" }
  );

  if (error) throw new Error(error.message);
  return { email };
}

export async function clearConnection(supabase: SupabaseClient): Promise<void> {
  const connection = await getConnection(supabase);

  // Revoke at Google as well as forgetting locally. Deleting only our row
  // would leave the grant standing in her Google account with nothing in the
  // app able to show it, let alone withdraw it.
  if (connection) {
    try {
      const client = await createOAuthClient();
      await client.revokeToken(connection.refreshToken);
    } catch (err) {
      console.error("Google Calendar: token revoke failed:", err);
    }
  }

  await supabase
    .from("google_calendar_connection")
    .delete()
    .eq("singleton", true);
}

async function getCalendarClient(supabase: SupabaseClient) {
  if (!isGoogleConfigured()) return null;

  const connection = await getConnection(supabase);
  if (!connection) return null;

  const { google } = await import("googleapis");
  const auth = await createOAuthClient();
  // Setting only the refresh token makes the library fetch a fresh access
  // token per use, so nothing expired is ever cached between requests.
  auth.setCredentials({ refresh_token: connection.refreshToken });

  return {
    calendar: google.calendar({ version: "v3", auth }),
    calendarId: connection.calendarId,
  };
}

/** Adds `minutes` to an "HH:mm" string, returning "HH:mm". */
function addMinutesTo24Hour(time24: string, minutes: number): string {
  const [h, m] = time24.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export interface BookingEventDetails {
  bookingId: string;
  serviceName: string;
  durationMinutes: number;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  /** "YYYY-MM-DD" */
  bookingDate: string;
  /** "10:00 AM" */
  timeSlot: string;
}

/**
 * Creates the calendar event and records its id against the booking. Never
 * throws — see the note at the top of this file.
 */
export async function createBookingEvent(
  supabase: SupabaseClient,
  details: BookingEventDetails
): Promise<void> {
  try {
    const client = await getCalendarClient(supabase);
    if (!client) return; // Not configured or not connected — nothing to do.

    const start24 = to24Hour(details.timeSlot);
    const end24 = addMinutesTo24Hour(start24, details.durationMinutes);

    const res = await client.calendar.events.insert({
      calendarId: client.calendarId,
      requestBody: {
        summary: `${details.serviceName} — ${details.clientName}`,
        description: [
          details.clientName,
          details.clientPhone,
          details.clientEmail,
          "",
          "Booked through vislashes.com",
        ].join("\n"),
        start: {
          dateTime: `${details.bookingDate}T${start24}:00`,
          timeZone: TIMEZONE,
        },
        end: {
          dateTime: `${details.bookingDate}T${end24}:00`,
          timeZone: TIMEZONE,
        },
      },
    });

    const eventId = res.data.id;
    if (eventId) {
      await supabase
        .from("bookings")
        .update({ google_event_id: eventId })
        .eq("id", details.bookingId);
    }
  } catch (err) {
    console.error("Google Calendar: could not create event:", err);
  }
}

/**
 * Removes the event for a booking that is no longer happening. A 404/410 from
 * Google means it is already gone — she deleted it from her phone — which is
 * the desired end state, not a failure.
 */
export async function deleteBookingEvent(
  supabase: SupabaseClient,
  bookingId: string
): Promise<void> {
  try {
    const { data: booking } = await supabase
      .from("bookings")
      .select("google_event_id")
      .eq("id", bookingId)
      .maybeSingle();

    const eventId = booking?.google_event_id;
    if (!eventId) return;

    const client = await getCalendarClient(supabase);
    if (!client) return;

    try {
      await client.calendar.events.delete({
        calendarId: client.calendarId,
        eventId,
      });
    } catch (err) {
      const status = (err as { code?: number; status?: number }).code ??
        (err as { status?: number }).status;
      if (status !== 404 && status !== 410) throw err;
    }

    await supabase
      .from("bookings")
      .update({ google_event_id: null })
      .eq("id", bookingId);
  } catch (err) {
    console.error("Google Calendar: could not delete event:", err);
  }
}

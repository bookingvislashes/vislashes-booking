import type { SupabaseClient } from "@supabase/supabase-js";
import { to24Hour } from "./availability";
import { to12Hour } from "./schedule";

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
//
// userinfo.email is what lets Settings name the account that is connected.
// Without it the userinfo lookup in saveConnectionFromCode fails on scope,
// google_email is stored as null every time, and the panel can only ever say
// "Connected" with no way to tell which account it means. It is a basic
// profile scope rather than a sensitive one, so it adds nothing to Google's
// verification requirements.
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
];

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

/**
 * The name of the calendar appointments are actually being written to —
 * "VISLashes", say — so Settings can state it rather than leaving her to
 * infer it from which Google account she thinks she connected.
 *
 * It comes out of an events *list* call, which is a slightly odd way to ask
 * and the only one available: naming a calendar properly means reading the
 * Calendars resource, and that needs a broader Google permission than this
 * app asks for. The events list response happens to carry the calendar's own
 * title in `summary`, so one request for a single event answers it inside the
 * permission already granted. Asking her to re-approve a wider scope just to
 * print a name would be a poor trade.
 *
 * Returns null when not connected, or when Google is unreachable — the panel
 * says so rather than inventing a name.
 */
export async function getCalendarSummary(
  supabase: SupabaseClient
): Promise<string | null> {
  try {
    const client = await getCalendarClient(supabase);
    if (!client) return null;

    const res = await client.calendar.events.list({
      calendarId: client.calendarId,
      maxResults: 1,
    });

    return res.data.summary ?? null;
  } catch (err) {
    console.error("Google Calendar: could not read the calendar name:", err);
    return null;
  }
}

/** Adds `minutes` to an "HH:mm" string, returning "HH:mm". */
function addMinutesTo24Hour(time24: string, minutes: number): string {
  const [h, m] = time24.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function formatDuration(mins: number): string {
  const hrs = Math.floor(mins / 60);
  const m = mins % 60;
  if (hrs && m) return `${hrs} hr ${m} min`;
  if (hrs) return `${hrs} hr`;
  return `${m} min`;
}

function money(value: number): string {
  return `$${value.toFixed(2)}`;
}

/** "2026-09-13" to "Sunday, September 13, 2026", without a timezone shift. */
function formatLongDate(dateISO: string): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * How each `payment_method` should read on the calendar. The site's own four
 * describe a checkout; the rest are the ways she is handed a deposit herself.
 */
const METHOD_LABELS: Record<string, string> = {
  square: "card",
  apple_pay: "Apple Pay",
  google_pay: "Google Pay",
  cash: "cash",
  zelle: "Zelle",
  venmo: "Venmo",
  apple_cash: "Apple Cash",
  invoice: "invoice",
  other: "other",
};

/**
 * Everything one appointment needs, read from the database rather than passed
 * in. See the note on `syncBookingEvent` for why it is shaped this way.
 */
interface BookingRow {
  id: string;
  booking_date: string;
  time_slot: string;
  status: string;
  payment_method: string;
  deposit_paid: boolean;
  deposit_amount: number | string | null;
  has_removal: boolean;
  notes: string | null;
  booking_source: string | null;
  booked_by: string | null;
  google_event_id: string | null;
  clients: {
    full_name: string;
    email: string | null;
    phone: string | null;
    visit_count: number;
  } | null;
  services: {
    name: string;
    price: number | string;
    duration_minutes: number;
  } | null;
  intake_forms: {
    has_had_extensions: boolean;
    is_special_occasion: boolean;
    occasion_details: string | null;
    has_cataracts: boolean;
    has_conjunctivitis: boolean;
    has_dry_eye: boolean;
    has_glaucoma: boolean;
    other_complaints: string | null;
  } | null;
}

/** The one row Supabase returns for a to-one join can arrive as an array. */
function one<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/**
 * The appointment brief that goes in the event body.
 *
 * This is the screen she actually looks at — on her phone, between clients,
 * often without the admin open. So it answers, in order, the questions she
 * asks about a booking: who is coming and how do I reach them, what am I
 * doing and for how long, what have they already paid and what do I collect
 * today, and is there anything I need to know before they sit down.
 *
 * Nothing is invented. The studio address, the artist's name and the phone
 * number come from Settings, and a section whose values are all missing is
 * left out entirely rather than printed with blanks — a calendar entry that
 * confidently states the wrong address is worse than one that states none.
 */
function buildDescription(
  booking: BookingRow,
  settings: Record<string, string>,
  totals: { appointmentTotal: number; depositAmount: number; minutes: number }
): string {
  const client = booking.clients;
  const service = booking.services;
  const intake = booking.intake_forms;
  const sections: string[] = [];

  // ── Client ──────────────────────────────────────────────────────────────
  const clientLines = [client?.full_name, client?.phone, client?.email].filter(
    Boolean
  ) as string[];
  if (client && client.visit_count > 0) {
    clientLines.push(
      client.visit_count === 1
        ? "1 visit so far"
        : `${client.visit_count} visits so far`
    );
  }
  if (clientLines.length) {
    sections.push(`CLIENT\n${clientLines.join("\n")}`);
  }

  // ── Appointment ─────────────────────────────────────────────────────────
  const start24 = to24Hour(booking.time_slot);
  const end24 = addMinutesTo24Hour(start24, totals.minutes);
  const serviceLine = [
    service?.name,
    booking.has_removal ? "+ lash removal" : null,
  ]
    .filter(Boolean)
    .join(" ");
  const appointmentLines = [
    `${serviceLine} · ${formatDuration(totals.minutes)}`,
    `${formatLongDate(booking.booking_date)}`,
    `${booking.time_slot} – ${to12Hour(end24)}`,
  ];
  if (settings.lash_artist) {
    appointmentLines.push(`With ${settings.lash_artist}`);
  }
  sections.push(`APPOINTMENT\n${appointmentLines.join("\n")}`);

  // ── Payment ─────────────────────────────────────────────────────────────
  // The number she needs at the end of the appointment is the balance, so it
  // gets its own line and says out loud that it is due today. The deposit
  // names how it arrived: "$25.00 paid (Zelle)" is the difference between a
  // deposit she can account for and one she has to go looking for.
  const deposit = booking.deposit_paid ? totals.depositAmount : 0;
  const balance = Math.max(0, totals.appointmentTotal - deposit);
  const methodLabel =
    METHOD_LABELS[booking.payment_method] || booking.payment_method;

  const paymentLines = [`Service total: ${money(totals.appointmentTotal)}`];
  if (booking.deposit_paid) {
    paymentLines.push(`Deposit paid: ${money(deposit)} (${methodLabel})`);
  } else if (booking.payment_method === "cash") {
    paymentLines.push("Deposit: none — paying cash at the appointment");
  } else {
    paymentLines.push(`Deposit: not paid (${methodLabel})`);
  }
  paymentLines.push(`Balance due today: ${money(balance)}`);
  sections.push(`PAYMENT\n${paymentLines.join("\n")}`);

  // ── Before they sit down ────────────────────────────────────────────────
  // Only the answers that change what she does. A client with no eye history
  // and no occasion produces nothing here, which is the common case and
  // should not cost four lines of "no".
  const flags: string[] = [];
  if (intake) {
    if (!intake.has_had_extensions) flags.push("First time with extensions");
    if (intake.is_special_occasion) {
      flags.push(
        intake.occasion_details
          ? `Special occasion: ${intake.occasion_details}`
          : "Special occasion"
      );
    }
    const conditions = [
      intake.has_cataracts && "cataracts",
      intake.has_conjunctivitis && "conjunctivitis",
      intake.has_dry_eye && "dry eye",
      intake.has_glaucoma && "glaucoma",
    ].filter(Boolean) as string[];
    if (conditions.length) flags.push(`Eye history: ${conditions.join(", ")}`);
    if (intake.other_complaints) flags.push(intake.other_complaints);
  } else if (booking.booked_by === "admin") {
    // Said plainly, because it is the one thing an appointment she booked
    // herself is missing: nobody has filled in the medical form or signed the
    // waiver yet, and that has to happen before any lashes go on.
    flags.push("No intake form or signed waiver yet — have her sign in person");
  }
  if (booking.notes) flags.push(booking.notes);
  if (flags.length) sections.push(`HEADS UP\n${flags.join("\n")}`);

  // ── Where ───────────────────────────────────────────────────────────────
  if (settings.business_address) {
    sections.push(`STUDIO\n${settings.business_address}`);
  }

  // ── Footer ──────────────────────────────────────────────────────────────
  const base = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
  const footer: string[] = [];
  if (booking.booking_source) {
    footer.push(`Booked via ${booking.booking_source}`);
  } else {
    footer.push(
      booking.booked_by === "admin"
        ? "Booked by VIS Lashes"
        : "Booked through vislashes.com"
    );
  }
  // Opening the booking is one tap from the event, which is the whole reason
  // to reschedule or cancel on the site rather than by editing this entry —
  // an edit here is invisible to the client and to the reminder emails.
  if (base) footer.push(`${base}/admin/bookings/${booking.id}`);
  sections.push(footer.join("\n"));

  return sections.join("\n\n");
}

/**
 * Puts one booking on the calendar, or brings its event back in line with the
 * booking as it now stands.
 *
 * Reading the booking from the database rather than taking it as an argument
 * is the point: every path that creates or changes an appointment — the
 * client's own checkout, a reschedule, an appointment she books herself in
 * the admin — calls this with an id and gets an identical, complete event.
 * Before this, each caller assembled its own subset of the details, so the
 * same appointment described itself differently depending on how it was made,
 * and a reschedule quietly dropped the deposit and the intake answers.
 *
 * Never throws — see the note at the top of this file.
 */
export async function syncBookingEvent(
  supabase: SupabaseClient,
  bookingId: string
): Promise<void> {
  try {
    const client = await getCalendarClient(supabase);
    if (!client) return; // Not configured or not connected — nothing to do.

    const { data, error } = await supabase
      .from("bookings")
      .select(
        `id, booking_date, time_slot, status, payment_method, deposit_paid,
         deposit_amount, has_removal, notes, booking_source, booked_by,
         google_event_id,
         clients(full_name, email, phone, visit_count),
         services(name, price, duration_minutes),
         intake_forms(has_had_extensions, is_special_occasion, occasion_details,
                      has_cataracts, has_conjunctivitis, has_dry_eye,
                      has_glaucoma, other_complaints)`
      )
      .eq("id", bookingId)
      .maybeSingle();

    if (error || !data) {
      console.error("Google Calendar: could not load booking:", error);
      return;
    }

    const raw = data as unknown as BookingRow & {
      clients: unknown;
      services: unknown;
      intake_forms: unknown;
    };
    const booking: BookingRow = {
      ...raw,
      clients: one(raw.clients as BookingRow["clients"]),
      services: one(raw.services as BookingRow["services"]),
      intake_forms: one(raw.intake_forms as BookingRow["intake_forms"]),
    };

    if (!booking.services) {
      console.error(`Google Calendar: booking ${bookingId} has no service.`);
      return;
    }

    // A cancelled appointment has no business holding time on the calendar.
    // Reached when a status change syncs rather than deletes.
    if (booking.status === "cancelled") {
      await deleteBookingEvent(supabase, bookingId);
      return;
    }

    const { data: settingsRows } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", [
        "business_address",
        "lash_artist",
        "removal_price",
        "removal_duration_minutes",
      ]);
    const settings = Object.fromEntries(
      (settingsRows || []).map((s) => [s.key as string, s.value as string])
    ) as Record<string, string>;

    // Both read server-side, like every other price in this app. A removal
    // lengthens the appointment and adds to the total, so the event has to
    // size and price it the same way the slot engine and the email do.
    const removalMinutes = booking.has_removal
      ? parseInt(settings.removal_duration_minutes || "30", 10)
      : 0;
    const removalPrice = booking.has_removal
      ? Number(settings.removal_price || 0)
      : 0;

    const minutes = booking.services.duration_minutes + removalMinutes;
    const appointmentTotal = Number(booking.services.price) + removalPrice;
    const depositAmount = Number(booking.deposit_amount ?? 0);

    const start24 = to24Hour(booking.time_slot);
    const end24 = addMinutesTo24Hour(start24, minutes);

    const clientName = booking.clients?.full_name || "Client";
    const serviceName = booking.has_removal
      ? `${booking.services.name} + removal`
      : booking.services.name;

    // Her name first. Scanning a Sunday of appointments, she knows the
    // services by heart and is looking for who is in the chair.
    const summary = `${clientName} — ${serviceName}`;

    const requestBody = {
      summary,
      description: buildDescription(booking, settings, {
        appointmentTotal,
        depositAmount,
        minutes,
      }),
      // Only when Settings has one. An address is exactly the kind of detail
      // that must not be guessed.
      ...(settings.business_address
        ? { location: settings.business_address }
        : {}),
      start: {
        dateTime: `${booking.booking_date}T${start24}:00`,
        timeZone: TIMEZONE,
      },
      end: {
        dateTime: `${booking.booking_date}T${end24}:00`,
        timeZone: TIMEZONE,
      },
      // Flamingo — the same pink her Acuity entries used, so a lash
      // appointment still reads as one at a glance among everything else on
      // the calendar.
      colorId: "4",
    };

    // An event this booking already has is updated in place, not replaced.
    // Deleting and re-inserting would hand it a new id, drop any reminder she
    // had set on it, and make it re-appear as a brand new entry every time a
    // deposit was recorded.
    if (booking.google_event_id) {
      try {
        await client.calendar.events.patch({
          calendarId: client.calendarId,
          eventId: booking.google_event_id,
          requestBody,
        });
        return;
      } catch (err) {
        const status =
          (err as { code?: number; status?: number }).code ??
          (err as { status?: number }).status;
        // Gone from her calendar — she deleted it by hand, or it belonged to
        // a Google account that is no longer the connected one. Fall through
        // and write a fresh event rather than losing the appointment.
        if (status !== 404 && status !== 410) throw err;
      }
    }

    const res = await client.calendar.events.insert({
      calendarId: client.calendarId,
      requestBody,
    });

    const eventId = res.data.id;
    if (eventId && eventId !== booking.google_event_id) {
      await supabase
        .from("bookings")
        .update({ google_event_id: eventId })
        .eq("id", bookingId);
    }
  } catch (err) {
    console.error("Google Calendar: could not sync event:", err);
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

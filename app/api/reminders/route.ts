import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendReminderEmail } from "@/lib/email";
import {
  isSmsConfigured,
  sendSms,
  toE164,
  twoDayText,
  twoHourText,
  SmsOptedOutError,
} from "@/lib/sms";

/**
 * Appointment reminders, in the two windows she asked for: two days before,
 * and two hours before. Wired to the cron in vercel.json.
 *
 * The two-hour window can only fire if this route runs more often than once a
 * day. Vercel's Hobby plan caps crons at daily, so today only the two-day
 * reminder actually goes out; the two-hour pass runs, finds nothing, and costs
 * nothing. Point an hourly scheduler at this URL (or move to a plan with
 * hourly crons) and the second reminder starts working with no code change.
 *
 * Each window sends by email and, when Twilio is configured, by text as well.
 * The two are independent: a text failing never costs someone their email, and
 * a client with no email still gets the text. A window is only stamped once at
 * least one of them has actually gone out, so an outage retries on the next
 * run instead of silently marking everyone as reminded.
 *
 * With no Twilio credentials set, the SMS half is skipped entirely and this
 * behaves exactly as it did before — so it is safe to deploy ahead of the
 * account existing.
 */

// The salon is in Florida and the cron fires in UTC, so every date and hour
// comparison is done in the salon's own timezone. In UTC, an appointment
// booked late in the evening lands on the wrong calendar day.
const TIMEZONE = "America/New_York";

/** Which reminder a booking is being sent, and the column that records it. */
const WINDOWS = {
  twoDay: { column: "reminder_2day_sent_at" },
  twoHour: { column: "reminder_2hour_sent_at" },
} as const;

type WindowName = keyof typeof WINDOWS;

function salonDatePlusDays(days: number): string {
  const now = new Date();
  // en-CA formats as YYYY-MM-DD, which is the shape bookings.booking_date uses.
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const [y, m, d] = today.split("-").map(Number);
  // Constructed in UTC purely as calendar arithmetic — no local offset is
  // involved, so this cannot slip a day.
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return shifted.toISOString().slice(0, 10);
}

/** Minutes since midnight, in the salon's timezone. */
function salonMinutesNow(): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  // en-US with hour12:false renders midnight as 24 in some runtimes.
  return (hour % 24) * 60 + minute;
}

/** "2:30 PM" — the shape bookings.time_slot uses — as minutes since midnight. */
function slotToMinutes(slot: string): number | null {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(slot.trim());
  if (!match) return null;
  let hour = Number(match[1]) % 12;
  if (match[3].toUpperCase() === "PM") hour += 12;
  return hour * 60 + Number(match[2]);
}

function formatDuration(mins: number): string {
  const hrs = Math.floor(mins / 60);
  const m = mins % 60;
  if (hrs && m) return `${hrs} hr ${m} min`;
  if (hrs) return `${hrs} hr`;
  return `${m} min`;
}

interface ReminderRow {
  id: string;
  booking_date: string;
  time_slot: string;
  deposit_amount: number | string | null;
  clients: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    sms_consent: boolean | null;
    sms_opt_out: boolean | null;
  } | null;
  services: { name: string; price: number | string; duration_minutes: number } | null;
}

export async function GET(req: NextRequest) {
  // Vercel sends this header on scheduled invocations when CRON_SECRET is set.
  // Without it the route is a public URL that sends mail to real customers —
  // the sent-at guards below cap the damage at one email per window, but the
  // secret is what actually closes it. Enforced only when configured so that
  // adding it later cannot silently stop reminders in the meantime.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    console.warn(
      "Reminders: CRON_SECRET is not set — this endpoint is publicly callable."
    );
  }

  try {
    const supabase = await createServiceClient();

    // The two-hour text is the one that has to get someone to the door, so it
    // carries the address. Read from Settings rather than written here: a
    // hardcoded address survives a move and sends a client to the wrong house.
    // Absent means the text simply omits it.
    const { data: addressRow } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "business_address")
      .maybeSingle();
    const salonAddress = addressRow?.value ?? null;

    const select =
      "id, booking_date, time_slot, deposit_amount, clients(id, full_name, email, phone, sms_consent, sms_opt_out), services(name, price, duration_minutes)";

    const normalise = (rows: unknown[]): ReminderRow[] =>
      (rows || []).map((row) => {
        const r = row as ReminderRow & { clients: unknown; services: unknown };
        return {
          ...r,
          clients: Array.isArray(r.clients) ? r.clients[0] : r.clients,
          services: Array.isArray(r.services) ? r.services[0] : r.services,
        };
      }) as ReminderRow[];

    /** Sends one reminder and stamps its window. Never throws. */
    const send = async (booking: ReminderRow, windowName: WindowName) => {
      const column = WINDOWS[windowName].column;
      const stamp = () =>
        supabase
          .from("bookings")
          .update({ [column]: new Date().toISOString() })
          .eq("id", booking.id);

      const client = booking.clients;
      // Two separate gates, and both have to pass. sms_consent is the yes she
      // gave at booking; sms_opt_out is a later STOP that overrides it. Without
      // the consent check the reminders would text people who never asked,
      // which is the thing the whole registration turns on.
      const phone =
        client?.sms_consent && !client?.sms_opt_out
          ? toE164(client?.phone)
          : null;

      if (!booking.services || !client || (!client.email && !phone)) {
        // No way to reach this person at all. Stamped anyway so a permanently
        // unsendable row is not retried on every run forever.
        await stamp();
        return "skipped" as const;
      }

      // Tracked separately: one shared flag would mean a text going out and an
      // email going out were indistinguishable, and the stamp below has to
      // know whether ANYTHING reached her.
      let emailed = false;
      let texted = false;

      if (client.email) {
        try {
          await sendReminderEmail({
            clientName: client.full_name,
            clientEmail: client.email,
            serviceName: booking.services.name,
            bookingDate: booking.booking_date,
            timeSlot: booking.time_slot,
            duration: formatDuration(booking.services.duration_minutes),
            depositAmount: Number(booking.deposit_amount ?? 0),
            totalPrice: Number(booking.services.price),
            paymentMethod: "square",
            window: windowName,
          });
          emailed = true;
        } catch (err) {
          console.error(
            `Reminders: ${windowName} email failed for booking ${booking.id}:`,
            err
          );
        }
      }

      if (phone && isSmsConfigured()) {
        const details = {
          clientName: client.full_name,
          serviceName: booking.services.name,
          bookingDate: booking.booking_date,
          timeSlot: booking.time_slot,
          address: salonAddress,
        };
        try {
          await sendSms(
            phone,
            windowName === "twoDay" ? twoDayText(details) : twoHourText(details)
          );
          texted = true;
        } catch (err) {
          if (err instanceof SmsOptedOutError) {
            // She replied STOP. Recorded so we stop trying, rather than
            // failing this same send on every run from here on. Her email
            // reminders carry on untouched.
            await supabase
              .from("clients")
              .update({ sms_opt_out: true })
              .eq("id", client.id);
            console.warn(
              `Reminders: ${client.id} has opted out of texts; flagged.`
            );
          } else {
            console.error(
              `Reminders: ${windowName} text failed for booking ${booking.id}:`,
              err
            );
          }
        }
      }

      if (emailed || texted) {
        // Stamped only once something actually went out, so an outage leaves
        // the row eligible for the next run rather than silently skipping it.
        await stamp();
        return "sent" as const;
      }

      return "failed" as const;
    };

    // ── Two days out ─────────────────────────────────────────────────────
    const twoDayDate = salonDatePlusDays(2);

    const { data: twoDayData, error: twoDayError } = await supabase
      .from("bookings")
      .select(select)
      .eq("booking_date", twoDayDate)
      .eq("status", "confirmed")
      .is("reminder_2day_sent_at", null);

    if (twoDayError) {
      console.error("Reminders: could not load two-day bookings:", twoDayError);
      return NextResponse.json(
        { error: "Could not load bookings", detail: twoDayError.message },
        { status: 500 }
      );
    }

    let twoDaySent = 0;
    let twoDayFailed = 0;
    for (const booking of normalise(twoDayData || [])) {
      const result = await send(booking, "twoDay");
      if (result === "sent") twoDaySent += 1;
      if (result === "failed") twoDayFailed += 1;
    }

    // ── Two hours out ────────────────────────────────────────────────────
    // Today's appointments only, then filtered by the clock. The window is
    // generous on both sides so an hourly cron cannot step over an
    // appointment: anything starting between 60 and 180 minutes from now is
    // due, and the sent-at stamp stops it being sent twice.
    const today = salonDatePlusDays(0);
    const nowMinutes = salonMinutesNow();

    const { data: todayData, error: todayError } = await supabase
      .from("bookings")
      .select(select)
      .eq("booking_date", today)
      .eq("status", "confirmed")
      .is("reminder_2hour_sent_at", null);

    if (todayError) {
      console.error("Reminders: could not load today's bookings:", todayError);
      // The two-day pass already ran and its results are worth reporting, so
      // this is not fatal to the whole invocation.
      return NextResponse.json({
        twoDay: { date: twoDayDate, sent: twoDaySent, failed: twoDayFailed },
        twoHour: { error: todayError.message },
      });
    }

    let twoHourSent = 0;
    let twoHourFailed = 0;
    for (const booking of normalise(todayData || [])) {
      const start = slotToMinutes(booking.time_slot);
      if (start === null) continue;
      const minutesAway = start - nowMinutes;
      if (minutesAway < 60 || minutesAway > 180) continue;

      const result = await send(booking, "twoHour");
      if (result === "sent") twoHourSent += 1;
      if (result === "failed") twoHourFailed += 1;
    }

    return NextResponse.json({
      twoDay: { date: twoDayDate, sent: twoDaySent, failed: twoDayFailed },
      twoHour: { date: today, sent: twoHourSent, failed: twoHourFailed },
    });
  } catch (err) {
    console.error("Reminders: unexpected failure:", err);
    return NextResponse.json({ error: "Reminder run failed" }, { status: 500 });
  }
}

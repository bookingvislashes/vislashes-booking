import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  getEmailSettings,
  sendBirthdayEmail,
  sendFollowUpEmail,
  sendReminderEmail,
  sendWinBackEmail,
} from "@/lib/email";
import { grantCredit, loadCreditAmounts } from "@/lib/credits";
import { salonMinutesNow, slotToMinutes } from "@/lib/salon-time";
import {
  isSmsConfigured,
  sendSms,
  toE164,
  twoDayText,
  twoHourText,
  SmsOptedOutError,
} from "@/lib/sms";
import {
  syncUpcomingBookings,
  type BackfillResult,
} from "@/lib/google-calendar";

/**
 * Everything the site sends on a schedule: the two-day and two-hour
 * reminders before an appointment, the check-in two days after one, the
 * birthday greeting, and the win-back six weeks after someone's last visit.
 * Wired to the cron in vercel.json.
 *
 * Five passes, all in one route rather than five crons — the Hobby plan
 * allows very few, and they all want the same daily tick. Each pass that
 * depends on a hand-run migration is fenced in its own try/catch and its own
 * query, so an un-run migration costs that pass and never the reminders.
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
    preferred_language: string | null;
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

    // Calendar backfill, riding the reminders cron rather than its own.
    //
    // Sync at booking time is best-effort and silent — it runs after the card
    // is charged, so it is never allowed to throw — which means a spell of
    // Google refusing writes leaves appointments off the calendar with
    // nothing at all to notice it. This is the sweep that goes back for them,
    // so the backlog clears itself once the fault does.
    //
    // It shares this cron because the Hobby plan allows very few, and it
    // costs nothing on an ordinary day: with no gaps to fill it is a single
    // indexed query. Wrapped because reminders are the time-critical half of
    // this route and must not be lost to a calendar problem.
    let calendar: BackfillResult = { missing: 0, synced: 0, problem: null };
    try {
      calendar = await syncUpcomingBookings(supabase);
      if (calendar.problem) {
        console.error(
          "Reminders: calendar backfill blocked:",
          calendar.problem
        );
      }
    } catch (err) {
      console.error("Reminders: calendar backfill failed:", err);
    }

    // The two-hour text is the one that has to get someone to the door, so it
    // carries the address. Read from Settings rather than written here: a
    // hardcoded address survives a move and sends a client to the wrong house.
    // Absent means the text simply omits it. Your Inbox comes back in the
    // same read and becomes the Reply-To on every reminder — a client who
    // answers "can I move this?" has to reach her personally.
    const { studioAddress: salonAddress, replyTo } =
      await getEmailSettings(supabase);

    const select =
      "id, booking_date, time_slot, deposit_amount, clients(id, full_name, email, phone, preferred_language, sms_consent, sms_opt_out), services(name, price, duration_minutes)";

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
            studioAddress: salonAddress,
            replyTo,
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
          // Anything other than "es" is English, including null on a row
          // written before migration 025. Falling back rather than trusting
          // the column means an unexpected value reads in the language she
          // has always received, not a blank message.
          language: client.preferred_language === "es" ? ("es" as const) : ("en" as const),
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
        calendar,
        followUp: { skipped: "Two-hour pass failed; follow-ups run tomorrow." },
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

    // ── Two days after ───────────────────────────────────────────────────
    // The check-in: aftercare, when to book a fill, and a nudge to tag or
    // recommend her.
    //
    // Fenced in its own try/catch and its own query on purpose.
    // followup_sent_at arrives with migration 022, which is run by hand, so
    // there is a window where this code is deployed and the column does not
    // exist yet. Naming a column PostgREST cannot see fails the whole query —
    // folding this into the passes above would have meant one unrun migration
    // silently stopping every reminder, which is the same failure that once
    // cost the Today page its bookings. A missing column costs the follow-up
    // and nothing else.
    const followUpDate = salonDatePlusDays(-2);
    let followUp: Record<string, unknown> = { date: followUpDate, sent: 0, failed: 0 };

    try {
      const { data: pastData, error: pastError } = await supabase
        .from("bookings")
        .select("id, clients(full_name, email)")
        .eq("booking_date", followUpDate)
        // Cancellations and no-shows are excluded: asking someone how they
        // are loving lashes they never got is worse than saying nothing.
        .in("status", ["confirmed", "completed"])
        .is("followup_sent_at", null);

      if (pastError) throw pastError;

      let sent = 0;
      let failed = 0;

      for (const row of pastData || []) {
        const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
        if (!client?.email) {
          // Unreachable by email and always will be. Stamped so it is not
          // reconsidered on every future run.
          await supabase
            .from("bookings")
            .update({ followup_sent_at: new Date().toISOString() })
            .eq("id", row.id);
          continue;
        }

        try {
          await sendFollowUpEmail({
            clientName: client.full_name,
            clientEmail: client.email,
            replyTo,
            bookingId: row.id,
          });
          await supabase
            .from("bookings")
            .update({ followup_sent_at: new Date().toISOString() })
            .eq("id", row.id);
          sent += 1;
        } catch (err) {
          console.error(`Follow-up failed for booking ${row.id}:`, err);
          failed += 1;
        }
      }

      followUp = { date: followUpDate, sent, failed };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Follow-ups skipped:", message);
      followUp = {
        date: followUpDate,
        skipped: message.includes("followup_sent_at")
          ? "Run migration 022."
          : message,
      };
    }

    // ── Birthdays ────────────────────────────────────────────────────────
    // Anyone whose birth month is this month and who has not been greeted
    // this year. Keyed on the YEAR rather than a date, so a cron that misses
    // the 1st still greets everyone on the 2nd, and nobody is greeted twice
    // however often it runs.
    //
    // The credit is granted BEFORE the email goes out. An email promising
    // money that then failed to land on the account is worse than a credit
    // sitting quietly on a client who never opened the email.
    const thisYear = Number(salonDatePlusDays(0).slice(0, 4));
    const thisMonth = Number(salonDatePlusDays(0).slice(5, 7));
    let birthdays: Record<string, unknown> = { month: thisMonth, sent: 0, failed: 0 };

    try {
      const { data: birthdayClients, error: birthdayError } = await supabase
        .from("clients")
        .select("id, full_name, email, birthday_email_year")
        .eq("birth_month", thisMonth)
        .not("email", "is", null);

      if (birthdayError) throw birthdayError;

      const amounts = await loadCreditAmounts(supabase);
      let sent = 0;
      let failed = 0;

      for (const client of birthdayClients || []) {
        if (client.birthday_email_year === thisYear) continue;
        if (!client.email) continue;

        await grantCredit(
          supabase,
          client.id,
          amounts.birthday,
          "Happy birthday from me!"
        );

        try {
          await sendBirthdayEmail({
            clientName: client.full_name,
            clientEmail: client.email,
            amount: amounts.birthday,
            replyTo,
          });
          await supabase
            .from("clients")
            .update({ birthday_email_year: thisYear })
            .eq("id", client.id);
          sent += 1;
        } catch (err) {
          console.error(`Birthday email failed for client ${client.id}:`, err);
          failed += 1;
        }
      }

      birthdays = { month: thisMonth, sent, failed };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Birthdays skipped:", message);
      birthdays = { month: thisMonth, skipped: message.includes("birth_month") ? "Run migration 023." : message };
    }

    // ── Win-backs ────────────────────────────────────────────────────────
    // Six weeks after an appointment, to anyone with nothing booked since.
    //
    // Driven off bookings on one date rather than by scanning every client,
    // for the same reason the follow-up is: it is one query, and a client
    // who has been back simply fails the "nothing since" check below.
    const winbackDate = salonDatePlusDays(-42);
    let winbacks: Record<string, unknown> = { date: winbackDate, sent: 0, failed: 0 };

    try {
      const { data: thatDay, error: thatDayError } = await supabase
        .from("bookings")
        .select("client_id")
        .eq("booking_date", winbackDate)
        .in("status", ["confirmed", "completed"]);

      if (thatDayError) throw thatDayError;

      const candidateIds = Array.from(
        new Set((thatDay || []).map((b) => b.client_id).filter(Boolean))
      ) as string[];

      let sent = 0;
      let failed = 0;

      if (candidateIds.length) {
        // One query for "has anyone here been back, or got something booked".
        // Anything dated after that appointment counts, past or future — a
        // client with a set next Tuesday does not need to be missed.
        const { data: since } = await supabase
          .from("bookings")
          .select("client_id")
          .in("client_id", candidateIds)
          .gt("booking_date", winbackDate)
          .in("status", ["confirmed", "completed"]);

        const stillAway = new Set(candidateIds);
        for (const row of since || []) stillAway.delete(row.client_id as string);

        if (stillAway.size) {
          const { data: clients } = await supabase
            .from("clients")
            .select("id, full_name, email, winback_sent_at")
            .in("id", Array.from(stillAway))
            .not("email", "is", null);

          for (const client of clients || []) {
            if (!client.email) continue;
            // Sent since that appointment means this gap is already covered.
            // Comparing against the appointment date rather than "ever sent"
            // is what lets a client who returns and drifts again be missed a
            // second time.
            if (
              client.winback_sent_at &&
              client.winback_sent_at.slice(0, 10) > winbackDate
            ) {
              continue;
            }

            try {
              await sendWinBackEmail({
                clientName: client.full_name,
                clientEmail: client.email,
                replyTo,
              });
              await supabase
                .from("clients")
                .update({ winback_sent_at: new Date().toISOString() })
                .eq("id", client.id);
              sent += 1;
            } catch (err) {
              console.error(`Win-back failed for client ${client.id}:`, err);
              failed += 1;
            }
          }
        }
      }

      winbacks = { date: winbackDate, sent, failed };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Win-backs skipped:", message);
      winbacks = { date: winbackDate, skipped: message.includes("winback_sent_at") ? "Run migration 023." : message };
    }

    return NextResponse.json({
      twoDay: { date: twoDayDate, sent: twoDaySent, failed: twoDayFailed },
      twoHour: { date: today, sent: twoHourSent, failed: twoHourFailed },
      calendar,
      followUp,
      birthdays,
      winbacks,
    });
  } catch (err) {
    console.error("Reminders: unexpected failure:", err);
    return NextResponse.json({ error: "Reminder run failed" }, { status: 500 });
  }
}

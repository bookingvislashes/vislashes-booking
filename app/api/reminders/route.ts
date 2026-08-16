import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendReminderEmail } from "@/lib/email";

/**
 * Daily 24-hour reminder emails. Wired to the cron in vercel.json.
 *
 * This used to return {"sent": 0} with the real implementation commented out,
 * so every customer who was told to expect a reminder never got one.
 */

// The cron fires at 10:00 UTC, which is early morning in Florida — so "the
// day after today" has to be worked out in the salon's own timezone. Doing it
// in UTC would send the wrong day's reminders for anyone booked late evening.
const TIMEZONE = "America/New_York";

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
  clients: { full_name: string; email: string } | null;
  services: { name: string; price: number | string; duration_minutes: number } | null;
}

export async function GET(req: NextRequest) {
  // Vercel sends this header on scheduled invocations when CRON_SECRET is set.
  // Without it the route is a public URL that sends mail to real customers —
  // the reminder_sent_at guard below caps the damage at one email per booking,
  // but the secret is what actually closes it. Enforced only when configured
  // so that adding it later cannot silently stop reminders in the meantime.
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
    const target = salonDatePlusDays(1);

    // reminder_sent_at null is what makes this safe to run more than once:
    // a cron retry, or someone hitting the URL, re-sends nothing.
    const { data, error } = await supabase
      .from("bookings")
      .select(
        "id, booking_date, time_slot, deposit_amount, clients(full_name, email), services(name, price, duration_minutes)"
      )
      .eq("booking_date", target)
      .eq("status", "confirmed")
      .is("reminder_sent_at", null);

    if (error) {
      console.error("Reminders: could not load bookings:", error);
      return NextResponse.json(
        { error: "Could not load bookings", detail: error.message },
        { status: 500 }
      );
    }

    const rows = (data || []).map((row) => ({
      ...row,
      clients: Array.isArray(row.clients) ? row.clients[0] : row.clients,
      services: Array.isArray(row.services) ? row.services[0] : row.services,
    })) as ReminderRow[];

    let sent = 0;
    const failed: string[] = [];

    for (const booking of rows) {
      if (!booking.clients?.email || !booking.services) {
        // Nothing to send to. Marked anyway so a permanently unsendable row
        // is not retried every single day forever.
        await supabase
          .from("bookings")
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq("id", booking.id);
        continue;
      }

      try {
        await sendReminderEmail({
          clientName: booking.clients.full_name,
          clientEmail: booking.clients.email,
          serviceName: booking.services.name,
          bookingDate: booking.booking_date,
          timeSlot: booking.time_slot,
          duration: formatDuration(booking.services.duration_minutes),
          depositAmount: Number(booking.deposit_amount ?? 0),
          totalPrice: Number(booking.services.price),
          paymentMethod: "square",
        });

        // Stamped only after the send resolves, so a failure leaves the row
        // eligible for tomorrow's run rather than silently skipping it.
        await supabase
          .from("bookings")
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq("id", booking.id);

        sent += 1;
      } catch (err) {
        console.error(`Reminders: send failed for booking ${booking.id}:`, err);
        failed.push(booking.id);
      }
    }

    return NextResponse.json({ date: target, sent, failed: failed.length });
  } catch (err) {
    console.error("Reminders: unexpected failure:", err);
    return NextResponse.json({ error: "Reminder run failed" }, { status: 500 });
  }
}

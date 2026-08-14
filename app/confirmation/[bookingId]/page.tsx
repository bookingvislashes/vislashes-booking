import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

interface ConfirmationPageProps {
  params: Promise<{ bookingId: string }>;
}

interface BookingRow {
  id: string;
  booking_date: string;
  time_slot: string;
  status: string;
  payment_method: string;
  deposit_paid: boolean;
  deposit_amount: number | null;
  client: { full_name: string; email: string } | null;
  service: { name: string; price: number; duration_minutes: number } | null;
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDuration(mins: number) {
  const hrs = Math.floor(mins / 60);
  const m = mins % 60;
  if (hrs && m) return `${hrs} hr ${m} min`;
  if (hrs) return `${hrs} hr`;
  return `${m} min`;
}

/** One labelled line of the receipt. Renders nothing when it has no value. */
function Row({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string | null | undefined;
  emphasis?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-4 py-3 border-b border-light-tan last:border-b-0">
      <dt className="font-sans text-[13px] text-muted shrink-0">{label}</dt>
      <dd
        className={`font-sans text-right text-dark-brown ${
          emphasis ? "text-[16px] font-semibold" : "text-[15px]"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

export default async function ConfirmationPage({ params }: ConfirmationPageProps) {
  const { bookingId } = await params;

  let booking: BookingRow | null = null;
  let settings: Record<string, string> = {};

  // Read with the service client: RLS restricts booking reads to signed-in
  // staff, and the person who just booked is a guest. The booking id is a
  // random UUID that only they and the salon ever see, which is what keeps the
  // page private — so it is deliberately not linked or listed anywhere.
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createServiceClient();

      const [bookingRes, settingsRes] = await Promise.all([
        supabase
          .from("bookings")
          .select(
            "id, booking_date, time_slot, status, payment_method, deposit_paid, deposit_amount, client:clients(full_name, email), service:services(name, price, duration_minutes)"
          )
          .eq("id", bookingId)
          .maybeSingle(),
        supabase
          .from("settings")
          .select("key, value")
          .in("key", ["business_address", "lash_artist", "business_phone"]),
      ]);

      if (bookingRes.data) {
        const row = bookingRes.data;
        booking = {
          ...row,
          client: Array.isArray(row.client) ? row.client[0] : row.client,
          service: Array.isArray(row.service) ? row.service[0] : row.service,
        } as BookingRow;
      }

      settings = Object.fromEntries(
        (settingsRes.data || []).map((s) => [s.key as string, s.value as string])
      );
    } catch (error) {
      // The booking itself succeeded — this page only reads it back. Falling
      // through to the reference-only view is better than an error screen for
      // someone who has just paid.
      console.error("Confirmation lookup failed:", error);
    }
  }

  const deposit = booking?.deposit_paid
    ? `$${Number(booking.deposit_amount ?? 0).toFixed(2)} paid`
    : booking
      ? "Due at your appointment"
      : null;

  const balance =
    booking?.service && booking.deposit_paid
      ? `$${(Number(booking.service.price) - Number(booking.deposit_amount ?? 0)).toFixed(2)}`
      : booking?.service
        ? `$${Number(booking.service.price).toFixed(2)}`
        : null;

  return (
    <div className="min-h-[100dvh] bg-cream flex items-center justify-center px-6 py-12">
      <div className="max-w-md w-full">
        <div className="text-center">
          {/* Success checkmark */}
          <div className="w-16 h-16 mx-auto mb-6 bg-success/15 rounded-full flex items-center justify-center animate-[scale-in_300ms_ease-out]">
            <svg
              className="w-8 h-8 text-success"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="font-display text-[32px] font-bold text-dark-brown mb-2">
            You&apos;re All Set!
          </h1>
          <p className="font-sans text-[15px] text-charcoal mb-8">
            {booking?.client?.email
              ? `Your appointment is confirmed. A copy is on its way to ${booking.client.email}.`
              : "Your lash appointment has been confirmed. Check your email for a confirmation with all the details."}
          </p>
        </div>

        {booking ? (
          <div className="bg-white rounded-surface p-5 sm:p-6 shadow-[0_1px_4px_rgba(0,0,0,0.06)] mb-6 text-left">
            <h2 className="font-display text-[18px] font-bold text-dark-brown mb-1">
              {booking.service?.name ?? "Your appointment"}
            </h2>
            <p className="font-sans text-[13px] text-muted mb-4">
              {formatDate(booking.booking_date)} at {booking.time_slot}
            </p>

            <dl>
              <Row label="Name" value={booking.client?.full_name} />
              <Row label="Lash set" value={booking.service?.name} />
              <Row label="Date" value={formatDate(booking.booking_date)} />
              <Row label="Time" value={booking.time_slot} emphasis />
              <Row
                label="Duration"
                value={
                  booking.service
                    ? formatDuration(booking.service.duration_minutes)
                    : null
                }
              />
              <Row label="Lash artist" value={settings.lash_artist} />
              <Row label="Studio" value={settings.business_address} />
              <Row label="Questions" value={settings.business_phone} />
              <Row label="Deposit" value={deposit} emphasis />
              <Row label="Balance at appointment" value={balance} />
            </dl>

            <p className="font-sans text-[11px] text-muted mt-4 pt-3 border-t border-light-tan break-all">
              Reference {booking.id}
            </p>
          </div>
        ) : (
          // Shown when the booking can't be read back — it was still created,
          // and this reference is what the salon needs to find it.
          <div className="bg-white rounded-surface p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] mb-6 text-center">
            <p className="font-sans text-[12px] text-muted mb-1">
              Booking Reference
            </p>
            <p className="font-sans text-[14px] text-charcoal font-semibold break-all">
              {bookingId}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3 text-center">
          <Link
            href="/"
            className="inline-block font-sans text-[14px] font-semibold text-white bg-deep-brown px-8 py-3 rounded-control hover:bg-dark-brown transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

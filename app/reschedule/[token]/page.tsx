import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { bookingIdFromToken } from "@/lib/reschedule-link";
import { loadReschedulable, rescheduleBlock } from "@/lib/reschedule";
import { RescheduleFlow } from "@/components/reschedule/RescheduleFlow";

/**
 * The page behind the "Change my date or time" button in a confirmation.
 *
 * Read through the service role after the signed token checks out, exactly
 * like the invoice page: `bookings` has no anon policy, and the signature is
 * the whole credential. Never indexed, and it can only ever move the one
 * appointment its link was signed for.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Change your appointment · VIS Lashes",
  robots: { index: false, follow: false },
};

function longDate(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d, 12).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/** The dead ends, in the salon's voice rather than an error code. */
function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="min-h-[100dvh] bg-cream flex items-center justify-center px-6 py-12">
      <div className="max-w-md w-full bg-white rounded-surface p-6 sm:p-8 shadow-[0_1px_4px_rgba(0,0,0,0.06)] text-center">
        <h1 className="font-display text-[26px] font-bold text-dark-brown mb-3">
          {title}
        </h1>
        <p className="font-sans text-[15px] leading-relaxed text-charcoal">
          {body}
        </p>
      </div>
    </div>
  );
}

export default async function ReschedulePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const bookingId = bookingIdFromToken(token);
  if (!bookingId || !isSupabaseConfigured()) notFound();

  const admin = await createServiceClient();
  const booking = await loadReschedulable(admin, bookingId);
  if (!booking) notFound();

  const blocked = rescheduleBlock(booking);

  if (blocked === "cancelled") {
    return (
      <Notice
        title="This appointment isn't active"
        body="It looks like this one has already been cancelled. If that's a surprise, just reply to your confirmation email and I'll take a look."
      />
    );
  }

  if (blocked === "past") {
    return (
      <Notice
        title="This appointment has already passed"
        body="Ready for your next set? Head to the booking page and pick a time that works for you."
      />
    );
  }

  if (blocked === "too-late") {
    return (
      <Notice
        title="This one's too close to move online"
        body={`Your appointment is on ${longDate(booking.booking_date)} at ${booking.time_slot}. Changes this close need a quick message — reply to your confirmation email and we'll find you a new time.`}
      />
    );
  }

  return (
    <RescheduleFlow
      token={token}
      serviceId={booking.service.id}
      serviceName={
        booking.has_removal
          ? `${booking.service.name} + lash removal`
          : booking.service.name
      }
      hasRemoval={booking.has_removal}
      currentDate={booking.booking_date}
      currentTime={booking.time_slot}
      firstName={(booking.client?.full_name || "").trim().split(" ")[0]}
      depositPaid={booking.deposit_paid}
      depositAmount={Number(booking.deposit_amount ?? 0)}
    />
  );
}

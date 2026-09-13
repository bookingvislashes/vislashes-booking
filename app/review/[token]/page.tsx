import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { bookingIdFromToken } from "@/lib/booking-links";
import { ReviewForm } from "@/components/review/ReviewForm";

/**
 * The page behind "Leave a review" in the follow-up email.
 *
 * Same shape as the reschedule page: the signed token is the whole
 * credential, the row is read through the service role once it checks out,
 * and the route is never indexed.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Leave a review · VIS Lashes",
  robots: { index: false, follow: false },
};

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const bookingId = bookingIdFromToken(token, "review");
  if (!bookingId || !isSupabaseConfigured()) notFound();

  const admin = await createServiceClient();
  const { data: booking } = await admin
    .from("bookings")
    .select("id, client:clients(full_name), service:services(name)")
    .eq("id", bookingId)
    .maybeSingle();

  if (!booking) notFound();

  const client = Array.isArray(booking.client) ? booking.client[0] : booking.client;
  const service = Array.isArray(booking.service) ? booking.service[0] : booking.service;

  // Already reviewed is not an error and not a 404 — the form says so itself
  // when the insert comes back as a duplicate, which keeps one code path.
  return (
    <div className="min-h-[100dvh] bg-cream flex items-center justify-center px-6 py-12">
      <div className="max-w-md w-full">
        <p className="text-center font-sans text-[13px] tracking-[3px] text-dark-brown font-semibold mb-6">
          VIS <em>LASHES</em>
        </p>
        <ReviewForm
          token={token}
          firstName={(client?.full_name || "").trim().split(" ")[0]}
          serviceName={service?.name || "appointment"}
        />
      </div>
    </div>
  );
}

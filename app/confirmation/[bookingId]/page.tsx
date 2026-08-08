import Link from "next/link";

interface ConfirmationPageProps {
  params: Promise<{ bookingId: string }>;
}

export default async function ConfirmationPage({ params }: ConfirmationPageProps) {
  const { bookingId } = await params;

  // In production, fetch booking details from Supabase using bookingId
  // For now, show a generic confirmation

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
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
          Your lash appointment has been confirmed. Check your email for a confirmation with all the details.
        </p>

        {/* Booking reference */}
        <div className="bg-white rounded-lg p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] mb-8">
          <p className="font-sans text-[12px] text-muted mb-1">
            Booking Reference
          </p>
          <p className="font-sans text-[14px] text-charcoal font-semibold break-all">
            {bookingId}
          </p>
        </div>

        <div className="flex flex-col gap-3">
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

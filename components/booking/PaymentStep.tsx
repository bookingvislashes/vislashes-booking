"use client";

import { useState, useCallback, useEffect } from "react";
import { UseFormReturn } from "react-hook-form";
import { BookingFormData } from "@/lib/schemas";
import { SquareCardForm } from "./SquareCardForm";
import { SquareWalletButton } from "./SquareWalletButton";

interface Service {
  id: string;
  name: string;
  price: number;
  deposit_amount: number;
  duration_minutes: number;
}

interface PaymentStepProps {
  form: UseFormReturn<BookingFormData>;
  services: Service[];
  /** True when the page was opened as /book?test=1. See TestBookingButton. */
  testMode?: boolean;
}

export function PaymentStep({ form, services, testMode }: PaymentStepProps) {
  const [error, setError] = useState<string | null>(null);

  const formValues = form.getValues();
  const selectedService = services.find((s) => s.id === formValues.serviceId);

  const depositAmount = selectedService?.deposit_amount ?? 0;

  // These used to setValue("paymentMethod") before navigating away. By then the
  // booking had already been written server-side, so the value never reached
  // the database — the method is now sent with the request instead, by whichever
  // component made it.
  const handlePaymentSuccess = useCallback((bookingId: string) => {
    window.location.href = `/confirmation/${bookingId}`;
  }, []);

  const handleWalletSuccess = useCallback((bookingId: string) => {
    window.location.href = `/confirmation/${bookingId}`;
  }, []);

  const handlePaymentError = useCallback((message: string) => {
    setError(message);
  }, []);

  if (!selectedService) return null;

  const remainingBalance = selectedService.price - depositAmount;

  const formatDuration = (mins: number) => {
    const hrs = Math.floor(mins / 60);
    const m = mins % 60;
    if (hrs && m) return `${hrs} hr ${m} min`;
    if (hrs) return `${hrs} hr`;
    return `${m} min`;
  };

  return (
    <div>
      <h2 className="font-display text-[24px] font-bold text-dark-brown mb-1">
        Payment
      </h2>
      <p className="font-sans text-[14px] text-charcoal mb-6">
        Review your booking and pay the deposit.
      </p>

      {/* Booking summary */}
      <div className="bg-light-tan rounded-surface p-5 mb-6">
        <h3 className="font-display text-[16px] font-bold text-dark-brown mb-3">
          Booking Summary
        </h3>
        <div className="flex flex-col gap-2 font-sans text-[14px]">
          <div className="flex justify-between">
            <span className="text-muted">Service</span>
            <span className="text-charcoal font-semibold">{selectedService.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Date</span>
            <span className="text-charcoal font-semibold">{formValues.bookingDate}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Time</span>
            <span className="text-charcoal font-semibold">{formValues.timeSlot}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Duration</span>
            <span className="text-charcoal font-semibold">
              {formatDuration(selectedService.duration_minutes)}
            </span>
          </div>
          <div className="border-t border-warm-beige/50 my-2" />
          <div className="flex justify-between">
            <span className="text-muted">Total Price</span>
            <span className="text-charcoal font-semibold">
              ${selectedService.price.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Deposit highlight */}
      <div className="bg-white rounded-surface p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] mb-4">
        <p className="font-sans text-[22px] font-bold text-deep-brown text-center">
          ${depositAmount.toFixed(2)} <span className="text-[14px] font-normal text-muted">due today</span>
        </p>
        <p className="font-sans text-[13px] text-muted text-center mt-1">
          Remaining ${remainingBalance.toFixed(2)} due at appointment
        </p>
      </div>

      {/* The cash checkbox that used to sit here is gone. The deposit secures
          the slot and is taken at booking, so offering to settle it on the day
          contradicted the policy — and let anyone hold an appointment without
          paying for it. Cash is still welcome for the balance at the
          appointment itself. */}
      <p className="font-sans text-[14px] text-charcoal text-center mb-5">
        Pay your deposit below to confirm this appointment.
      </p>

      {/* Error message */}
      {error && (
        <div className="bg-danger/10 border border-danger/30 rounded-control p-3 mb-4">
          <p className="font-sans text-[13px] text-danger">
            {error}
          </p>
        </div>
      )}

      {/* Payment buttons */}
      <div className="flex flex-col gap-3">
        {/* Apple Pay / Google Pay first — one tap, no card number to type.
            Each renders only when the browser and device actually support it,
            so this collapses to just the card form elsewhere. */}
        <SquareWalletButton
          depositAmount={depositAmount}
          serviceName={selectedService.name}
          serviceId={selectedService.id}
          formData={formValues as unknown as Record<string, unknown>}
          onSuccess={handleWalletSuccess}
          onError={handlePaymentError}
        />

        {/* Divider */}
        <div className="flex items-center gap-3 my-1">
          <div className="flex-1 h-px bg-light-tan" />
          <span className="font-sans text-[12px] text-muted">
            or pay with card
          </span>
          <div className="flex-1 h-px bg-light-tan" />
        </div>

        {/* Embedded card form */}
        <SquareCardForm
          depositAmount={depositAmount}
          serviceName={selectedService.name}
          serviceId={selectedService.id}
          formData={formValues as unknown as Record<string, unknown>}
          onSuccess={handlePaymentSuccess}
          onError={handlePaymentError}
        />

        <p className="font-sans text-[12px] text-muted text-center mt-1">
          The remaining ${remainingBalance.toFixed(2)} can be paid by cash or
          card at your appointment.
        </p>

        {testMode && (
          <TestBookingButton
            serviceId={selectedService.id}
            form={form}
            onError={handlePaymentError}
          />
        )}
      </div>
    </div>
  );
}

/**
 * The salon's own dry run: book this appointment for real, minus the card.
 *
 * Rendered only when the URL says ?test=1 AND the visitor turns out to be
 * signed in to the admin — the server checks the session again before writing
 * anything, so this is a convenience, not the guard. A client who somehow
 * lands on ?test=1 sees nothing at all.
 */
function TestBookingButton({
  serviceId,
  form,
  onError,
}: {
  serviceId: string;
  form: UseFormReturn<BookingFormData>;
  onError: (message: string) => void;
}) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/api/admin/session")
      .then((res) => (res.ok ? res.json() : { admin: false }))
      .then((data) => {
        if (live) setIsAdmin(Boolean(data.admin));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  if (!isAdmin) return null;

  const run = async () => {
    setBooking(true);
    try {
      const res = await fetch("/api/bookings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId,
          formData: { ...form.getValues(), paymentMethod: "square" },
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        onError(data.message || data.error || "Test booking failed.");
        return;
      }
      window.location.href = `/confirmation/${data.bookingId}`;
    } catch {
      onError("Couldn't reach the server.");
    } finally {
      setBooking(false);
    }
  };

  return (
    <div className="mt-6 rounded-surface border border-dashed border-deep-brown/40 bg-white p-4">
      <p className="font-sans text-[12px] font-semibold uppercase tracking-wider text-deep-brown mb-1">
        Salon test mode
      </p>
      <p className="font-sans text-[13px] text-charcoal mb-3">
        Books this appointment for real and sends every email, without charging
        a card. It holds the time slot until you cancel it in the admin.
      </p>
      <button
        type="button"
        onClick={run}
        disabled={booking}
        className="h-control w-full rounded-control bg-deep-brown px-4 font-sans text-[14px] font-semibold text-white disabled:opacity-60"
      >
        {booking ? "Creating test booking..." : "Book it without paying"}
      </button>
    </div>
  );
}

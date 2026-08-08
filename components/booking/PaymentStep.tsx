"use client";

import { useState, useCallback } from "react";
import { UseFormReturn } from "react-hook-form";
import { BookingFormData } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
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
}

export function PaymentStep({ form, services }: PaymentStepProps) {
  const [loading, setLoading] = useState(false);
  const [isCash, setIsCash] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formValues = form.getValues();
  const selectedService = services.find((s) => s.id === formValues.serviceId);

  const depositAmount = selectedService?.deposit_amount ?? 0;

  const handlePaymentSuccess = useCallback(
    (bookingId: string) => {
      form.setValue("paymentMethod", "square", { shouldValidate: true });
      window.location.href = `/confirmation/${bookingId}`;
    },
    [form]
  );

  const handleWalletSuccess = useCallback(
    (bookingId: string) => {
      form.setValue("paymentMethod", "apple_pay", { shouldValidate: true });
      window.location.href = `/confirmation/${bookingId}`;
    },
    [form]
  );

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

  const handleCashBooking = async () => {
    setLoading(true);
    setError(null);
    form.setValue("paymentMethod", "cash", { shouldValidate: true });
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formValues),
      });
      const data = await res.json();
      if (data.bookingId) {
        window.location.href = `/confirmation/${data.bookingId}`;
      } else {
        setError(data.error || "Failed to create booking. Please try again.");
      }
    } catch (err) {
      console.error("Booking error:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
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
      <div className="bg-light-tan rounded-lg p-5 mb-6">
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
      <div className="bg-white rounded-lg p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] mb-4">
        <p className="font-sans text-[22px] font-bold text-deep-brown text-center">
          ${depositAmount.toFixed(2)} <span className="text-[14px] font-normal text-muted">due today</span>
        </p>
        <p className="font-sans text-[13px] text-muted text-center mt-1">
          Remaining ${remainingBalance.toFixed(2)} due at appointment
        </p>
      </div>

      {/* Cash option */}
      <label className="flex items-center gap-3 cursor-pointer mb-6 p-3 rounded-md border border-light-tan bg-white">
        <input
          type="checkbox"
          className="accent-deep-brown w-4 h-4"
          checked={isCash}
          onChange={(e) => setIsCash(e.target.checked)}
        />
        <span className="font-sans text-[13px] text-charcoal">
          I will bring cash as payment or pay a $3 convenience fee
        </span>
      </label>

      {/* Error message */}
      {error && (
        <div className="bg-danger/10 border border-danger/30 rounded-md p-3 mb-4">
          <p className="font-sans text-[13px] text-danger">
            {error}
          </p>
        </div>
      )}

      {/* Payment buttons */}
      {isCash ? (
        <Button
          type="button"
          onClick={handleCashBooking}
          disabled={loading}
          className="w-full"
        >
          {loading ? "Confirming..." : "Confirm Booking (Cash)"}
        </Button>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Apple Pay / Google Pay */}
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
        </div>
      )}
    </div>
  );
}

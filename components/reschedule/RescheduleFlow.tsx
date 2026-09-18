"use client";

import { useState } from "react";
import { CalendarPicker } from "@/components/booking/CalendarPicker";
import { Button } from "@/components/ui/button";

interface RescheduleFlowProps {
  token: string;
  serviceId: string;
  serviceName: string;
  hasRemoval: boolean;
  currentDate: string;
  currentTime: string;
  firstName: string;
  depositPaid: boolean;
  depositAmount: number;
}

function longDate(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d, 12).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function RescheduleFlow({
  token,
  serviceId,
  serviceName,
  hasRemoval,
  currentDate,
  currentTime,
  firstName,
  depositPaid,
  depositAmount,
}: RescheduleFlowProps) {
  // Starts empty rather than on the current appointment: the calendar is
  // asking "when instead?", and pre-selecting the answer they already have
  // makes the Confirm button look ready when nothing has been chosen.
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [movedTo, setMovedTo] = useState<{ date: string; time: string } | null>(
    null
  );

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, bookingDate: date, timeSlot: time }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(
          data.message ||
            data.error ||
            "Something went wrong. Please try again in a moment."
        );
        // A slot taken while they were deciding is the one error where the
        // calendar behind them is now wrong, so the chosen time is cleared
        // and the list reloads with whatever is actually left.
        if (data.error === "SLOT_TAKEN") setTime("");
        return;
      }

      setMovedTo({ date: data.bookingDate, time: data.timeSlot });
    } catch {
      setError("Couldn't reach the salon. Please check your connection.");
    } finally {
      setSaving(false);
    }
  };

  if (movedTo) {
    return (
      <div className="min-h-[100dvh] bg-cream flex items-center justify-center px-6 py-12">
        <div className="max-w-md w-full bg-white rounded-surface p-6 sm:p-8 shadow-[0_1px_4px_rgba(0,0,0,0.06)] text-center">
          <h1 className="font-display text-[28px] font-bold text-dark-brown mb-2">
            All done{firstName ? `, ${firstName}` : ""}!
          </h1>
          <p className="font-sans text-[15px] text-charcoal mb-6">
            Your appointment has been moved. A new confirmation is on its way to
            your inbox.
          </p>
          <div className="bg-cream rounded-control px-4 py-4">
            <p className="font-sans text-[12px] uppercase tracking-wider text-muted mb-1">
              New date &amp; time
            </p>
            <p className="font-sans text-[17px] font-semibold text-dark-brown">
              {longDate(movedTo.date)} at {movedTo.time}
            </p>
          </div>
          <p className="font-sans text-[13px] text-muted mt-5">
            Can&apos;t wait to see you!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-cream px-6 py-12">
      <div className="max-w-[640px] mx-auto">
        <h1 className="font-display text-[30px] font-bold text-dark-brown mb-2">
          Let&apos;s find you a new time
        </h1>
        <p className="font-sans text-[15px] text-charcoal mb-6">
          {firstName ? `Hi ${firstName}! ` : ""}Pick whatever works better and
          I&apos;ll move everything across for you.
        </p>

        <div className="bg-white rounded-surface p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] mb-6">
          <p className="font-sans text-[12px] uppercase tracking-wider text-muted mb-1">
            Right now you&apos;re booked for
          </p>
          <p className="font-sans text-[16px] font-semibold text-dark-brown">
            {serviceName}
          </p>
          <p className="font-sans text-[15px] text-charcoal">
            {longDate(currentDate)} at {currentTime}
          </p>
          {depositPaid && (
            <p className="font-sans text-[13px] text-muted mt-3">
              Your ${depositAmount.toFixed(2)} deposit comes with you — there
              is nothing to pay again.
            </p>
          )}
        </div>

        <div className="bg-white rounded-surface p-5 sm:p-6 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <CalendarPicker
            serviceId={serviceId}
            hasRemoval={hasRemoval}
            selectedDate={date}
            selectedTime={time}
            onSelect={(nextDate, nextTime) => {
              setDate(nextDate);
              setTime(nextTime);
              setError(null);
            }}
            heading="Choose a new date and time"
            subheading="Only the times I actually have free are shown."
            rescheduleToken={token}
          />
        </div>

        {error && (
          <p className="font-sans text-[14px] text-danger mt-4" role="alert">
            {error}
          </p>
        )}

        <div className="mt-6">
          <Button
            type="button"
            className="w-full"
            disabled={!date || !time || saving}
            onClick={submit}
          >
            {saving
              ? "Moving your appointment..."
              : date && time
                ? `Confirm ${longDate(date)} at ${time}`
                : "Pick a date and time"}
          </Button>
        </div>

        <p className="font-sans text-[13px] text-muted text-center mt-5">
          Changed your mind? Close this page and your original appointment stays
          exactly as it is.
        </p>
      </div>
    </div>
  );
}

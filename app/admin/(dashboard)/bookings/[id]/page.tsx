"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { BookingWithDetails } from "@/lib/supabase/types";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[12px] text-muted font-semibold uppercase tracking-wider mb-1.5 font-sans">
        {title}
      </p>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className="text-charcoal font-medium text-right">{value}</span>
    </div>
  );
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function BookingDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const bookingId = params.id;

  const [booking, setBooking] = useState<BookingWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Reschedule
  const [rescheduling, setRescheduling] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [newSlot, setNewSlot] = useState("");

  // Cancel
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");

  const supabase = createClient();

  const fetchBooking = useCallback(async () => {
    const { data, error } = await supabase
      .from("bookings")
      .select(
        `*, client:clients(*), service:services(*), intake_form:intake_forms(*), agreement:agreements(*)`
      )
      .eq("id", bookingId)
      .maybeSingle();

    if (error || !data) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setBooking({
      ...data,
      client: Array.isArray(data.client) ? data.client[0] : data.client,
      service: Array.isArray(data.service) ? data.service[0] : data.service,
      intake_form: Array.isArray(data.intake_form)
        ? data.intake_form[0] || null
        : data.intake_form,
      agreement: Array.isArray(data.agreement)
        ? data.agreement[0] || null
        : data.agreement,
    } as BookingWithDetails);
    setLoading(false);
  }, [supabase, bookingId]);

  useEffect(() => {
    fetchBooking();
  }, [fetchBooking]);

  // Slots for the chosen reschedule date, from the same endpoint the public
  // booking flow uses — so the admin can never place an appointment in a slot
  // the salon's own hours and buffers would have refused.
  useEffect(() => {
    if (!newDate || !booking?.service?.id) return;
    let cancelled = false;
    setSlotsLoading(true);
    fetch(`/api/availability?date=${newDate}&serviceId=${booking.service.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setSlots(d.slots || []);
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [newDate, booking?.service?.id]);

  const setStatus = async (status: "completed" | "no_show") => {
    if (!booking) return;
    setBusy(true);
    setActionError(null);

    const { error } = await supabase
      .from("bookings")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", booking.id);

    if (error) {
      setActionError(error.message);
      setBusy(false);
      return;
    }

    // Visit history counts appointments actually kept, so it is recorded here
    // rather than when the booking was made.
    if (status === "completed" && booking.client?.id) {
      const { data: c } = await supabase
        .from("clients")
        .select("visit_count")
        .eq("id", booking.client.id)
        .maybeSingle();

      const { error: visitError } = await supabase
        .from("clients")
        .update({
          visit_count: (c?.visit_count ?? 0) + 1,
          last_visit_date: booking.booking_date,
          updated_at: new Date().toISOString(),
        })
        .eq("id", booking.client.id);

      if (visitError) console.error("Failed to record visit:", visitError);
    }

    setBusy(false);
    fetchBooking();
  };

  const runAction = async (body: Record<string, unknown>) => {
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch("/api/admin/booking-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.message || data.error || "Something went wrong.");
        return false;
      }
      return true;
    } catch {
      setActionError("Something went wrong.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div>
        <div className="h-[14px] w-[120px] rounded-control bg-light-tan/60 animate-pulse mb-4" />
        <div className="bg-white rounded-surface p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <div className="h-[18px] w-[45%] rounded-control bg-light-tan/70 animate-pulse" />
          <div className="h-[14px] w-[60%] rounded-control bg-light-tan/50 animate-pulse mt-3" />
        </div>
      </div>
    );
  }

  if (notFound || !booking) {
    return (
      <div>
        <Link
          href="/admin/bookings"
          className="font-sans text-[14px] text-deep-brown font-semibold"
        >
          &larr; All bookings
        </Link>
        <div className="bg-white rounded-surface p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] mt-4">
          <p className="font-sans text-[16px] text-charcoal font-semibold">
            That appointment isn&apos;t here
          </p>
          <p className="font-sans text-[16px] text-muted mt-1">
            It may have been deleted.
          </p>
        </div>
      </div>
    );
  }

  const intake = booking.intake_form;
  const agreement = booking.agreement;

  return (
    <div className="max-w-[640px]">
      <Link
        href="/admin/bookings"
        className="inline-block font-sans text-[14px] text-deep-brown font-semibold mb-4 -m-2 p-2 rounded-control"
      >
        &larr; All bookings
      </Link>

      <div className="flex items-start justify-between gap-3 mb-1">
        <h1 className="font-display text-[28px] font-bold text-dark-brown leading-tight">
          {booking.client?.full_name || "Unknown"}
        </h1>
        <Badge status={booking.status} />
      </div>
      <p className="font-sans text-[16px] text-muted mb-6">
        {booking.service?.name} · {formatDate(booking.booking_date)} at{" "}
        {booking.time_slot}
      </p>

      {actionError && (
        <p
          role="alert"
          className="font-sans text-[16px] text-danger font-semibold mb-4"
        >
          {actionError}
        </p>
      )}

      <div className="bg-white rounded-surface p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex flex-col gap-5 font-sans mb-6">
        <Section title="Client">
          {/* Tappable on a phone: reaching the client is the single most
              common reason to open this screen. */}
          <a
            href={`tel:${booking.client?.phone}`}
            className="block text-[16px] text-deep-brown font-semibold"
          >
            {booking.client?.phone}
          </a>
          <a
            href={`mailto:${booking.client?.email}`}
            className="block text-[16px] text-deep-brown break-all"
          >
            {booking.client?.email}
          </a>
          {booking.client && booking.client.visit_count > 1 && (
            <p className="text-[12px] text-muted mt-1">
              Returning client ({booking.client.visit_count} visits)
            </p>
          )}
        </Section>

        <Section title="Deposit">
          <p className="text-[16px] text-charcoal">
            {booking.deposit_paid ? (
              <span className="text-success font-semibold">
                Paid (${Number(booking.deposit_amount ?? 0).toFixed(2)})
              </span>
            ) : (
              <span className="text-deep-brown font-semibold">Not paid</span>
            )}
            <span className="text-muted"> · via {booking.payment_method}</span>
          </p>
        </Section>

        {intake && (
          <Section title="Intake Answers">
            <div className="grid grid-cols-1 gap-2 text-[16px]">
              <Row
                label="Had extensions before?"
                value={intake.has_had_extensions ? "Yes" : "No"}
              />
              <Row
                label="Special occasion?"
                value={
                  intake.is_special_occasion
                    ? intake.occasion_details || "Yes"
                    : "No"
                }
              />
              {(intake.has_cataracts ||
                intake.has_conjunctivitis ||
                intake.has_dry_eye ||
                intake.has_glaucoma) && (
                <Row
                  label="Medical conditions"
                  value={[
                    intake.has_cataracts && "Cataracts",
                    intake.has_conjunctivitis && "Conjunctivitis",
                    intake.has_dry_eye && "Dry Eye",
                    intake.has_glaucoma && "Glaucoma",
                  ]
                    .filter(Boolean)
                    .join(", ")}
                />
              )}
              {intake.other_complaints && (
                <Row label="Other complaints" value={intake.other_complaints} />
              )}
              {intake.doctor_name && (
                <Row label="Doctor" value={intake.doctor_name} />
              )}
            </div>
          </Section>
        )}

        {agreement && (
          <Section title="Agreements">
            <div className="flex flex-wrap gap-2">
              {agreement.filming_consent && (
                <span className="bg-success/15 text-success text-[12px] px-2 py-0.5 rounded-full font-semibold">
                  Filming OK
                </span>
              )}
              {agreement.liability_waiver_signed && (
                <span className="bg-deep-brown/10 text-deep-brown text-[12px] px-2 py-0.5 rounded-full font-semibold">
                  Waiver Signed
                </span>
              )}
              {agreement.terms_accepted && (
                <span className="bg-deep-brown/10 text-deep-brown text-[12px] px-2 py-0.5 rounded-full font-semibold">
                  Terms Accepted
                </span>
              )}
            </div>
          </Section>
        )}

        {booking.status === "cancelled" && booking.cancellation_reason && (
          <Section title="Cancellation Reason">
            <p className="text-[16px] text-charcoal">
              {booking.cancellation_reason}
            </p>
          </Section>
        )}
      </div>

      {booking.status === "confirmed" && (
        <div className="bg-white rounded-surface p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          {!rescheduling && !cancelling && (
            <div className="flex flex-col gap-2">
              <Button disabled={busy} onClick={() => setStatus("completed")}>
                {busy ? "Working..." : "Mark Complete"}
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  setNewDate(booking.booking_date);
                  setNewSlot("");
                  setRescheduling(true);
                }}
              >
                Reschedule
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => setStatus("no_show")}
              >
                Mark No-Show
              </Button>
              <Button
                variant="danger"
                disabled={busy}
                onClick={() => setCancelling(true)}
              >
                Cancel Appointment
              </Button>
            </div>
          )}

          {rescheduling && (
            <div>
              <h2 className="font-display text-[18px] font-bold text-dark-brown mb-1">
                Move this appointment
              </h2>
              <p className="font-sans text-[13px] text-muted mb-4 max-w-[52ch]">
                Times come from your own hours and buffer, so you can only pick
                a slot that genuinely works. The client is not emailed
                automatically — let her know yourself.
              </p>

              <label
                htmlFor="reschedule-date"
                className="block text-dark-brown text-[12px] font-semibold font-sans mb-1"
              >
                New date
              </label>
              <input
                id="reschedule-date"
                type="date"
                value={newDate}
                onChange={(e) => {
                  setNewDate(e.target.value);
                  setNewSlot("");
                }}
                className="w-full max-w-[240px] h-control box-border bg-white border border-light-tan rounded-control px-3 text-[16px] md:text-[14px] text-charcoal font-sans focus:border-deep-brown transition-colors"
              />

              <p className="text-dark-brown text-[12px] font-semibold font-sans mt-4 mb-2">
                New time
              </p>
              {slotsLoading ? (
                <p className="font-sans text-[14px] text-muted">
                  Loading times...
                </p>
              ) : slots.length === 0 ? (
                <p className="font-sans text-[14px] text-muted">
                  Nothing available that day. Try another date.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {slots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setNewSlot(slot)}
                      className={`h-control box-border inline-flex items-center justify-center px-2 rounded-control text-[13px] font-semibold font-sans border transition-colors ${
                        newSlot === slot
                          ? "bg-deep-brown text-white border-deep-brown"
                          : "bg-white text-charcoal border-light-tan"
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex gap-3 mt-5">
                <Button
                  disabled={busy || !newDate || !newSlot}
                  onClick={async () => {
                    const ok = await runAction({
                      action: "reschedule",
                      bookingId: booking.id,
                      bookingDate: newDate,
                      timeSlot: newSlot,
                    });
                    if (ok) {
                      setRescheduling(false);
                      fetchBooking();
                    }
                  }}
                >
                  {busy ? "Moving..." : "Move Appointment"}
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setRescheduling(false)}
                >
                  Back
                </Button>
              </div>
            </div>
          )}

          {cancelling && (
            <div>
              <h2 className="font-display text-[18px] font-bold text-dark-brown mb-1">
                Cancel this appointment?
              </h2>
              <p className="font-sans text-[13px] text-muted mb-4 max-w-[52ch]">
                The client is emailed to let her know, and the appointment comes
                off your Google Calendar. Any deposit is refunded by you in
                Square — this does not move money.
              </p>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason (optional, for your records)"
                className="w-full h-control box-border bg-white border border-light-tan rounded-control px-3 text-[16px] md:text-[14px] text-charcoal font-sans placeholder:text-muted focus:border-deep-brown transition-colors"
              />
              <div className="flex gap-3 mt-4">
                <Button
                  variant="danger"
                  disabled={busy}
                  onClick={async () => {
                    const ok = await runAction({
                      action: "cancel",
                      bookingId: booking.id,
                      reason: reason || undefined,
                    });
                    if (ok) {
                      setCancelling(false);
                      fetchBooking();
                    }
                  }}
                >
                  {busy ? "Cancelling..." : "Yes, cancel it"}
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setCancelling(false)}
                >
                  Keep it
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {booking.status !== "confirmed" && (
        <p className="font-sans text-[14px] text-muted">
          This appointment is {booking.status.replace("_", " ")}, so there is
          nothing left to change.{" "}
          <button
            type="button"
            onClick={() => router.push("/admin/bookings")}
            className="text-deep-brown font-semibold underline"
          >
            Back to bookings
          </button>
        </p>
      )}
    </div>
  );
}

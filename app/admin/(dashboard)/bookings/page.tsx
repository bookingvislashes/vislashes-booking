"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { BookingWithDetails } from "@/lib/supabase/types";

type BookingStatus = "confirmed" | "completed" | "cancelled" | "no_show";

export default function BookingsPage() {
  const [statusFilter, setStatusFilter] = useState<BookingStatus | "all">("all");
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<BookingWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const supabase = createClient();

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("bookings")
      .select(`
        *,
        client:clients(*),
        service:services(*),
        intake_form:intake_forms(*),
        agreement:agreements(*)
      `)
      .order("booking_date", { ascending: false })
      .order("time_slot", { ascending: false });

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Failed to fetch bookings:", error);
    } else {
      // Supabase returns arrays for one-to-many joins, flatten to single objects
      const mapped = (data || []).map((b) => ({
        ...b,
        client: Array.isArray(b.client) ? b.client[0] : b.client,
        service: Array.isArray(b.service) ? b.service[0] : b.service,
        intake_form: Array.isArray(b.intake_form) ? b.intake_form[0] || null : b.intake_form,
        agreement: Array.isArray(b.agreement) ? b.agreement[0] || null : b.agreement,
      })) as BookingWithDetails[];
      setBookings(mapped);
    }
    setLoading(false);
  }, [supabase, statusFilter]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // The slide-over is dismissable by clicking the scrim, which keyboard users
  // cannot do. Escape gives them the same exit.
  useEffect(() => {
    if (!selectedBooking) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedBooking(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selectedBooking]);

  // Realtime subscription for live updates
  useEffect(() => {
    const channel = supabase
      .channel("bookings-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        () => {
          fetchBookings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchBookings]);

  const updateStatus = async (bookingId: string, newStatus: BookingStatus) => {
    setUpdating(true);
    const { error } = await supabase
      .from("bookings")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", bookingId);

    if (error) {
      console.error("Failed to update booking:", error);
    } else {
      setSelectedBooking(null);
      fetchBookings();
    }
    setUpdating(false);
  };

  const formatDate = (date: string) => {
    return new Date(date + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-[28px] font-bold text-dark-brown">
          Bookings
        </h1>
        <span className="font-sans text-[16px] text-muted">
          {bookings.length} total
        </span>
      </div>

      {/* Filters */}
      {/* `shrink-0` on the chips is what makes `overflow-x-auto` mean anything.
          Without it flex shrank all five chips to fit a narrow screen and the
          row never became scrollable. */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
        {(["all", "confirmed", "completed", "cancelled", "no_show"] as const).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`h-[32px] shrink-0 box-border inline-flex items-center justify-center px-4 rounded-full text-[12px] font-semibold font-sans whitespace-nowrap transition-colors ${
              statusFilter === status
                ? "bg-deep-brown text-white"
                : "bg-white text-charcoal border border-light-tan hover:bg-light-tan"
            }`}
          >
            {status === "all"
              ? "All"
              : status === "no_show"
              ? "No Show"
              : status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Bookings list */}
      <div className="bg-white rounded-surface shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
        {loading ? (
          <div className="p-8 text-center">
            <p className="font-sans text-[16px] text-muted animate-pulse">
              Loading bookings...
            </p>
          </div>
        ) : bookings.length === 0 ? (
          <div className="p-8 text-center">
            <p className="font-sans text-[16px] text-muted">
              No bookings found
            </p>
          </div>
        ) : (
          bookings.map((booking) => (
            <button
              key={booking.id}
              onClick={() => setSelectedBooking(booking)}
              className="w-full flex items-center justify-between px-4 sm:px-5 py-4 border-b border-light-tan last:border-b-0 hover:bg-cream/50 transition-colors text-left cursor-pointer"
            >
              <div className="min-w-0 flex-1">
                <p className="font-sans text-[16px] font-semibold text-dark-brown truncate">
                  {booking.client?.full_name || "Unknown"}
                </p>
                <p className="font-sans text-[16px] text-muted truncate">
                  {booking.service?.name || "Unknown Service"}
                </p>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 text-right shrink-0 ml-3">
                <div>
                  <p className="font-sans text-[16px] text-charcoal font-semibold">
                    {booking.time_slot}
                  </p>
                  <p className="font-sans text-[12px] text-muted">
                    {formatDate(booking.booking_date)}
                  </p>
                </div>
                <Badge status={booking.status} />
              </div>
            </button>
          ))
        )}
      </div>

      {/* Booking detail panel (slide-over) */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setSelectedBooking(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Booking details"
            className="relative bg-white w-full max-w-md h-full overflow-y-auto p-5 sm:p-6 shadow-xl"
          >
            <button
              onClick={() => setSelectedBooking(null)}
              aria-label="Close booking details"
              className="absolute top-4 right-4 text-muted hover:text-charcoal text-xl"
            >
              &times;
            </button>

            <h2 className="font-display text-[18px] font-bold text-dark-brown mb-5">
              Booking Details
            </h2>

            <div className="flex flex-col gap-5 font-sans">
              {/* Client info */}
              <Section title="Client">
                <p className="text-[16px] text-charcoal font-semibold">
                  {selectedBooking.client?.full_name}
                </p>
                <p className="text-[16px] text-muted">{selectedBooking.client?.email}</p>
                <p className="text-[16px] text-muted">{selectedBooking.client?.phone}</p>
                {selectedBooking.client && selectedBooking.client.visit_count > 1 && (
                  <p className="text-[12px] text-deep-brown mt-1">
                    Returning client ({selectedBooking.client.visit_count} visits)
                  </p>
                )}
              </Section>

              {/* Service info */}
              <Section title="Service">
                <p className="text-[16px] text-charcoal font-semibold">
                  {selectedBooking.service?.name}
                </p>
                <p className="text-[16px] text-muted">
                  ${selectedBooking.service?.price?.toFixed(2)} &middot;{" "}
                  {selectedBooking.service?.duration_minutes} min
                </p>
              </Section>

              {/* Date & time */}
              <Section title="Date & Time">
                <p className="text-[16px] text-charcoal">
                  {formatDate(selectedBooking.booking_date)} at {selectedBooking.time_slot}
                </p>
              </Section>

              {/* Status & payment */}
              <div className="flex gap-6">
                <div className="flex-1">
                  <SectionTitle>Status</SectionTitle>
                  <Badge status={selectedBooking.status} />
                </div>
                <div className="flex-1">
                  <SectionTitle>Deposit</SectionTitle>
                  <p className="text-[16px] text-charcoal">
                    {selectedBooking.deposit_paid ? (
                      <span className="text-success font-semibold">
                        Paid (${selectedBooking.deposit_amount?.toFixed(2)})
                      </span>
                    ) : (
                      // `text-warning` compiled to nothing — there is no
                      // --color-warning token and Tailwind has no stock one —
                      // so unpaid rendered in the same charcoal as body copy
                      // while its paid sibling above went green. deep-brown is
                      // the palette's existing "needs attention, not failed".
                      <span className="text-deep-brown font-semibold">Pending (Cash)</span>
                    )}
                  </p>
                  <p className="text-[12px] text-muted mt-0.5">
                    via {selectedBooking.payment_method}
                  </p>
                </div>
              </div>

              {/* Intake form */}
              {selectedBooking.intake_form && (
                <Section title="Intake Answers">
                  <div className="grid grid-cols-1 gap-2 text-[16px]">
                    <Row
                      label="Had extensions before?"
                      value={selectedBooking.intake_form.has_had_extensions ? "Yes" : "No"}
                    />
                    <Row
                      label="Special occasion?"
                      value={
                        selectedBooking.intake_form.is_special_occasion
                          ? selectedBooking.intake_form.occasion_details || "Yes"
                          : "No"
                      }
                    />
                    {/* Medical */}
                    {(selectedBooking.intake_form.has_cataracts ||
                      selectedBooking.intake_form.has_conjunctivitis ||
                      selectedBooking.intake_form.has_dry_eye ||
                      selectedBooking.intake_form.has_glaucoma) && (
                      <Row
                        label="Medical conditions"
                        value={[
                          selectedBooking.intake_form.has_cataracts && "Cataracts",
                          selectedBooking.intake_form.has_conjunctivitis && "Conjunctivitis",
                          selectedBooking.intake_form.has_dry_eye && "Dry Eye",
                          selectedBooking.intake_form.has_glaucoma && "Glaucoma",
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      />
                    )}
                    {selectedBooking.intake_form.other_complaints && (
                      <Row
                        label="Other complaints"
                        value={selectedBooking.intake_form.other_complaints}
                      />
                    )}
                    {selectedBooking.intake_form.doctor_name && (
                      <Row label="Doctor" value={selectedBooking.intake_form.doctor_name} />
                    )}
                  </div>
                </Section>
              )}

              {/* Agreement */}
              {selectedBooking.agreement && (
                <Section title="Agreements">
                  <div className="flex flex-wrap gap-2 mb-3">
                    {selectedBooking.agreement.filming_consent && (
                      <span className="bg-success/15 text-success text-[12px] px-2 py-0.5 rounded-full font-semibold">
                        Filming OK
                      </span>
                    )}
                    {selectedBooking.agreement.liability_waiver_signed && (
                      <span className="bg-deep-brown/10 text-deep-brown text-[12px] px-2 py-0.5 rounded-full font-semibold">
                        Waiver Signed
                      </span>
                    )}
                    {selectedBooking.agreement.terms_accepted && (
                      <span className="bg-deep-brown/10 text-deep-brown text-[12px] px-2 py-0.5 rounded-full font-semibold">
                        Terms Accepted
                      </span>
                    )}
                  </div>
                  {/* Signature preview */}
                  {selectedBooking.agreement.signature_data && (
                    <div>
                      <p className="text-[12px] text-muted mb-1">Signature</p>
                      <div className="bg-cream rounded-control p-2 inline-block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={selectedBooking.agreement.signature_data}
                          alt="Client signature"
                          className="h-[60px] w-auto"
                        />
                      </div>
                    </div>
                  )}
                </Section>
              )}

              {/* Action buttons */}
              {selectedBooking.status === "confirmed" && (
                <div className="border-t border-light-tan pt-4 mt-1 flex flex-col gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={updating}
                    onClick={() => updateStatus(selectedBooking.id, "completed")}
                  >
                    {updating ? "Updating..." : "Mark Complete"}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={updating}
                    onClick={() => updateStatus(selectedBooking.id, "no_show")}
                  >
                    Mark No-Show
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={updating}
                    onClick={() => updateStatus(selectedBooking.id, "cancelled")}
                  >
                    Cancel Booking
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper components
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <SectionTitle>{title}</SectionTitle>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12px] text-muted font-semibold uppercase tracking-wider mb-1.5 font-sans">
      {children}
    </p>
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

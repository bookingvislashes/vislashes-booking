"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import type { BookingWithDetails } from "@/lib/supabase/types";

type BookingStatus = "confirmed" | "completed" | "cancelled" | "no_show";

export default function BookingsPage() {
  const [statusFilter, setStatusFilter] = useState<BookingStatus | "all">("all");
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
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
            <Link
              key={booking.id}
              href={`/admin/bookings/${booking.id}`}
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
            </Link>
          ))
        )}
      </div>

    </div>
  );
}

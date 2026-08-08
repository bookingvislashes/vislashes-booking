"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface TodayBooking {
  id: string;
  time_slot: string;
  status: "confirmed" | "completed" | "cancelled" | "no_show";
  client: { full_name: string } | null;
  service: { name: string } | null;
}

export default function AdminDashboard() {
  const [todaysBookings, setTodaysBookings] = useState<TodayBooking[]>([]);
  const [monthCount, setMonthCount] = useState(0);
  const [clientCount, setClientCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();
  const today = new Date().toISOString().split("T")[0];
  const monthStart = `${today.slice(0, 7)}-01`;

  const fetchStats = useCallback(async () => {
    setLoading(true);

    // Today's bookings
    const { data: todayData } = await supabase
      .from("bookings")
      .select("id, time_slot, status, client:clients(full_name), service:services(name)")
      .eq("booking_date", today)
      .in("status", ["confirmed", "completed"])
      .order("time_slot", { ascending: true });

    const mapped = (todayData || []).map((b) => ({
      ...b,
      client: Array.isArray(b.client) ? b.client[0] : b.client,
      service: Array.isArray(b.service) ? b.service[0] : b.service,
    })) as TodayBooking[];
    setTodaysBookings(mapped);

    // This month's booking count
    const { count: mCount } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .gte("booking_date", monthStart)
      .in("status", ["confirmed", "completed"]);
    setMonthCount(mCount || 0);

    // Total clients
    const { count: cCount } = await supabase
      .from("clients")
      .select("id", { count: "exact", head: true });
    setClientCount(cCount || 0);

    setLoading(false);
  }, [supabase, today, monthStart]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Realtime updates
  useEffect(() => {
    const channel = supabase
      .channel("dashboard-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        () => {
          fetchStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchStats]);

  return (
    <div>
      <h1 className="font-display text-[28px] font-bold text-dark-brown mb-6">
        Dashboard
      </h1>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-surface p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <p className="font-sans text-[12px] text-muted font-semibold uppercase tracking-wider mb-1">
            Today&apos;s Bookings
          </p>
          <p className="font-display text-[32px] font-bold text-dark-brown">
            {loading ? "—" : todaysBookings.length}
          </p>
        </div>
        <div className="bg-white rounded-surface p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <p className="font-sans text-[12px] text-muted font-semibold uppercase tracking-wider mb-1">
            This Month
          </p>
          <p className="font-display text-[32px] font-bold text-dark-brown">
            {loading ? "—" : monthCount}
          </p>
        </div>
        <div className="bg-white rounded-surface p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <p className="font-sans text-[12px] text-muted font-semibold uppercase tracking-wider mb-1">
            Total Clients
          </p>
          <p className="font-display text-[32px] font-bold text-dark-brown">
            {loading ? "—" : clientCount}
          </p>
        </div>
      </div>

      {/* Today's schedule */}
      <div className="bg-white rounded-surface shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between p-5 border-b border-light-tan">
          <h2 className="font-display text-[18px] font-bold text-dark-brown">
            Today&apos;s Schedule
          </h2>
          <Link
            href="/admin/bookings"
            className="font-sans text-[13px] text-deep-brown font-semibold hover:underline"
          >
            View All
          </Link>
        </div>

        {loading ? (
          <div className="p-5 text-center">
            <p className="font-sans text-[14px] text-muted animate-pulse">
              Loading...
            </p>
          </div>
        ) : todaysBookings.length === 0 ? (
          <div className="p-5 text-center">
            <p className="font-sans text-[14px] text-muted">
              No bookings today
            </p>
          </div>
        ) : (
          <div>
            {todaysBookings.map((booking) => (
              <div
                key={booking.id}
                className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-light-tan last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-sans text-[14px] font-semibold text-dark-brown truncate">
                    {booking.client?.full_name || "Unknown"}
                  </p>
                  <p className="font-sans text-[13px] text-muted truncate">
                    {booking.service?.name || "Unknown"}
                  </p>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-3">
                  <span className="font-sans text-[13px] text-charcoal font-semibold">
                    {booking.time_slot}
                  </span>
                  <Badge status={booking.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

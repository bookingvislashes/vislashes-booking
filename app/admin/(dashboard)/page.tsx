"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRegisterRefresh } from "@/components/admin/RefreshProvider";
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

interface WeekBooking extends TodayBooking {
  booking_date: string;
}

interface Stats {
  today: TodayBooking[];
  /** The next seven days after today, so the week is visible on a phone. */
  week: WeekBooking[];
  monthCount: number;
  clientCount: number;
  /**
   * Card payments with no booking behind them. Surfaced here rather than only
   * on /admin/payments because the phone's bottom nav stops at five items and
   * never reaches that page — an alert nobody can see is not an alert.
   */
  orphanCount: number;
}

/** Entrance stagger. Index-driven so rows cascade instead of popping at once. */
function stagger(index: number): React.CSSProperties {
  return { animationDelay: `${index * 70}ms` };
}

function StatCard({
  label,
  value,
  loading,
  index,
  emphasis = false,
}: {
  label: string;
  value: number;
  loading: boolean;
  index: number;
  emphasis?: boolean;
}) {
  return (
    <div
      style={stagger(index)}
      className="animate-fade-in-up bg-white rounded-surface p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
    >
      <p className="font-sans text-[12px] text-muted font-semibold uppercase tracking-wider mb-1">
        {label}
      </p>
      {loading ? (
        // Sized to the digits it replaces, so nothing shifts when data lands.
        <div
          className={`${
            emphasis ? "h-[44px] w-[72px]" : "h-[38px] w-[56px]"
          } rounded-control bg-light-tan/70 animate-pulse`}
        />
      ) : (
        <p
          className={`font-display font-bold text-dark-brown tabular-nums leading-none ${
            emphasis ? "text-[44px]" : "text-[32px]"
          }`}
        >
          {value}
        </p>
      )}
    </div>
  );
}

function ScheduleSkeleton() {
  return (
    <div>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={stagger(i)}
          className="animate-fade-in-up flex items-center justify-between px-4 sm:px-5 py-4 border-b border-light-tan last:border-b-0"
        >
          <div className="flex-1 min-w-0">
            <div className="h-[14px] w-[46%] rounded-control bg-light-tan/70 animate-pulse" />
            <div className="h-[12px] w-[30%] rounded-control bg-light-tan/50 animate-pulse mt-2" />
          </div>
          <div className="h-[22px] w-[64px] rounded-control bg-light-tan/60 animate-pulse shrink-0 ml-3" />
        </div>
      ))}
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    today: [],
    week: [],
    monthCount: 0,
    clientCount: 0,
    orphanCount: 0,
  });
  // Starts true and is only ever cleared. Refreshes triggered by realtime
  // update in place — flipping back to a loading state on every change made
  // the panel flicker while the salon was reading it.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();
  // Formatted in the salon's timezone, not UTC. toISOString() rolls over at
  // 8pm Eastern, so from then until midnight "Today's Bookings" was showing
  // tomorrow's appointments — every evening.
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const monthStart = `${today.slice(0, 7)}-01`;
  const weekEnd = (() => {
    const [y, m, d] = today.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d + 7)).toISOString().slice(0, 10);
  })();

  const fetchStats = useCallback(async () => {
    const [todayRes, weekRes, monthRes, clientRes, orphanRes] = await Promise.all([
      supabase
        .from("bookings")
        .select(
          "id, time_slot, status, client:clients(full_name), service:services(name)"
        )
        .eq("booking_date", today)
        .in("status", ["confirmed", "completed"])
        .order("time_slot", { ascending: true }),
      supabase
        .from("bookings")
        .select(
          "id, booking_date, time_slot, status, client:clients(full_name), service:services(name)"
        )
        .gt("booking_date", today)
        .lte("booking_date", weekEnd)
        .in("status", ["confirmed", "completed"])
        .order("booking_date", { ascending: true })
        .order("time_slot", { ascending: true }),
      supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .gte("booking_date", monthStart)
        .in("status", ["confirmed", "completed"]),
      supabase.from("clients").select("id", { count: "exact", head: true }),
      supabase
        .from("orphan_payments")
        .select("id", { count: "exact", head: true })
        .eq("resolved", false),
    ]);

    // These errors were being discarded, so a failed query was indistinguishable
    // from a genuinely empty day — the worst possible confusion for someone
    // deciding whether to expect a client.
    // orphanRes is deliberately absent from this check. It is a secondary
    // alert, and a deployment whose database has not had 005 applied yet
    // would otherwise show "couldn't load today's numbers" and no schedule at
    // all — breaking the screen she actually runs her day from over a panel
    // that is empty on a healthy salon anyway.
    const failure = todayRes.error || monthRes.error || clientRes.error;
    if (failure) {
      setError(failure.message);
      setLoading(false);
      return;
    }

    const mapped = (todayRes.data || []).map((b) => ({
      ...b,
      client: Array.isArray(b.client) ? b.client[0] : b.client,
      service: Array.isArray(b.service) ? b.service[0] : b.service,
    })) as TodayBooking[];

    const weekMapped = (weekRes.data || []).map((b) => ({
      ...b,
      client: Array.isArray(b.client) ? b.client[0] : b.client,
      service: Array.isArray(b.service) ? b.service[0] : b.service,
    })) as WeekBooking[];

    setError(null);
    setStats({
      today: mapped,
      week: weekRes.error ? [] : weekMapped,
      monthCount: monthRes.count || 0,
      clientCount: clientRes.count || 0,
      orphanCount: orphanRes.error ? 0 : orphanRes.count || 0,
    });
    setLoading(false);
  }, [supabase, today, monthStart, weekEnd]);

  // Pull-to-refresh, the header control and coming back to the
  // app all re-run this screen's own fetch.
  useRegisterRefresh(fetchStats);

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

  // Seven fixed day buckets rather than grouping whatever came back, so a day
  // with nothing booked still gets a row. An empty Thursday is information.
  const nextSevenDays = useMemo(() => {
    const [y, m, d] = today.split("-").map(Number);
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(Date.UTC(y, m - 1, d + i + 1));
      const iso = date.toISOString().slice(0, 10);
      return {
        date: iso,
        label: date.toLocaleDateString("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        }),
        bookings: stats.week.filter((b) => b.booking_date === iso),
      };
    });
  }, [today, stats.week]);

  const heading = new Date(`${today}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-[28px] font-bold text-dark-brown leading-tight">
          Dashboard
        </h1>
        <p className="font-sans text-[16px] text-muted mt-0.5">{heading}</p>
      </div>

      {error && (
        <div
          role="alert"
          className="animate-fade-in-up bg-white border border-danger/30 rounded-surface p-4 mb-6"
        >
          <p className="font-sans text-[16px] text-danger font-semibold">
            Couldn&apos;t load today&apos;s numbers
          </p>
          <p className="font-sans text-[16px] text-muted mt-1 leading-[1.5]">
            {error}
          </p>
          <button
            onClick={() => {
              setLoading(true);
              setError(null);
              fetchStats();
            }}
            className="mt-3 h-control px-4 inline-flex items-center bg-deep-brown text-white font-sans font-semibold text-[16px] rounded-control transition-transform active:scale-[0.97] cursor-pointer"
          >
            Try again
          </button>
        </div>
      )}

      {stats.orphanCount > 0 && (
        <Link
          href="/admin/payments"
          className="animate-fade-in-up block bg-white border border-danger/30 rounded-surface p-4 mb-6 transition-transform active:scale-[0.99]"
        >
          <p className="font-sans text-[16px] text-danger font-semibold">
            {stats.orphanCount === 1
              ? "1 payment needs review"
              : `${stats.orphanCount} payments need review`}
          </p>
          <p className="font-sans text-[16px] text-muted mt-1 leading-[1.5]">
            A card was charged without a booking being saved. Tap to see the
            details.
          </p>
        </Link>
      )}

      {/* Today leads, so it carries more weight than the two reference figures
          beside it. Collapses to a single column well before the numbers would
          start to crowd. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr] gap-4 mb-8">
        <StatCard
          label="Today's Bookings"
          value={stats.today.length}
          loading={loading}
          index={0}
          emphasis
        />
        <StatCard
          label="This Month"
          value={stats.monthCount}
          loading={loading}
          index={1}
        />
        <StatCard
          label="Total Clients"
          value={stats.clientCount}
          loading={loading}
          index={2}
        />
      </div>

      {/* Today's schedule */}
      <div
        style={stagger(3)}
        className="animate-fade-in-up bg-white rounded-surface shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden"
      >
        <div className="flex items-center justify-between p-5 border-b border-light-tan">
          <h2 className="font-display text-[18px] font-bold text-dark-brown">
            Today&apos;s Schedule
          </h2>
          <Link
            href="/admin/bookings"
            className="font-sans text-[16px] text-deep-brown font-semibold hover:underline -m-2 p-2 rounded-control transition-transform active:scale-[0.97]"
          >
            View All
          </Link>
        </div>

        {loading ? (
          <ScheduleSkeleton />
        ) : stats.today.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <div
              aria-hidden="true"
              className="w-10 h-10 rounded-full bg-light-tan/60 mx-auto mb-3 flex items-center justify-center"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-muted"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            </div>
            <p className="font-sans text-[16px] text-charcoal font-semibold">
              Nothing booked today
            </p>
            <p className="font-sans text-[16px] text-muted mt-1">
              New bookings appear here the moment they come in.
            </p>
          </div>
        ) : (
          <div>
            {stats.today.map((booking, i) => (
              <Link
                key={booking.id}
                href={`/admin/bookings/${booking.id}`}
                style={stagger(i)}
                className="animate-fade-in-up flex items-center justify-between px-4 sm:px-5 py-4 border-b border-light-tan last:border-b-0 hover:bg-cream/50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-sans text-[16px] font-semibold text-dark-brown truncate">
                    {booking.client?.full_name || "Unknown"}
                  </p>
                  <p className="font-sans text-[16px] text-muted truncate">
                    {booking.service?.name || "Unknown"}
                  </p>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-3">
                  <span className="font-sans text-[16px] text-charcoal font-semibold tabular-nums">
                    {booking.time_slot}
                  </span>
                  <Badge status={booking.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* The week ahead. The phone had no way to see past today — the only
          other schedule view is the bookings list, which is a flat reverse
          chronological feed rather than something you can read a week off. */}
      <div
        style={stagger(4)}
        className="animate-fade-in-up bg-white rounded-surface shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden mt-6"
      >
        <div className="p-5 border-b border-light-tan">
          <h2 className="font-display text-[18px] font-bold text-dark-brown">
            Next 7 Days
          </h2>
        </div>

        {loading ? (
          <ScheduleSkeleton />
        ) : (
          <div>
            {nextSevenDays.map((day) => (
              <div
                key={day.date}
                className="border-b border-light-tan last:border-b-0"
              >
                <div className="flex items-baseline justify-between gap-3 px-4 sm:px-5 pt-3 pb-1">
                  <p className="font-sans text-[12px] font-semibold text-muted uppercase tracking-wider">
                    {day.label}
                  </p>
                  {day.bookings.length > 0 && (
                    <span className="font-sans text-[12px] text-muted tabular-nums">
                      {day.bookings.length}
                    </span>
                  )}
                </div>

                {day.bookings.length === 0 ? (
                  /* Free days are shown rather than skipped: knowing which
                     days are open is as useful as knowing which are full. */
                  <p className="px-4 sm:px-5 pb-3 font-sans text-[16px] text-muted/70">
                    Nothing booked
                  </p>
                ) : (
                  <div className="pb-1">
                    {day.bookings.map((booking) => (
                      <Link
                        key={booking.id}
                        href={`/admin/bookings/${booking.id}`}
                        className="flex items-center justify-between gap-3 px-4 sm:px-5 py-2.5 hover:bg-cream/50 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-sans text-[16px] font-semibold text-dark-brown truncate">
                            {booking.client?.full_name || "Unknown"}
                          </p>
                          <p className="font-sans text-[16px] text-muted truncate">
                            {booking.service?.name || "Unknown"}
                          </p>
                        </div>
                        <span className="font-sans text-[16px] text-charcoal font-semibold tabular-nums shrink-0">
                          {booking.time_slot}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

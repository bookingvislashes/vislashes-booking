"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRegisterRefresh } from "@/components/admin/RefreshProvider";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { todayISO, addDays, fromISO, slotToMinutes } from "@/lib/schedule";

/**
 * Bookings — the diary, not the archive.
 *
 * It opens on what is still to come, soonest first, because that is the only
 * question this screen is ever opened to answer: who is coming in, and when.
 * Everything that is already settled — completed, cancelled, a no-show — is
 * still one tap away on its own tab, just no longer mixed into the list she
 * reads every morning.
 *
 * Ordering is done here rather than in the query on purpose. `time_slot` is
 * text in a 12-hour format, so `order("time_slot")` sorts it alphabetically
 * and puts 10:00 AM before 9:00 AM — every multi-appointment day came back
 * scrambled. `slotToMinutes` is what makes the order real.
 */

type BookingStatus = "confirmed" | "completed" | "cancelled" | "no_show";

type View = "upcoming" | "past" | "completed" | "cancelled" | "no_show" | "all";

interface Row {
  id: string;
  booking_date: string;
  time_slot: string;
  status: BookingStatus;
  deposit_paid: boolean;
  client_name: string;
  service_name: string;
}

const VIEWS: {
  value: View;
  label: string;
  /** Shown under the tabs when the tab's meaning isn't obvious from its name. */
  blurb?: string;
  empty: string;
}[] = [
  {
    value: "upcoming",
    label: "Upcoming",
    empty: "Nothing on the books. New bookings land here the moment they come in.",
  },
  {
    value: "past",
    label: "Past",
    blurb:
      "Appointments that have already been and gone but are still marked confirmed. Open one to mark it completed or a no-show.",
    empty: "Nothing waiting — every past appointment has been closed out.",
  },
  { value: "completed", label: "Completed", empty: "No completed appointments yet." },
  { value: "cancelled", label: "Cancelled", empty: "No cancelled appointments." },
  { value: "no_show", label: "No show", empty: "No no-shows." },
  { value: "all", label: "All", empty: "No bookings yet." },
];

/** Chronological, earliest first. Used forwards and reversed. */
function chrono(a: Row, b: Row) {
  if (a.booking_date !== b.booking_date) {
    return a.booking_date < b.booking_date ? -1 : 1;
  }
  return (slotToMinutes(a.time_slot) ?? 0) - (slotToMinutes(b.time_slot) ?? 0);
}

const soonestFirst = chrono;
const newestFirst = (a: Row, b: Row) => chrono(b, a);

/** Consecutive runs of the same date, so the list can break into day sections. */
function groupByDay(rows: Row[]) {
  const groups: { date: string; rows: Row[] }[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last.date === row.booking_date) last.rows.push(row);
    else groups.push({ date: row.booking_date, rows: [row] });
  }
  return groups;
}

function fullDate(date: string) {
  return fromISO(date).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** "Today" / "Tomorrow" / "Yesterday", or null for every other date. */
function relativeDay(date: string, today: string) {
  if (date === today) return "Today";
  if (date === addDays(today, 1)) return "Tomorrow";
  if (date === addDays(today, -1)) return "Yesterday";
  return null;
}

/** "10:00 AM" split so the hour can sit on a tabular rail and the AM/PM under it. */
function splitSlot(slot: string) {
  const match = /^(\d{1,2}:\d{2})\s*(AM|PM)$/i.exec(slot.trim());
  if (!match) return { time: slot, period: "" };
  return { time: match[1], period: match[2].toUpperCase() };
}

function Chevron() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-muted/60 shrink-0"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

export default function BookingsPage() {
  const [view, setView] = useState<View>("upcoming");
  const [bookings, setBookings] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const today = todayISO();

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    // Only the columns this list draws. It used to pull `*` plus the whole
    // intake form and agreement for every row and render none of it, which is
    // the bulk of the payload on a page that shows a name, a service and a time.
    const { data, error: queryError } = await supabase
      .from("bookings")
      .select(
        "id, booking_date, time_slot, status, deposit_paid, client:clients(full_name), service:services(name)"
      )
      .order("booking_date", { ascending: false });

    if (queryError) {
      console.error("Failed to fetch bookings:", queryError);
      setError("Couldn't load bookings. Pull down to try again.");
      setLoading(false);
      return;
    }

    type Joined = {
      id: string;
      booking_date: string;
      time_slot: string;
      status: BookingStatus;
      deposit_paid: boolean;
      client: { full_name: string } | { full_name: string }[] | null;
      service: { name: string } | { name: string }[] | null;
    };

    // Supabase returns arrays for one-to-many joins, flatten to single objects
    const mapped = ((data ?? []) as Joined[]).map((b) => {
      const client = Array.isArray(b.client) ? b.client[0] : b.client;
      const service = Array.isArray(b.service) ? b.service[0] : b.service;
      return {
        id: b.id,
        booking_date: b.booking_date,
        time_slot: b.time_slot,
        status: b.status,
        deposit_paid: b.deposit_paid,
        client_name: client?.full_name ?? "Unknown",
        service_name: service?.name ?? "Unknown service",
      };
    });

    setBookings(mapped);
    setError(null);
    setLoading(false);
  }, [supabase]);

  // Pull-to-refresh, the header control and coming back to the
  // app all re-run this screen's own fetch.
  useRegisterRefresh(fetchBookings);

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

  // Every tab is derived from the one fetch, so switching between them is
  // instant and each tab can carry its own count.
  const buckets = useMemo(() => {
    const confirmed = bookings.filter((b) => b.status === "confirmed");
    return {
      // Today counts as upcoming for the whole day — an appointment at 10am is
      // still hers to deal with at 2pm.
      upcoming: confirmed
        .filter((b) => b.booking_date >= today)
        .sort(soonestFirst),
      // Been and gone, never closed out. Left in the main list these read as
      // upcoming forever; on their own tab they read as a to-do.
      past: confirmed.filter((b) => b.booking_date < today).sort(newestFirst),
      completed: bookings.filter((b) => b.status === "completed").sort(newestFirst),
      cancelled: bookings.filter((b) => b.status === "cancelled").sort(newestFirst),
      no_show: bookings.filter((b) => b.status === "no_show").sort(newestFirst),
      all: [...bookings].sort(newestFirst),
    };
  }, [bookings, today]);

  const active = VIEWS.find((v) => v.value === view) ?? VIEWS[0];
  const rows = buckets[view];
  const days = useMemo(() => groupByDay(rows), [rows]);

  const next = buckets.upcoming[0];
  const subtitle =
    view === "upcoming"
      ? next
        ? `Next up: ${relativeDay(next.booking_date, today) ?? fullDate(next.booking_date)} at ${next.time_slot}`
        : "Nothing on the books"
      : `${rows.length} ${rows.length === 1 ? "appointment" : "appointments"}`;

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="min-w-0">
          <h1 className="font-display text-[28px] font-bold text-dark-brown">
            Bookings
          </h1>
          <p className="font-sans text-[13px] text-muted">{subtitle}</p>
        </div>
        {/* Booking someone in herself is a normal part of the day — a deposit
            Zelled at the end of an appointment, an enquiry in the DMs — so it
            starts from the list of bookings rather than being buried. */}
        <Link
          href="/admin/bookings/new"
          className="shrink-0 inline-flex items-center justify-center box-border h-control px-5 rounded-control border-2 border-transparent bg-text-brown text-white font-sans text-[14px] font-semibold hover:bg-deep-brown transition-colors"
        >
          + New
        </Link>
      </div>

      {/* Tabs. `shrink-0` on the chips is what makes `overflow-x-auto` mean
          anything — without it flex shrank them all to fit a narrow screen and
          the row never became scrollable. The negative margin lets the row
          scroll edge to edge on a phone instead of stopping inside the page
          padding, which is what makes it read as scrollable. */}
      <div
        role="tablist"
        aria-label="Filter bookings"
        className="flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0"
      >
        {VIEWS.map((v) => {
          const selected = view === v.value;
          const count = buckets[v.value].length;
          return (
            <button
              key={v.value}
              role="tab"
              aria-selected={selected}
              onClick={() => setView(v.value)}
              className={`h-[34px] shrink-0 box-border inline-flex items-center gap-1.5 justify-center px-4 rounded-full text-[12px] font-semibold font-sans whitespace-nowrap transition-colors ${
                selected
                  ? "bg-deep-brown text-white"
                  : "bg-white text-charcoal border border-light-tan hover:bg-light-tan"
              }`}
            >
              {v.label}
              {!loading && (
                <span
                  className={`tabular-nums font-normal ${
                    selected ? "text-white/70" : "text-muted"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {active.blurb && (
        <p className="font-sans text-[13px] text-muted leading-[1.5] mt-3 max-w-[52ch]">
          {active.blurb}
        </p>
      )}

      {error && (
        <p className="font-sans text-[14px] text-danger mt-4">{error}</p>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {loading ? (
          // Placeholder in the shape of a day section, so the list doesn't
          // jump when the real rows arrive.
          <div className="bg-white rounded-surface shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden animate-pulse">
            <div className="h-[38px] bg-cream/60 border-b border-light-tan" />
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex items-center gap-4 px-4 sm:px-5 py-4 border-b border-light-tan last:border-b-0"
              >
                <div className="h-4 w-14 rounded bg-light-tan shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="h-4 w-1/3 rounded bg-light-tan" />
                  <div className="h-3 w-1/4 rounded bg-light-tan/70 mt-2" />
                </div>
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-surface shadow-[0_1px_4px_rgba(0,0,0,0.06)] px-6 py-10 text-center">
            <p className="font-sans text-[15px] text-muted leading-[1.5] max-w-[40ch] mx-auto">
              {active.empty}
            </p>
          </div>
        ) : (
          days.map((day) => {
            const relative = relativeDay(day.date, today);
            return (
              <section
                key={day.date}
                className="bg-white rounded-surface shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden"
              >
                <h2 className="flex items-baseline gap-2 px-4 sm:px-5 py-2.5 bg-cream/60 border-b border-light-tan">
                  <span
                    className={`font-sans text-[12px] font-semibold uppercase tracking-[0.7px] ${
                      relative === "Today" ? "text-deep-brown" : "text-dark-brown"
                    }`}
                  >
                    {relative ?? fullDate(day.date)}
                  </span>
                  {relative && (
                    <span className="font-sans text-[12px] text-muted">
                      {fullDate(day.date)}
                    </span>
                  )}
                </h2>

                <ul>
                  {day.rows.map((booking) => {
                    const { time, period } = splitSlot(booking.time_slot);
                    // Deposit only matters while the appointment is still
                    // ahead of her; on a settled one it is just noise.
                    const showDeposit =
                      view === "upcoming" || view === "past";
                    return (
                      <li key={booking.id}>
                        <Link
                          href={`/admin/bookings/${booking.id}`}
                          className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 border-b border-light-tan last:border-b-0 hover:bg-cream/50 active:bg-cream transition-colors cursor-pointer"
                        >
                          {/* Time rail. Fixed width and tabular figures so
                              every row in a day lines up down the column. */}
                          <div className="w-[52px] sm:w-[60px] shrink-0">
                            <p className="font-sans text-[15px] font-semibold text-dark-brown tabular-nums leading-tight">
                              {time}
                            </p>
                            {period && (
                              <p className="font-sans text-[11px] text-muted tracking-[0.5px]">
                                {period}
                              </p>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="font-sans text-[16px] font-semibold text-dark-brown truncate">
                              {booking.client_name}
                            </p>
                            <p className="font-sans text-[14px] text-muted truncate">
                              {booking.service_name}
                            </p>
                            {showDeposit && (
                              <p
                                className={`font-sans text-[12px] mt-0.5 ${
                                  booking.deposit_paid
                                    ? "text-success"
                                    : "text-muted"
                                }`}
                              >
                                {booking.deposit_paid
                                  ? "Deposit paid"
                                  : "Deposit not paid"}
                              </p>
                            )}
                          </div>

                          {/* The badge only earns its place where statuses are
                              actually mixed. On a filtered tab every row says
                              the same word as the tab above it. */}
                          {view === "all" ? (
                            <Badge status={booking.status} />
                          ) : (
                            <Chevron />
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}

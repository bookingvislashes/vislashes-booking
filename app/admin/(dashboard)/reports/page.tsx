"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

/**
 * Reports — what she saw in a period, for tax season.
 *
 * Two sources, one timeline. `appointment_history` is the closed record from
 * Acuity (2023 through the migration); `bookings` is everything taken on this
 * site from here on. A tax year straddles both, so the report reads both and
 * normalises them into the same shape below.
 *
 * Everything is fetched once and filtered in memory. The whole history is 563
 * rows — smaller than a single photo on the booking page — and switching
 * period or stepping through months has to feel instant, not spinner-y.
 */

type Period = "day" | "week" | "month" | "year";

interface Appt {
  id: string;
  date: string; // YYYY-MM-DD
  client: string;
  service: string;
  /** What the appointment was worth. Null when nothing was recorded. */
  price: number | null;
  /** What arrived up front — the deposit on this site, "paid online" on Acuity. */
  collected: number;
  paid: boolean;
  /** "Lash Model", "Giveaway Winner" — comped, and worth seeing separately. */
  label: string | null;
  source: "history" | "booking";
}

const PERIODS: { value: Period; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];

// ── Dates ────────────────────────────────────────────────────────────────
// All of this works on plain YYYY-MM-DD strings and local-noon Date objects.
// Parsing "2026-03-08" as a Date gives midnight UTC, which is the previous
// evening in Eastern time — that one hour is enough to file an appointment in
// the wrong month. Noon has no such edge.

function toKey(d: Date) {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function fromKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

function startOfWeek(d: Date) {
  const out = new Date(d);
  out.setDate(out.getDate() - out.getDay()); // weeks start Sunday
  return out;
}

/** Inclusive [from, to] the current period covers. */
function rangeFor(period: Period, anchor: Date): { from: string; to: string } {
  const y = anchor.getFullYear();
  const m = anchor.getMonth();

  if (period === "day") return { from: toKey(anchor), to: toKey(anchor) };

  if (period === "week") {
    const start = startOfWeek(anchor);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { from: toKey(start), to: toKey(end) };
  }

  if (period === "month") {
    return {
      from: toKey(new Date(y, m, 1, 12)),
      to: toKey(new Date(y, m + 1, 0, 12)),
    };
  }

  return { from: `${y}-01-01`, to: `${y}-12-31` };
}

function step(period: Period, anchor: Date, direction: 1 | -1) {
  const out = new Date(anchor);
  if (period === "day") out.setDate(out.getDate() + direction);
  if (period === "week") out.setDate(out.getDate() + 7 * direction);
  if (period === "month") {
    // Set the day first: stepping from the 31st into a 30-day month otherwise
    // rolls forward and skips it entirely.
    out.setDate(1);
    out.setMonth(out.getMonth() + direction);
  }
  if (period === "year") out.setFullYear(out.getFullYear() + direction);
  return out;
}

function periodLabel(period: Period, anchor: Date) {
  if (period === "day")
    return anchor.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

  if (period === "week") {
    const { from, to } = rangeFor("week", anchor);
    const a = fromKey(from);
    const b = fromKey(to);
    const sameMonth = a.getMonth() === b.getMonth();
    const left = a.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const right = b.toLocaleDateString("en-US", {
      month: sameMonth ? undefined : "short",
      day: "numeric",
      year: "numeric",
    });
    return `${left} – ${right}`;
  }

  if (period === "month")
    return anchor.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return `${anchor.getFullYear()}`;
}

function money(value: number) {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function shortDate(key: string) {
  return fromKey(key).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ── CSV ──────────────────────────────────────────────────────────────────

function csvCell(value: string | number | null) {
  const s = value === null ? "" : String(value);
  // A leading =, + or - makes Excel treat the cell as a formula. Names and
  // service strings are hers, not an attacker's, but a client called "+Ana"
  // would still open as #NAME? in the spreadsheet she hands her accountant.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function downloadCsv(filename: string, rows: Appt[]) {
  const header = ["Date", "Client", "Service", "Price", "Paid", "Paid up front", "Label"];
  const body = rows.map((r) => [
    r.date,
    r.client,
    r.service,
    r.price === null ? "" : r.price.toFixed(2),
    r.paid ? "Yes" : "No",
    r.collected.toFixed(2),
    r.label ?? "",
  ]);

  const csv = [header, ...body].map((line) => line.map(csvCell).join(",")).join("\r\n");
  // BOM so Excel opens accented names ("Valery Reyes Martínez") correctly
  // instead of mojibake.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [appts, setAppts] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("year");
  const [anchor, setAnchor] = useState(() => new Date());
  const [showList, setShowList] = useState(false);

  const supabase = createClient();

  const fetchAll = useCallback(async () => {
    const [history, bookings] = await Promise.all([
      supabase
        .from("appointment_history")
        .select(
          "id, appointment_date, client_name, service_type, price, paid, amount_paid_online, label"
        )
        .order("appointment_date", { ascending: false }),
      supabase
        .from("bookings")
        .select(
          "id, booking_date, status, deposit_paid, deposit_amount, client:clients(full_name), service:services(name, price)"
        )
        .order("booking_date", { ascending: false }),
    ]);

    if (history.error) {
      setError(history.error.message);
      setLoading(false);
      return;
    }
    if (bookings.error) {
      setError(bookings.error.message);
      setLoading(false);
      return;
    }

    type HistoryRow = {
      id: string;
      appointment_date: string;
      client_name: string;
      service_type: string;
      price: string | number | null;
      paid: boolean;
      amount_paid_online: string | number | null;
      label: string | null;
    };
    // Supabase types an embedded one-to-one as an array; these are single rows.
    type BookingRow = {
      id: string;
      booking_date: string;
      status: string;
      deposit_paid: boolean;
      deposit_amount: string | number | null;
      client: { full_name: string } | { full_name: string }[] | null;
      service: { name: string; price: string | number } | { name: string; price: string | number }[] | null;
    };

    const one = <T,>(value: T | T[] | null): T | null =>
      Array.isArray(value) ? value[0] ?? null : value;

    const num = (value: string | number | null) => {
      if (value === null) return null;
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    };

    const fromHistory: Appt[] = ((history.data || []) as HistoryRow[]).map((h) => ({
      id: `h:${h.id}`,
      date: h.appointment_date,
      client: h.client_name,
      service: h.service_type,
      price: num(h.price),
      collected: num(h.amount_paid_online) ?? 0,
      paid: h.paid,
      label: h.label,
      source: "history",
    }));

    // Cancelled and no-show appointments are not work she did, so they never
    // belong in a tax total.
    const fromBookings: Appt[] = ((bookings.data || []) as BookingRow[])
      .filter((b) => b.status === "confirmed" || b.status === "completed")
      .map((b) => {
        const service = one(b.service);
        return {
          id: `b:${b.id}`,
          date: b.booking_date,
          client: one(b.client)?.full_name ?? "Unknown",
          service: service?.name ?? "Appointment",
          price: service ? num(service.price) : null,
          collected: (b.deposit_paid ? num(b.deposit_amount) : 0) ?? 0,
          paid: b.deposit_paid,
          label: null,
          source: "booking",
        };
      });

    const all = [...fromHistory, ...fromBookings].sort((a, b) =>
      a.date === b.date ? a.client.localeCompare(b.client) : a.date < b.date ? 1 : -1
    );

    setAppts(all);
    setError(null);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const { from, to } = useMemo(() => rangeFor(period, anchor), [period, anchor]);

  const rows = useMemo(
    () => appts.filter((a) => a.date >= from && a.date <= to),
    [appts, from, to]
  );

  const totals = useMemo(() => {
    let revenue = 0;
    let collected = 0;
    let unpaid = 0;
    let comped = 0;
    for (const r of rows) {
      revenue += r.price ?? 0;
      collected += r.collected;
      if (!r.paid) unpaid += 1;
      if (r.label) comped += 1;
    }
    return {
      count: rows.length,
      revenue,
      collected,
      unpaid,
      comped,
      clients: new Set(rows.map((r) => r.client.toLowerCase())).size,
    };
  }, [rows]);

  /** Which services made up the period, biggest first. */
  const byService = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number }>();
    for (const r of rows) {
      const entry = map.get(r.service) || { count: 0, revenue: 0 };
      entry.count += 1;
      entry.revenue += r.price ?? 0;
      map.set(r.service, entry);
    }
    return [...map.entries()]
      .map(([service, v]) => ({ service, ...v }))
      .sort((a, b) => b.count - a.count || b.revenue - a.revenue);
  }, [rows]);

  /** Month-by-month, so a year opens as twelve numbers rather than one. */
  const byMonth = useMemo(() => {
    if (period !== "year") return [];
    const out = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(anchor.getFullYear(), i, 1, 12).toLocaleDateString("en-US", {
        month: "long",
      }),
      count: 0,
      revenue: 0,
    }));
    for (const r of rows) {
      const index = Number(r.date.slice(5, 7)) - 1;
      if (out[index]) {
        out[index].count += 1;
        out[index].revenue += r.price ?? 0;
      }
    }
    return out;
  }, [rows, period, anchor]);

  /** Years that actually have appointments, so "2019" is never offered. */
  const years = useMemo(() => {
    const set = new Set(appts.map((a) => a.date.slice(0, 4)));
    set.add(`${new Date().getFullYear()}`);
    return [...set].sort().reverse();
  }, [appts]);

  const label = periodLabel(period, anchor);

  return (
    <div>
      <h1 className="font-display text-[28px] font-bold text-dark-brown mb-1">
        Reports
      </h1>
      <p className="font-sans text-[16px] text-muted mb-6 leading-[1.5]">
        Every appointment you have taken, from 2023 to today. Pick a period to
        see what you did and what it was worth.
      </p>

      {/* Period picker */}
      <div
        role="group"
        aria-label="Report period"
        className="inline-flex bg-white border border-light-tan rounded-control overflow-hidden mb-4"
      >
        {PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            aria-pressed={period === p.value}
            onClick={() => setPeriod(p.value)}
            className={`h-control px-5 text-[14px] font-sans font-semibold border-r border-light-tan last:border-r-0 transition-colors cursor-pointer ${
              period === p.value
                ? "bg-deep-brown/10 text-deep-brown"
                : "text-charcoal hover:bg-light-tan"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Which period, and how to move between them */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {/* Arrows and label travel together. Left to wrap freely they split
            across two lines at 390px, which reads as three unrelated controls. */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
        <button
          type="button"
          aria-label="Previous period"
          onClick={() => setAnchor((a) => step(period, a, -1))}
          className="w-control h-control shrink-0 flex items-center justify-center bg-white border border-light-tan rounded-control text-charcoal hover:bg-light-tan transition-colors cursor-pointer"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <p className="flex-1 sm:flex-none font-sans text-[16px] font-semibold text-dark-brown sm:min-w-[180px] text-center tabular-nums">
          {label}
        </p>

        <button
          type="button"
          aria-label="Next period"
          onClick={() => setAnchor((a) => step(period, a, 1))}
          className="w-control h-control shrink-0 flex items-center justify-center bg-white border border-light-tan rounded-control text-charcoal hover:bg-light-tan transition-colors cursor-pointer"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
        </div>

        <Button variant="ghost" size="sm" onClick={() => setAnchor(new Date())}>
          Today
        </Button>

        {/* Jumping straight to a tax year, without stepping back one at a time. */}
        {period === "year" && (
          <select
            aria-label="Jump to year"
            value={`${anchor.getFullYear()}`}
            onChange={(e) => {
              const next = new Date(anchor);
              next.setFullYear(Number(e.target.value));
              setAnchor(next);
            }}
            className="h-control px-3 bg-white border border-light-tan rounded-control text-[14px] font-sans text-charcoal cursor-pointer"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[88px] bg-white rounded-surface border border-light-tan animate-pulse"
            />
          ))}
        </div>
      ) : error ? (
        <div className="bg-white rounded-surface p-8 text-center">
          <p className="font-sans text-[16px] text-danger font-semibold">
            Couldn&apos;t load your appointments
          </p>
          <p className="font-sans text-[16px] text-muted mt-1 leading-[1.5]">{error}</p>
          <Button
            variant="secondary"
            className="mt-3"
            onClick={() => {
              setLoading(true);
              setError(null);
              fetchAll();
            }}
          >
            Retry
          </Button>
        </div>
      ) : (
        <>
          {/* Headline numbers */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <Stat label="Appointments" value={`${totals.count}`} />
            <Stat label="Total value" value={money(totals.revenue)} />
            <Stat label="Paid up front" value={money(totals.collected)} />
            <Stat
              label="Different clients"
              value={`${totals.clients}`}
              hint={
                totals.comped > 0
                  ? `${totals.comped} comped (models, giveaways)`
                  : undefined
              }
            />
          </div>

          {totals.count === 0 ? (
            <div className="bg-white rounded-surface p-8 text-center">
              <p className="font-sans text-[16px] text-charcoal font-semibold">
                Nothing in {label}
              </p>
              <p className="font-sans text-[16px] text-muted mt-1">
                Use the arrows above to look at another {period}.
              </p>
            </div>
          ) : (
            <>
              {/* Year view opens into twelve months */}
              {period === "year" && (
                <Panel title="Month by month">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-light-tan">
                        <Th>Month</Th>
                        <Th align="right">Appointments</Th>
                        <Th align="right">Value</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {byMonth.map((m) => (
                        <tr key={m.month} className="border-b border-light-tan last:border-b-0">
                          <Td>{m.month}</Td>
                          <Td align="right">{m.count || "—"}</Td>
                          <Td align="right">{m.revenue ? money(m.revenue) : "—"}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Panel>
              )}

              <Panel title="What you did">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-light-tan">
                      <Th>Service</Th>
                      <Th align="right">Count</Th>
                      <Th align="right">Value</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {byService.map((s) => (
                      <tr key={s.service} className="border-b border-light-tan last:border-b-0">
                        <Td>{s.service}</Td>
                        <Td align="right">{s.count}</Td>
                        <Td align="right">{money(s.revenue)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>

              {/* Every appointment, for when the summary is not enough */}
              <div className="bg-white rounded-surface shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-light-tan">
                  <h2 className="font-sans text-[16px] font-semibold text-dark-brown">
                    Every appointment ({totals.count})
                  </h2>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowList((v) => !v)}
                    >
                      {showList ? "Hide" : "Show"}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        downloadCsv(
                          `vislashes-${period}-${from}-to-${to}.csv`,
                          rows
                        )
                      }
                    >
                      Download for taxes
                    </Button>
                  </div>
                </div>

                {showList && (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px]">
                      <thead>
                        <tr className="border-b border-light-tan">
                          <Th>Date</Th>
                          <Th>Client</Th>
                          <Th>Service</Th>
                          <Th align="right">Value</Th>
                          <Th align="right">Paid</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={r.id} className="border-b border-light-tan last:border-b-0">
                            <Td>{shortDate(r.date)}</Td>
                            <Td>{r.client}</Td>
                            <Td>
                              {r.service}
                              {r.label && (
                                <span className="ml-2 font-sans text-[12px] text-muted">
                                  {r.label}
                                </span>
                              )}
                            </Td>
                            <Td align="right">{r.price === null ? "—" : money(r.price)}</Td>
                            <Td align="right">
                              <span
                                className={
                                  r.paid ? "text-success font-semibold" : "text-muted"
                                }
                              >
                                {r.paid ? "Yes" : "No"}
                              </span>
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <p className="font-sans text-[12px] text-muted mt-4 leading-[1.6]">
                &quot;Total value&quot; is the full price of every appointment in the
                period. &quot;Paid up front&quot; is only what was collected online — the
                rest was taken in the studio, so it is not in that number.
                Cancelled appointments are left out.
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="bg-white rounded-surface border border-light-tan p-4">
      <p className="font-sans text-[12px] text-muted uppercase tracking-[0.6px]">
        {label}
      </p>
      <p className="font-display text-[24px] font-bold text-dark-brown mt-1 tabular-nums">
        {value}
      </p>
      {hint && <p className="font-sans text-[12px] text-muted mt-1">{hint}</p>}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-surface shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden mb-6">
      <h2 className="font-sans text-[16px] font-semibold text-dark-brown px-4 sm:px-5 py-4 border-b border-light-tan">
        {title}
      </h2>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`font-sans text-[12px] font-semibold text-muted uppercase tracking-[0.6px] px-4 sm:px-5 py-3 ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <td
      className={`font-sans text-[16px] text-charcoal px-4 sm:px-5 py-3 ${
        align === "right" ? "text-right tabular-nums" : "text-left"
      }`}
    >
      {children}
    </td>
  );
}

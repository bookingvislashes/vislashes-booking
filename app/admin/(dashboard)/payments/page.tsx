"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

interface OrphanPayment {
  id: string;
  square_payment_id: string;
  amount: string | number | null;
  currency: string | null;
  customer_email: string | null;
  booking_date: string | null;
  time_slot: string | null;
  failure_reason: string | null;
  resolved: boolean;
  resolved_at: string | null;
  note: string | null;
  created_at: string;
}

function money(amount: string | number | null, currency: string | null) {
  if (amount === null) return "Unknown amount";
  const value = Number(amount);
  if (!Number.isFinite(value)) return "Unknown amount";
  return `$${value.toFixed(2)}${currency && currency !== "USD" ? ` ${currency}` : ""}`;
}

function when(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function PaymentsPage() {
  const [rows, setRows] = useState<OrphanPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const supabase = createClient();

  const fetchRows = useCallback(async () => {
    const { data, error } = await supabase
      .from("orphan_payments")
      .select(
        "id, square_payment_id, amount, currency, customer_email, booking_date, time_slot, failure_reason, resolved, resolved_at, note, created_at"
      )
      .order("created_at", { ascending: false });

    if (error) {
      setLoadError(error.message);
      setLoading(false);
      return;
    }

    setRows((data || []) as OrphanPayment[]);
    setLoadError(null);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const resolve = async (row: OrphanPayment) => {
    setBusyId(row.id);
    setActionError(null);

    const { error } = await supabase
      .from("orphan_payments")
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        note: notes[row.id]?.trim() || null,
      })
      .eq("id", row.id);

    setBusyId(null);

    if (error) {
      setActionError(error.message);
      return;
    }
    fetchRows();
  };

  const unresolved = rows.filter((r) => !r.resolved);
  const resolved = rows.filter((r) => r.resolved);

  return (
    <div>
      <h1 className="font-display text-[28px] font-bold text-dark-brown mb-1">
        Payments
      </h1>
      <p className="font-sans text-[16px] text-muted mb-6 max-w-[60ch]">
        Card payments that went through without a booking being saved. This is
        normally empty — anything listed here means someone paid and may not
        have an appointment.
      </p>

      {loading && (
        <div className="bg-white rounded-surface p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <div className="h-[14px] w-[40%] rounded-control bg-light-tan/70 animate-pulse" />
          <div className="h-[12px] w-[60%] rounded-control bg-light-tan/50 animate-pulse mt-2.5" />
        </div>
      )}

      {loadError && (
        <div
          role="alert"
          className="bg-white border border-danger/30 rounded-surface p-5"
        >
          <p className="font-sans text-[16px] text-danger font-semibold">
            Couldn&apos;t load payments
          </p>
          <p className="font-sans text-[16px] text-muted mt-1 leading-[1.5]">
            {loadError}
          </p>
          <Button
            variant="secondary"
            className="mt-3"
            onClick={() => {
              setLoading(true);
              setLoadError(null);
              fetchRows();
            }}
          >
            Retry
          </Button>
        </div>
      )}

      {!loading && !loadError && (
        <>
          {actionError && (
            <p
              role="alert"
              className="font-sans text-[16px] text-danger font-semibold mb-4"
            >
              {actionError}
            </p>
          )}

          {unresolved.length === 0 ? (
            <div className="bg-white rounded-surface p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-start gap-3">
              <span
                aria-hidden="true"
                className="w-3 h-3 rounded-full bg-success mt-1.5 shrink-0"
              />
              <div>
                <p className="font-sans text-[16px] text-charcoal font-semibold">
                  Nothing to review
                </p>
                <p className="font-sans text-[16px] text-muted mt-1 leading-[1.5] max-w-[52ch]">
                  Every card payment has a booking behind it.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {unresolved.map((row) => (
                <div
                  key={row.id}
                  className="bg-white border border-danger/30 rounded-surface p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
                >
                  <div className="flex items-baseline gap-3 flex-wrap mb-2">
                    <span className="font-display text-[20px] font-bold text-dark-brown tabular-nums">
                      {money(row.amount, row.currency)}
                    </span>
                    <span className="font-sans text-[12px] font-semibold text-danger bg-danger/10 px-2.5 py-1 rounded-full">
                      Needs review
                    </span>
                    <span className="font-sans text-[12px] text-muted ml-auto">
                      {when(row.created_at)}
                    </span>
                  </div>

                  <p className="font-sans text-[16px] text-charcoal leading-[1.5]">
                    {row.customer_email || "No email recorded"}
                    {row.booking_date && (
                      <>
                        {" · "}
                        {row.booking_date}
                        {row.time_slot ? ` at ${row.time_slot}` : ""}
                      </>
                    )}
                  </p>

                  {row.failure_reason && (
                    <p className="font-sans text-[16px] text-muted mt-1 leading-[1.5] max-w-[60ch]">
                      {row.failure_reason}
                    </p>
                  )}

                  {/* The Square payment id is the only way to find this charge
                      in the Square dashboard to refund or honour it, so it is
                      shown in full and selectable rather than truncated. */}
                  <p className="font-mono text-[12px] text-muted mt-2 break-all select-all">
                    {row.square_payment_id}
                  </p>

                  <div className="flex flex-col sm:flex-row gap-2 mt-4">
                    <input
                      type="text"
                      value={notes[row.id] ?? ""}
                      onChange={(e) =>
                        setNotes((n) => ({ ...n, [row.id]: e.target.value }))
                      }
                      placeholder="What did you do? (refunded, booked her in…)"
                      className="flex-1 h-control box-border px-3 rounded-control border-2 border-light-tan bg-white font-sans text-[16px] text-charcoal placeholder:text-muted focus:border-deep-brown focus:outline-none"
                    />
                    <Button
                      type="button"
                      onClick={() => resolve(row)}
                      disabled={busyId === row.id}
                    >
                      {busyId === row.id ? "Saving..." : "Mark Resolved"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {resolved.length > 0 && (
            <div className="mt-8">
              <h2 className="font-display text-[18px] font-bold text-dark-brown mb-3">
                Resolved
              </h2>
              <div className="bg-white rounded-surface shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
                {resolved.map((row) => (
                  <div
                    key={row.id}
                    className="px-5 py-4 border-b border-light-tan last:border-b-0"
                  >
                    <div className="flex items-baseline gap-3 flex-wrap">
                      <span className="font-sans text-[16px] font-semibold text-charcoal tabular-nums">
                        {money(row.amount, row.currency)}
                      </span>
                      <span className="font-sans text-[16px] text-muted truncate">
                        {row.customer_email || "No email recorded"}
                      </span>
                      <span className="font-sans text-[12px] text-muted ml-auto">
                        {row.resolved_at ? when(row.resolved_at) : ""}
                      </span>
                    </div>
                    {row.note && (
                      <p className="font-sans text-[16px] text-muted mt-1 leading-[1.5]">
                        {row.note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

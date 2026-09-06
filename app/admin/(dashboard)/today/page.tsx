"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRegisterRefresh } from "@/components/admin/RefreshProvider";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { todayISO, to12Hour } from "@/lib/schedule";

/**
 * Today — who she is seeing, what they still owe, and one tap to record
 * whatever they pay her. Built for a phone: this is the screen meant to be
 * open in her hand at the appointment, not a report she runs later.
 *
 * Square's own card payments — tap, dip, a reader — already land here on
 * their own through the webhook, tip included. This page's "Record payment"
 * form is for everything Square never sees: Zelle, Apple Cash, cash, Venmo.
 */

type Method = "card" | "zelle" | "apple_cash" | "cash" | "venmo" | "other";

const METHODS: { value: Method; label: string }[] = [
  { value: "zelle", label: "Zelle" },
  { value: "apple_cash", label: "Apple Cash" },
  { value: "cash", label: "Cash" },
  { value: "venmo", label: "Venmo" },
  { value: "card", label: "Card (keyed elsewhere)" },
  { value: "other", label: "Other" },
];

interface Payment {
  id: string;
  booking_id: string | null;
  method: Method;
  source: "square" | "manual";
  service_amount: string | number;
  tip_amount: string | number;
  total_collected: string | number;
}

interface Appointment {
  id: string;
  time_slot: string;
  status: string;
  deposit_paid: boolean;
  deposit_amount: string | number | null;
  client_id: string | null;
  client_name: string;
  client_phone: string | null;
  service_name: string;
  price: number;
}

function money(value: string | number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "$0.00";
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function TodayPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Method>("zelle");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const supabase = createClient();
  const today = todayISO();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [bookingsRes, paymentsRes] = await Promise.all([
      supabase
        .from("bookings")
        .select(
          "id, time_slot, status, deposit_paid, deposit_amount, client_id, client:clients(full_name, phone), service:services(name, price)"
        )
        .eq("booking_date", today)
        .in("status", ["confirmed", "completed"])
        .order("time_slot", { ascending: true }),
      supabase
        .from("payments")
        .select("id, booking_id, method, source, service_amount, tip_amount, total_collected")
        .eq("paid_on", today),
    ]);

    if (bookingsRes.error) {
      setError(bookingsRes.error.message);
      setLoading(false);
      return;
    }

    type Row = {
      id: string;
      time_slot: string;
      status: string;
      deposit_paid: boolean;
      deposit_amount: string | number | null;
      client_id: string | null;
      client:
        | { full_name: string; phone: string | null }
        | { full_name: string; phone: string | null }[]
        | null;
      service:
        | { name: string; price: string | number }
        | { name: string; price: string | number }[]
        | null;
    };

    const mapped = ((bookingsRes.data ?? []) as Row[]).map((b) => {
      const client = Array.isArray(b.client) ? b.client[0] : b.client;
      const service = Array.isArray(b.service) ? b.service[0] : b.service;
      return {
        id: b.id,
        time_slot: b.time_slot,
        status: b.status,
        deposit_paid: b.deposit_paid,
        deposit_amount: b.deposit_amount,
        client_id: b.client_id,
        client_name: client?.full_name ?? "Unknown client",
        client_phone: client?.phone ?? null,
        service_name: service?.name ?? "Appointment",
        price: Number(service?.price ?? 0),
      };
    });

    setAppointments(mapped);
    setPayments((paymentsRes.data as Payment[]) ?? []);
    setError(paymentsRes.error ? paymentsRes.error.message : null);
    setLoading(false);
  }, [supabase, today]);

  useRegisterRefresh(fetchAll);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const paymentsByBooking = useMemo(() => {
    const map = new Map<string, Payment[]>();
    for (const p of payments) {
      if (!p.booking_id) continue;
      const list = map.get(p.booking_id) ?? [];
      list.push(p);
      map.set(p.booking_id, list);
    }
    return map;
  }, [payments]);

  function balanceFor(appt: Appointment) {
    const collected = (paymentsByBooking.get(appt.id) ?? []).reduce(
      (sum, p) => sum + Number(p.service_amount ?? 0),
      0
    );
    const deposit =
      appt.deposit_paid && appt.deposit_amount ? Number(appt.deposit_amount) : 0;
    return Math.max(0, appt.price - deposit - collected);
  }

  function tipsFor(appt: Appointment) {
    return (paymentsByBooking.get(appt.id) ?? []).reduce(
      (sum, p) => sum + Number(p.tip_amount ?? 0),
      0
    );
  }

  function openForm(appt: Appointment) {
    const due = balanceFor(appt);
    setOpenFor(appt.id);
    setAmount(due > 0 ? due.toFixed(2) : "");
    setMethod("zelle");
    setFormError(null);
  }

  async function submitPayment(appt: Appointment) {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setFormError("Enter how much they paid.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch("/api/admin/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: appt.id,
          clientId: appt.client_id,
          clientName: appt.client_name,
          method,
          amount: value,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setFormError(body.error || "Could not record that payment.");
        return;
      }
      setOpenFor(null);
      setAmount("");
      await fetchAll();
    } catch {
      setFormError("Something went wrong. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <p className="font-sans text-[16px] text-muted">Loading today…</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <h1 className="font-display text-[28px] font-bold text-dark-brown">Today</h1>
      <p className="font-sans text-[16px] text-muted mb-6 leading-[1.5]">
        {new Date(today + "T12:00:00").toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
      </p>

      {error && (
        <p className="font-sans text-[16px] text-danger mb-4">{error}</p>
      )}

      {appointments.length === 0 && (
        <div className="bg-white rounded-surface border border-light-tan p-6 text-center">
          <p className="font-sans text-[16px] text-muted">
            Nothing on the books for today.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {appointments.map((appt) => {
          const balance = balanceFor(appt);
          const tips = tipsFor(appt);
          const isOpen = openFor === appt.id;
          return (
            <div
              key={appt.id}
              className="bg-white rounded-surface shadow-[0_1px_4px_rgba(0,0,0,0.06)] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-sans text-[13px] font-semibold text-deep-brown uppercase tracking-[0.6px]">
                    {to12Hour(appt.time_slot)}
                  </p>
                  <p className="font-display text-[20px] font-bold text-dark-brown mt-0.5">
                    {appt.client_name}
                  </p>
                  <p className="font-sans text-[14px] text-muted">
                    {appt.service_name} · {money(appt.price)}
                  </p>
                  {appt.client_phone && (
                    <a
                      href={`tel:${appt.client_phone}`}
                      className="font-sans text-[14px] text-deep-brown underline underline-offset-2"
                    >
                      {appt.client_phone}
                    </a>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {balance > 0 ? (
                    <>
                      <p className="font-sans text-[12px] text-muted uppercase tracking-[0.6px]">
                        Balance due
                      </p>
                      <p className="font-display text-[20px] font-bold text-dark-brown tabular-nums">
                        {money(balance)}
                      </p>
                    </>
                  ) : (
                    <p className="font-sans text-[14px] font-semibold text-success">
                      Paid in full
                    </p>
                  )}
                  {tips > 0 && (
                    <p className="font-sans text-[13px] text-muted tabular-nums">
                      +{money(tips)} tip
                    </p>
                  )}
                </div>
              </div>

              {!isOpen && (
                <Button
                  className="mt-3 w-full"
                  variant="secondary"
                  onClick={() => openForm(appt)}
                >
                  Record payment
                </Button>
              )}

              {isOpen && (
                <div className="mt-3 pt-3 border-t border-light-tan">
                  <div className="flex gap-2 flex-wrap mb-3">
                    {METHODS.map((m) => (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setMethod(m.value)}
                        className={`px-3 h-9 rounded-control font-sans text-[14px] font-semibold border transition-colors ${
                          method === m.value
                            ? "bg-dark-brown text-white border-dark-brown"
                            : "bg-white text-charcoal border-light-tan"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-sans text-[16px] text-muted">
                      $
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full h-control pl-7 pr-3 box-border bg-white border border-light-tan rounded-control text-[16px] text-charcoal font-sans tabular-nums placeholder:text-muted focus:border-deep-brown transition-colors"
                    />
                  </div>
                  {Number(amount) > balance && (
                    <p className="font-sans text-[13px] text-muted mt-2">
                      Includes a {money(Math.max(0, Number(amount) - balance))} tip.
                    </p>
                  )}
                  {formError && (
                    <p className="font-sans text-[14px] text-danger mt-2">{formError}</p>
                  )}
                  <div className="flex gap-2 mt-3">
                    <Button
                      variant="secondary"
                      className="flex-1"
                      onClick={() => setOpenFor(null)}
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={() => submitPayment(appt)}
                      disabled={saving}
                    >
                      {saving ? "Saving…" : "Save"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

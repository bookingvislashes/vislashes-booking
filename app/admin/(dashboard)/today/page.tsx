"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
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
  has_removal: boolean;
  client_id: string | null;
  client_name: string;
  client_phone: string | null;
  service_name: string;
  price: number;
}

/** One sellable line from her Square library. */
interface AddOn {
  id: string;
  name: string;
  priceCents: number;
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

  // Removal is priced in Settings, so it is read rather than assumed.
  const [removalPrice, setRemovalPrice] = useState(0);

  // ── Charging a card through the Square app ────────────────────────────
  const [checkoutFor, setCheckoutFor] = useState<string | null>(null);
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [addOnsError, setAddOnsError] = useState<string | null>(null);
  const [addOnsLoading, setAddOnsLoading] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [addOnSearch, setAddOnSearch] = useState("");
  const [handingOver, setHandingOver] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [chargeResult, setChargeResult] = useState<string | null>(null);

  const supabase = createClient();
  const today = todayISO();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [bookingsRes, paymentsRes, settingsRes] = await Promise.all([
      supabase
        .from("bookings")
        .select(
          "id, time_slot, status, deposit_paid, deposit_amount, has_removal, client_id, client:clients(full_name, phone), service:services(name, price)"
        )
        .eq("booking_date", today)
        .in("status", ["confirmed", "completed"])
        .order("time_slot", { ascending: true }),
      supabase
        .from("payments")
        .select("id, booking_id, method, source, service_amount, tip_amount, total_collected")
        .eq("paid_on", today),
      supabase.from("settings").select("key, value").eq("key", "removal_price"),
    ]);

    setRemovalPrice(Number(settingsRes.data?.[0]?.value ?? 0));

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
      has_removal: boolean;
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
        has_removal: b.has_removal,
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

  // Square sends her back here with a flag on the URL. Read from
  // window.location rather than useSearchParams so this page needs no
  // Suspense boundary, then cleaned off so a refresh doesn't replay it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const charge = params.get("charge");
    if (!charge) return;

    setChargeResult(
      charge === "done"
        ? "Card charged. It'll appear against the appointment in a moment."
        : charge === "failed"
        ? `That charge didn't go through${
            params.get("reason") ? ` (${params.get("reason")})` : ""
          }.`
        : "Came back from Square without charging."
    );
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

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

  function totalFor(appt: Appointment) {
    // A removal booked with the set lengthens the appointment and adds to
    // what is owed. This screen used to price the set alone, so every client
    // who booked one was shown $25 too little to collect.
    return appt.price + (appt.has_removal ? removalPrice : 0);
  }

  function balanceFor(appt: Appointment) {
    const collected = (paymentsByBooking.get(appt.id) ?? []).reduce(
      (sum, p) => sum + Number(p.service_amount ?? 0),
      0
    );
    const deposit =
      appt.deposit_paid && appt.deposit_amount ? Number(appt.deposit_amount) : 0;
    return Math.max(0, totalFor(appt) - deposit - collected);
  }

  function tipsFor(appt: Appointment) {
    return (paymentsByBooking.get(appt.id) ?? []).reduce(
      (sum, p) => sum + Number(p.tip_amount ?? 0),
      0
    );
  }

  async function openCheckout(appt: Appointment) {
    setCheckoutFor(appt.id);
    setOpenFor(null);
    setCart({});
    setAddOnSearch("");
    setCheckoutError(null);

    // Her library is fetched the first time she opens a checkout, not on
    // every page load: most visits to this screen never charge a card, and
    // it is a round trip to Square.
    if (addOns.length || addOnsLoading) return;
    setAddOnsLoading(true);
    setAddOnsError(null);
    try {
      const res = await fetch("/api/admin/square/catalog");
      const body = await res.json();
      if (!res.ok) {
        setAddOnsError(body.error || "Couldn't load your Square library.");
      } else {
        setAddOns(body.items || []);
      }
    } catch {
      setAddOnsError("Couldn't reach Square.");
    } finally {
      setAddOnsLoading(false);
    }
  }

  function bumpAddOn(id: string, by: number) {
    setCart((current) => {
      const next = { ...current };
      const quantity = (next[id] ?? 0) + by;
      if (quantity <= 0) delete next[id];
      else next[id] = quantity;
      return next;
    });
  }

  /**
   * Hands the sale to the Square app. The total is worked out on the server
   * from the booking and her Square prices — this only says which appointment
   * and which extras, so nothing here can change what a client is charged.
   */
  async function chargeInSquare(appt: Appointment) {
    setHandingOver(true);
    setCheckoutError(null);
    try {
      const res = await fetch("/api/admin/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: appt.id,
          addOns: Object.entries(cart).map(([id, quantity]) => ({
            id,
            quantity,
          })),
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setCheckoutError(body.message || body.error || "Couldn't start that checkout.");
        return;
      }
      // Leaves this page for the Square app. Nothing is recorded here — the
      // webhook does that when Square reports the payment.
      window.location.href = body.url;
    } catch {
      setCheckoutError("Something went wrong. Try again.");
    } finally {
      setHandingOver(false);
    }
  }

  function openForm(appt: Appointment) {
    const due = balanceFor(appt);
    setOpenFor(appt.id);
    setCheckoutFor(null);
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
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-[28px] font-bold text-dark-brown">
            Today
          </h1>
          <p className="font-sans text-[16px] text-muted leading-[1.5]">
            {new Date(today + "T12:00:00").toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        {/* Rebooking happens here, at the end of the appointment, with the
            client still in the chair and her deposit already sent across. */}
        <Link
          href="/admin/bookings/new"
          className="shrink-0 inline-flex items-center justify-center box-border h-control px-5 rounded-control border-2 border-transparent bg-text-brown text-white font-sans text-[14px] font-semibold hover:bg-deep-brown transition-colors"
        >
          + Book
        </Link>
      </div>

      <div className="mb-6" />

      {chargeResult && (
        <p
          role="status"
          className="font-sans text-[15px] text-charcoal bg-white rounded-surface border border-light-tan px-4 py-3 mb-4"
        >
          {chargeResult}
        </p>
      )}

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
          const isCheckingOut = checkoutFor === appt.id;
          const extrasCents = Object.entries(cart).reduce((sum, [id, qty]) => {
            const item = addOns.find((a) => a.id === id);
            return sum + (item ? item.priceCents * qty : 0);
          }, 0);
          const chargeTotal = balance + extrasCents / 100;
          const visibleAddOns = addOnSearch.trim()
            ? addOns.filter((a) =>
                a.name.toLowerCase().includes(addOnSearch.trim().toLowerCase())
              )
            : addOns;
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

              {!isOpen && !isCheckingOut && (
                <div className="flex gap-2 mt-3">
                  {/* Card goes to the Square app, where Tap to Pay and her
                      reader live. Everything else she takes by hand is
                      recorded here. */}
                  <Button
                    className="flex-1"
                    onClick={() => openCheckout(appt)}
                  >
                    Check out
                  </Button>
                  <Button
                    className="flex-1"
                    variant="secondary"
                    onClick={() => openForm(appt)}
                  >
                    Record payment
                  </Button>
                </div>
              )}

              {isCheckingOut && (
                <div className="mt-3 pt-3 border-t border-light-tan">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-sans text-[12px] font-semibold text-dark-brown uppercase tracking-[0.6px]">
                      Charging in Square
                    </p>
                    <button
                      type="button"
                      onClick={() => setCheckoutFor(null)}
                      className="font-sans text-[14px] font-semibold text-text-brown cursor-pointer"
                    >
                      Close
                    </button>
                  </div>

                  <dl className="font-sans text-[15px] mb-3">
                    <div className="flex justify-between py-0.5">
                      <dt className="text-muted">
                        {appt.service_name}
                        {appt.has_removal ? " + removal" : ""}
                      </dt>
                      <dd className="text-charcoal tabular-nums">
                        {money(balance)}
                      </dd>
                    </div>
                    {Object.entries(cart).map(([id, qty]) => {
                      const item = addOns.find((a) => a.id === id);
                      if (!item) return null;
                      return (
                        <div key={id} className="flex justify-between py-0.5">
                          <dt className="text-muted">
                            {item.name}
                            {qty > 1 ? ` × ${qty}` : ""}
                          </dt>
                          <dd className="text-charcoal tabular-nums">
                            {money((item.priceCents * qty) / 100)}
                          </dd>
                        </div>
                      );
                    })}
                    <div className="flex justify-between py-1 mt-1 border-t border-light-tan font-semibold">
                      <dt className="text-dark-brown">Total</dt>
                      <dd className="text-dark-brown tabular-nums">
                        {money(chargeTotal)}
                      </dd>
                    </div>
                  </dl>

                  {/* Extras come straight from her Square library, so a price
                      she changes in Square is the price charged here. */}
                  <p className="font-sans text-[12px] font-semibold text-dark-brown mb-2">
                    Add anything else
                  </p>

                  {addOnsLoading && (
                    <p className="font-sans text-[14px] text-muted animate-pulse">
                      Loading your Square library…
                    </p>
                  )}
                  {addOnsError && (
                    <p className="font-sans text-[14px] text-danger">
                      {addOnsError}
                    </p>
                  )}

                  {addOns.length > 0 && (
                    <>
                      <input
                        value={addOnSearch}
                        onChange={(e) => setAddOnSearch(e.target.value)}
                        placeholder="Search — lash care kit, removal…"
                        className="w-full h-control box-border bg-white border border-light-tan rounded-control px-3 text-[16px] md:text-[14px] text-charcoal font-sans placeholder:text-muted focus:border-deep-brown transition-colors mb-2"
                      />
                      <div className="max-h-56 overflow-y-auto rounded-control border border-light-tan">
                        {visibleAddOns.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between gap-2 px-3 py-2 border-b border-light-tan last:border-b-0"
                          >
                            <div className="min-w-0">
                              <p className="font-sans text-[15px] text-charcoal truncate">
                                {item.name}
                              </p>
                              <p className="font-sans text-[12px] text-muted tabular-nums">
                                {money(item.priceCents / 100)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {cart[item.id] ? (
                                <>
                                  <button
                                    type="button"
                                    aria-label={`One fewer ${item.name}`}
                                    onClick={() => bumpAddOn(item.id, -1)}
                                    className="w-9 h-9 rounded-control border border-light-tan font-sans text-[18px] text-charcoal cursor-pointer"
                                  >
                                    −
                                  </button>
                                  <span className="font-sans text-[15px] font-semibold text-dark-brown tabular-nums w-4 text-center">
                                    {cart[item.id]}
                                  </span>
                                </>
                              ) : null}
                              <button
                                type="button"
                                aria-label={`Add ${item.name}`}
                                onClick={() => bumpAddOn(item.id, 1)}
                                className="w-9 h-9 rounded-control border border-light-tan font-sans text-[18px] text-charcoal cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        ))}
                        {visibleAddOns.length === 0 && (
                          <p className="font-sans text-[14px] text-muted px-3 py-3">
                            Nothing in your library matches that.
                          </p>
                        )}
                      </div>
                    </>
                  )}

                  {checkoutError && (
                    <p className="font-sans text-[14px] text-danger mt-2">
                      {checkoutError}
                    </p>
                  )}

                  <Button
                    className="w-full mt-3"
                    size="lg"
                    onClick={() => chargeInSquare(appt)}
                    disabled={handingOver || chargeTotal <= 0}
                  >
                    {handingOver
                      ? "Opening Square…"
                      : `Charge ${money(chargeTotal)} in Square`}
                  </Button>
                  <p className="font-sans text-[12px] text-muted mt-2 text-center">
                    Opens the Square app with the amount and {appt.client_name.split(" ")[0]} already on it.
                  </p>
                </div>
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

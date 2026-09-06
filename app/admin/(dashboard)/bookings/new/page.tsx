"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { to12Hour, todayISO } from "@/lib/schedule";

/**
 * Booking a client in herself.
 *
 * The screen this replaces was Acuity on her phone, usually with the client
 * still in the chair: the refill is agreed out loud, the deposit is Zelled
 * across on the spot, and the next appointment has to be written down before
 * anyone forgets. So it is one scrolling page with no steps to page through,
 * every control a thumb-sized tap target, and nothing required that she would
 * have to go and look up.
 *
 * The deposit block is the part the client checkout has no equivalent for.
 * Money that arrived by Zelle, Apple Cash or an invoice she texted is real
 * money, and until now the site had nowhere to put it — a booking either had
 * a Square charge behind it or was marked "paying cash on the day", which for
 * a client who has already paid is simply the wrong record.
 */

interface ClientRow {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  visit_count: number;
}

interface ServiceRow {
  id: string;
  name: string;
  price: number;
  deposit_amount: number;
  duration_minutes: number;
  category: string;
}

type Method = "zelle" | "cash" | "square" | "apple_cash" | "venmo" | "invoice" | "other";

const METHODS: { value: Method; label: string }[] = [
  { value: "zelle", label: "Zelle" },
  { value: "apple_cash", label: "Apple Cash" },
  { value: "venmo", label: "Venmo" },
  { value: "cash", label: "Cash" },
  { value: "square", label: "Card" },
  { value: "invoice", label: "Invoice" },
  { value: "other", label: "Other" },
];

const SOURCES = ["Instagram DM", "Text", "In person", "Phone"];

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

function formatDuration(mins: number) {
  const hrs = Math.floor(mins / 60);
  const m = mins % 60;
  if (hrs && m) return `${hrs} hr ${m} min`;
  if (hrs) return `${hrs} hr`;
  return `${m} min`;
}

/** Shared look for the tappable chips this page is mostly made of. */
function chipClass(active: boolean) {
  return `h-control shrink-0 box-border inline-flex items-center justify-center px-4 rounded-control text-[14px] font-semibold font-sans whitespace-nowrap transition-colors cursor-pointer border-2 ${
    active
      ? "bg-text-brown text-white border-transparent"
      : "bg-white text-charcoal border-light-tan hover:bg-light-tan"
  }`;
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-surface shadow-[0_1px_4px_rgba(0,0,0,0.06)] p-4 sm:p-5">
      <h2 className="font-display text-[18px] font-bold text-dark-brown">
        {title}
      </h2>
      {hint && (
        <p className="font-sans text-[12px] text-muted mt-1 mb-3">{hint}</p>
      )}
      <div className={hint ? "" : "mt-3"}>{children}</div>
    </section>
  );
}

export default function NewBookingPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [clients, setClients] = useState<ClientRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [removalPrice, setRemovalPrice] = useState(0);
  const [loading, setLoading] = useState(true);

  // Client
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null);
  const [newClient, setNewClient] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // Appointment
  const [serviceId, setServiceId] = useState("");
  const [hasRemoval, setHasRemoval] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [timeSlot, setTimeSlot] = useState("");
  const [manualTime, setManualTime] = useState("");
  const [showManual, setShowManual] = useState(false);

  // Money and notes
  const [depositPaid, setDepositPaid] = useState(true);
  const [depositMethod, setDepositMethod] = useState<Method>("zelle");
  const [depositAmount, setDepositAmount] = useState("");
  const [note, setNote] = useState("");
  const [source, setSource] = useState("");
  const [sendConfirmation, setSendConfirmation] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const service = services.find((s) => s.id === serviceId) || null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [clientsRes, servicesRes, settingsRes] = await Promise.all([
        supabase
          .from("clients")
          .select("id, full_name, email, phone, visit_count")
          .order("full_name"),
        supabase
          .from("services")
          .select("id, name, price, deposit_amount, duration_minutes, category")
          .eq("is_active", true)
          .order("sort_order"),
        // The removal price is hers to set in Settings. Read rather than
        // assumed: a figure hardcoded here would quietly disagree with the
        // total the server records the moment she changes it.
        supabase.from("settings").select("key, value").eq("key", "removal_price"),
      ]);
      if (cancelled) return;
      setClients((clientsRes.data as ClientRow[]) || []);
      setServices((servicesRes.data as ServiceRow[]) || []);
      setRemovalPrice(Number(settingsRes.data?.[0]?.value ?? 0));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // The deposit box follows the service until she types her own figure, at
  // which point it stops moving under her.
  const [depositTouched, setDepositTouched] = useState(false);
  useEffect(() => {
    if (service && !depositTouched) {
      setDepositAmount(Number(service.deposit_amount).toFixed(2));
    }
  }, [service, depositTouched]);

  const loadSlots = useCallback(async () => {
    if (!serviceId || !date) {
      setSlots([]);
      return;
    }
    setSlotsLoading(true);
    try {
      const res = await fetch(
        `/api/availability?date=${date}&serviceId=${serviceId}${
          hasRemoval ? "&removal=1" : ""
        }`
      );
      const json = await res.json();
      setSlots(res.ok ? json.slots || [] : []);
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, [serviceId, date, hasRemoval]);

  useEffect(() => {
    loadSlots();
    // A time chosen for one date or service means nothing on the next.
    setTimeSlot("");
  }, [loadSlots]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    const digits = q.replace(/[^0-9]/g, "");
    return clients
      .filter((c) => {
        if (c.full_name.toLowerCase().includes(q)) return true;
        if (c.email && c.email.toLowerCase().includes(q)) return true;
        if (digits.length >= 3 && c.phone) {
          return c.phone.replace(/[^0-9]/g, "").includes(digits);
        }
        return false;
      })
      .slice(0, 8);
  }, [clients, search]);

  const total = service
    ? Number(service.price) + (hasRemoval ? removalPrice : 0)
    : 0;
  const depositValue = depositPaid ? Number(depositAmount || 0) : 0;
  const balance = Math.max(0, total - depositValue);

  const chosenTime = showManual && manualTime ? to12Hour(manualTime) : timeSlot;

  const ready =
    Boolean(serviceId) &&
    Boolean(date) &&
    Boolean(chosenTime) &&
    (selectedClient !== null || (newClient && fullName.trim().length > 0));

  const submit = async () => {
    if (!ready || saving) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/create-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClient?.id ?? null,
          fullName: selectedClient ? undefined : fullName.trim(),
          email: selectedClient ? undefined : email.trim() || null,
          phone: selectedClient ? undefined : phone.trim() || null,
          serviceId,
          hasRemoval,
          bookingDate: date,
          timeSlot: chosenTime,
          depositPaid,
          depositMethod,
          depositAmount: depositPaid
            ? Number(depositAmount || 0)
            : undefined,
          note: note.trim() || null,
          bookingSource: source || null,
          sendConfirmation,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.message || json.error || "Could not save that appointment.");
        setSaving(false);
        return;
      }

      router.push(`/admin/bookings/${json.bookingId}`);
    } catch {
      setError("Could not reach the server. Check your signal and try again.");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <p className="font-sans text-[16px] text-muted animate-pulse">
        Loading…
      </p>
    );
  }

  return (
    <div className="pb-28">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-[28px] font-bold text-dark-brown">
          New appointment
        </h1>
        <Link
          href="/admin/bookings"
          className="font-sans text-[14px] text-text-brown font-semibold"
        >
          Cancel
        </Link>
      </div>

      <div className="flex flex-col gap-4">
        {/* ── Client ─────────────────────────────────────────────────── */}
        <Section
          title="Who"
          hint="Search anyone you've seen before, or add someone new."
        >
          {selectedClient ? (
            <div className="flex items-center justify-between gap-3 bg-cream rounded-control px-4 py-3">
              <div className="min-w-0">
                <p className="font-sans text-[16px] font-semibold text-dark-brown truncate">
                  {selectedClient.full_name}
                </p>
                <p className="font-sans text-[12px] text-muted truncate">
                  {selectedClient.visit_count > 0
                    ? `${selectedClient.visit_count} visits`
                    : "First visit"}
                  {selectedClient.email ? ` · ${selectedClient.email}` : ""}
                  {!selectedClient.email ? " · no email on file" : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedClient(null);
                  setSearch("");
                }}
                className="shrink-0 font-sans text-[14px] font-semibold text-text-brown cursor-pointer"
              >
                Change
              </button>
            </div>
          ) : newClient ? (
            <div className="flex flex-col gap-3">
              <Input
                label="Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full name"
                autoCapitalize="words"
              />
              <Input
                label="Phone"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(407) 555-0100"
              />
              <Input
                label="Email"
                type="email"
                inputMode="email"
                autoCapitalize="none"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Needed for her confirmation and reminders"
              />
              <button
                type="button"
                onClick={() => setNewClient(false)}
                className="self-start font-sans text-[14px] font-semibold text-text-brown cursor-pointer"
              >
                ← Search existing clients instead
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, phone or email"
                autoCapitalize="words"
              />
              {matches.length > 0 && (
                <div className="rounded-control border border-light-tan overflow-hidden">
                  {matches.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedClient(c)}
                      className="w-full text-left px-4 py-3 border-b border-light-tan last:border-b-0 hover:bg-cream transition-colors cursor-pointer"
                    >
                      <p className="font-sans text-[16px] font-semibold text-dark-brown truncate">
                        {c.full_name}
                      </p>
                      <p className="font-sans text-[12px] text-muted truncate">
                        {c.phone || "no phone"}
                        {c.email ? ` · ${c.email}` : ""}
                      </p>
                    </button>
                  ))}
                </div>
              )}
              {search.trim() && matches.length === 0 && (
                <p className="font-sans text-[14px] text-muted">
                  Nobody by that name.
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  setNewClient(true);
                  setFullName(search.trim());
                }}
                className="self-start font-sans text-[14px] font-semibold text-text-brown cursor-pointer"
              >
                + Add a new client
              </button>
            </div>
          )}
        </Section>

        {/* ── Service ────────────────────────────────────────────────── */}
        <Section title="What">
          <div className="flex flex-col gap-2">
            {services.map((s) => {
              const active = s.id === serviceId;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setServiceId(s.id)}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-control border-2 text-left transition-colors cursor-pointer ${
                    active
                      ? "border-text-brown bg-cream"
                      : "border-light-tan bg-white hover:bg-cream/60"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-sans text-[16px] font-semibold text-dark-brown truncate">
                      {s.name}
                    </p>
                    <p className="font-sans text-[12px] text-muted">
                      {formatDuration(s.duration_minutes)}
                    </p>
                  </div>
                  <span className="font-sans text-[16px] font-semibold text-charcoal shrink-0">
                    {money(Number(s.price))}
                  </span>
                </button>
              );
            })}
          </div>

          <label className="flex items-center gap-3 mt-4 cursor-pointer">
            <input
              type="checkbox"
              checked={hasRemoval}
              onChange={(e) => setHasRemoval(e.target.checked)}
              className="w-5 h-5 accent-[#805F45]"
            />
            <span className="font-sans text-[16px] text-charcoal">
              Add a lash removal
            </span>
          </label>
        </Section>

        {/* ── When ───────────────────────────────────────────────────── */}
        <Section title="When">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full h-control box-border bg-white border border-light-tan rounded-control px-3 text-[16px] md:text-[14px] text-charcoal font-sans focus:border-deep-brown transition-colors"
          />

          {!serviceId ? (
            <p className="font-sans text-[14px] text-muted mt-3">
              Pick a service to see open times.
            </p>
          ) : slotsLoading ? (
            <p className="font-sans text-[14px] text-muted mt-3 animate-pulse">
              Checking that day…
            </p>
          ) : (
            <div className="mt-3">
              {slots.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {slots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => {
                        setTimeSlot(slot);
                        setShowManual(false);
                      }}
                      className={chipClass(!showManual && timeSlot === slot)}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="font-sans text-[14px] text-muted">
                  Nothing open that day by your usual hours.
                </p>
              )}

              {/* Her diary beats the slot engine. Squeezing someone in outside
                  posted hours is a normal thing to do and the site should not
                  be the reason she can't. */}
              <button
                type="button"
                onClick={() => setShowManual((v) => !v)}
                className="mt-3 font-sans text-[14px] font-semibold text-text-brown cursor-pointer"
              >
                {showManual ? "← Use an open time" : "Set another time"}
              </button>

              {showManual && (
                <div className="mt-2">
                  <input
                    type="time"
                    value={manualTime}
                    onChange={(e) => setManualTime(e.target.value)}
                    step={300}
                    className="w-full h-control box-border bg-white border border-light-tan rounded-control px-3 text-[16px] md:text-[14px] text-charcoal font-sans focus:border-deep-brown transition-colors"
                  />
                  <p className="font-sans text-[12px] text-muted mt-1">
                    Books outside your posted hours. A time already taken is
                    still refused.
                  </p>
                </div>
              )}
            </div>
          )}
        </Section>

        {/* ── Deposit ────────────────────────────────────────────────── */}
        <Section
          title="Deposit"
          hint="For money already in hand — Zelle, Apple Cash, an invoice she's paid."
        >
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setDepositPaid(true)}
              className={chipClass(depositPaid)}
            >
              Already paid
            </button>
            <button
              type="button"
              onClick={() => setDepositPaid(false)}
              className={chipClass(!depositPaid)}
            >
              Not yet
            </button>
          </div>

          {depositPaid && (
            <>
              <div className="flex flex-wrap gap-2 mb-4">
                {METHODS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setDepositMethod(m.value)}
                    className={chipClass(depositMethod === m.value)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <Input
                label="How much"
                type="text"
                inputMode="decimal"
                value={depositAmount}
                onChange={(e) => {
                  setDepositTouched(true);
                  setDepositAmount(e.target.value.replace(/[^0-9.]/g, ""));
                }}
                placeholder="25.00"
              />
            </>
          )}

          {service && (
            <dl className="mt-4 border-t border-light-tan pt-3 font-sans text-[14px]">
              <div className="flex justify-between py-0.5">
                <dt className="text-muted">Service total</dt>
                <dd className="text-charcoal">{money(total)}</dd>
              </div>
              <div className="flex justify-between py-0.5">
                <dt className="text-muted">Deposit</dt>
                <dd className="text-charcoal">
                  {depositPaid ? `− ${money(depositValue)}` : "none"}
                </dd>
              </div>
              <div className="flex justify-between py-0.5 font-semibold">
                <dt className="text-dark-brown">Balance on the day</dt>
                <dd className="text-dark-brown">{money(balance)}</dd>
              </div>
            </dl>
          )}
        </Section>

        {/* ── Notes ──────────────────────────────────────────────────── */}
        <Section
          title="Anything to remember"
          hint="Goes on the calendar entry, where you'll actually see it."
        >
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Deposit sent by Zelle at her last refill"
            className="w-full box-border bg-white border border-light-tan rounded-control p-3 text-[16px] md:text-[14px] text-charcoal font-sans placeholder:text-muted focus:border-deep-brown transition-colors resize-y"
          />

          <p className="font-sans text-[12px] font-semibold text-dark-brown mt-4 mb-2">
            Where it came from
          </p>
          <div className="flex flex-wrap gap-2">
            {SOURCES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSource(source === s ? "" : s)}
                className={chipClass(source === s)}
              >
                {s}
              </button>
            ))}
          </div>

          <label className="flex items-start gap-3 mt-5 cursor-pointer">
            <input
              type="checkbox"
              checked={sendConfirmation}
              onChange={(e) => setSendConfirmation(e.target.checked)}
              className="w-5 h-5 mt-0.5 accent-[#805F45]"
            />
            <span className="font-sans text-[16px] text-charcoal">
              Email her the confirmation
              <span className="block text-[12px] text-muted">
                Her two reminders go out either way.
              </span>
            </span>
          </label>
        </Section>

        {error && (
          <p
            role="alert"
            className="font-sans text-[14px] text-danger bg-white rounded-surface px-4 py-3"
          >
            {error}
          </p>
        )}
      </div>

      {/* Pinned, because the form is longer than a phone screen and the thing
          she came here to do should never be somewhere she has to scroll to
          find. */}
      <div className="fixed left-0 right-0 bottom-[64px] md:bottom-0 md:left-[240px] bg-cream/95 backdrop-blur border-t border-light-tan px-4 py-3 z-30">
        <Button
          size="lg"
          className="w-full"
          onClick={submit}
          disabled={!ready || saving}
        >
          {saving
            ? "Saving…"
            : chosenTime && date
            ? `Book ${chosenTime}`
            : "Book appointment"}
        </Button>
      </div>
    </div>
  );
}

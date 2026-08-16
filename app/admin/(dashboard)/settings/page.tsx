"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { PushNotifications } from "@/components/admin/PushNotifications";
import { GoogleCalendarConnection } from "@/components/admin/GoogleCalendarConnection";

// Keys as they exist in the settings table. buffer_minutes and
// advance_booking_hours are the two the slot generator actually reads
// (app/api/availability/route.ts) — the rest are stored for reference.
const FIELDS = [
  {
    key: "buffer_minutes",
    label: "Buffer time between appointments (minutes)",
    type: "number",
    fallback: "15",
  },
  {
    key: "advance_booking_hours",
    label: "Minimum advance booking time (hours)",
    type: "number",
    fallback: "24",
  },
  {
    key: "max_advance_days",
    label: "Maximum advance booking (days)",
    type: "number",
    fallback: "60",
  },
  { key: "business_name", label: "Business Name", type: "text", fallback: "VIS Lashes" },
  { key: "business_email", label: "Business Email", type: "email", fallback: "" },
  { key: "business_phone", label: "Business Phone", type: "tel", fallback: "" },
  // Shown on the client's confirmation page. Both are left blank rather than
  // guessed — the confirmation simply omits whichever is empty, so a wrong
  // address is never displayed to someone about to drive to it.
  {
    key: "business_address",
    label: "Studio Address (shown on confirmations)",
    type: "text",
    fallback: "",
  },
  {
    key: "lash_artist",
    label: "Lash Artist (shown on confirmations)",
    type: "text",
    fallback: "",
  },
] as const;

type Values = Record<string, string>;

interface ServiceDeposit {
  id: string;
  name: string;
  price: number;
}

function DepositSection() {
  const [amount, setAmount] = useState("");
  const [services, setServices] = useState<ServiceDeposit[]>([]);
  const [varies, setVaries] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const supabase = createClient();

  const fetchDeposit = useCallback(async () => {
    const { data, error } = await supabase
      .from("services")
      .select("id, name, price, deposit_amount");

    if (error) {
      setLoadError(error.message);
      setLoading(false);
      return;
    }

    const rows = data || [];
    setServices(rows.map((r) => ({ id: r.id, name: r.name, price: Number(r.price) })));

    // This is stored per service — a business decision worth keeping possible
    // later (a smaller deposit on refills, say) — but today every service is
    // meant to charge the same amount, so this control edits all of them at
    // once rather than sending her into Services six times.
    const distinct = Array.from(new Set(rows.map((r) => Number(r.deposit_amount))));
    if (distinct.length === 1) {
      setAmount(distinct[0].toFixed(2));
      setVaries(false);
    } else {
      setAmount("");
      setVaries(distinct.length > 1);
    }

    setLoadError(null);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchDeposit();
  }, [fetchDeposit]);

  const parsed = Number(amount);
  const isValid = amount.trim() !== "" && Number.isFinite(parsed) && parsed >= 0;
  // Warned, not blocked: a deposit equal to or above a service's price is a
  // real choice — it just means that service is paid in full at booking
  // rather than partially.
  const exceeds = isValid
    ? services.filter((s) => parsed >= s.price)
    : [];

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValid) {
      setSaveError("Enter a valid deposit amount.");
      return;
    }

    setSaving(true);
    setSaveError(null);

    // No .eq() filter is deliberate — this is meant to reach every service,
    // including inactive ones, so a reactivated service can never surface the
    // stale amount from before this was last changed.
    const { error } = await supabase
      .from("services")
      .update({ deposit_amount: parsed })
      .not("id", "is", null);

    setSaving(false);

    if (error) {
      setSaveError(error.message);
      setSaved(false);
      return;
    }

    setSaveError(null);
    setSaved(true);
    setVaries(false);
    fetchDeposit();
  };

  return (
    <div className="bg-white rounded-surface p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] mb-6">
      <h2 className="font-display text-[18px] font-bold text-dark-brown mb-1">
        Deposit
      </h2>
      <p className="font-sans text-[13px] text-muted mb-4 max-w-[52ch]">
        Charged at booking to secure the appointment. Applies to every
        service, including inactive ones.
      </p>

      {loading ? (
        <div className="max-w-[220px]">
          <div className="h-[12px] w-[40%] rounded-control bg-light-tan/50 animate-pulse" />
          <div className="h-control w-full rounded-control bg-light-tan/70 animate-pulse mt-1.5" />
        </div>
      ) : loadError ? (
        <div>
          <p className="font-sans text-[14px] text-danger font-semibold">
            {loadError}
          </p>
          <Button
            variant="secondary"
            className="mt-3"
            onClick={() => {
              setLoading(true);
              setLoadError(null);
              fetchDeposit();
            }}
          >
            Retry
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSave}>
          <div className="max-w-[220px]">
            <Input
              id="deposit_amount"
              label="Deposit Amount ($)"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder={varies ? "Varies by service" : undefined}
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setSaved(false);
              }}
            />
          </div>

          {varies && !amount && (
            <p className="font-sans text-[13px] text-charcoal mt-2 max-w-[52ch]">
              Services currently charge different deposits. Enter one amount
              and Save to make them all match.
            </p>
          )}

          {exceeds.length > 0 && (
            <p className="font-sans text-[13px] text-deep-brown mt-2 max-w-[52ch]">
              ${parsed.toFixed(2)} covers the full price of{" "}
              {exceeds.map((s) => s.name).join(", ")} — that service will be
              paid in full at booking, with nothing due at the appointment.
            </p>
          )}

          <div className="flex items-center gap-3 mt-3">
            <Button type="submit" disabled={saving || !isValid}>
              {saving ? "Saving..." : "Save Deposit"}
            </Button>
            {saved && !saveError && (
              <span className="text-success text-[14px] font-sans font-semibold">
                ✓ Saved
              </span>
            )}
            {saveError && (
              <span
                role="alert"
                className="text-danger text-[14px] font-sans font-semibold"
              >
                {saveError}
              </span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const [values, setValues] = useState<Values>(() =>
    Object.fromEntries(FIELDS.map((f) => [f.key, f.fallback]))
  );
  const [rowIds, setRowIds] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const supabase = createClient();

  const fetchSettings = useCallback(async () => {
    const { data, error } = await supabase
      .from("settings")
      .select("id, key, value");

    if (error) {
      // Previously the page rendered hardcoded numbers with no fetch at all, so
      // it could confidently display a buffer that booking was not enforcing.
      setLoadError(error.message);
      setLoading(false);
      return;
    }

    const byKey = Object.fromEntries((data || []).map((r) => [r.key, r]));
    setValues(
      Object.fromEntries(
        FIELDS.map((f) => [f.key, byKey[f.key]?.value ?? f.fallback])
      )
    );
    setRowIds(
      Object.fromEntries(
        (data || []).map((r) => [r.key as string, r.id as string])
      )
    );
    setLoadError(null);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setSaveError(null);

    for (const field of FIELDS) {
      const value = values[field.key] ?? "";

      // Update by id when the row exists, insert when it doesn't — rather than
      // upserting, which would depend on a unique constraint on `key` that
      // can't be verified from here.
      const existingId = rowIds[field.key];
      const { error } = existingId
        ? await supabase.from("settings").update({ value }).eq("id", existingId)
        : await supabase.from("settings").insert({ key: field.key, value });

      if (error) {
        setSaveError(error.message);
        setSaving(false);
        setSaved(false);
        return;
      }
    }

    setSaving(false);
    setSaved(true);
    fetchSettings();
  };

  if (loading) {
    return (
      <div>
        <h1 className="font-display text-[28px] font-bold text-dark-brown mb-6">
          Settings
        </h1>
        <div className="bg-white rounded-surface p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex flex-col gap-4 max-w-sm">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <div className="h-[12px] w-[55%] rounded-control bg-light-tan/50 animate-pulse" />
              <div className="h-control w-full rounded-control bg-light-tan/70 animate-pulse mt-1.5" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div>
        <h1 className="font-display text-[28px] font-bold text-dark-brown mb-6">
          Settings
        </h1>
        <div className="bg-white rounded-surface p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <p className="font-sans text-[16px] text-danger font-semibold">
            Couldn&apos;t load settings
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
              fetchSettings();
            }}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const scheduling = FIELDS.filter((f) => f.type === "number");
  const business = FIELDS.filter((f) => f.type !== "number");

  return (
    <div>
      <h1 className="font-display text-[28px] font-bold text-dark-brown mb-6">
        Settings
      </h1>

      <PushNotifications />

      <DepositSection />

      <form onSubmit={handleSave}>
        <div className="bg-white rounded-surface p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] mb-6">
          <h2 className="font-display text-[18px] font-bold text-dark-brown mb-4">
            Scheduling
          </h2>
          <div className="flex flex-col gap-4 max-w-sm">
            {scheduling.map((field) => (
              <Input
                key={field.key}
                id={field.key}
                label={field.label}
                type="number"
                inputMode="numeric"
                value={values[field.key] ?? ""}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [field.key]: e.target.value }))
                }
              />
            ))}
          </div>
        </div>

        <div className="bg-white rounded-surface p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] mb-6">
          <h2 className="font-display text-[18px] font-bold text-dark-brown mb-4">
            Business Information
          </h2>
          <div className="flex flex-col gap-4 max-w-sm">
            {business.map((field) => (
              <Input
                key={field.key}
                id={field.key}
                label={field.label}
                type={field.type}
                value={values[field.key] ?? ""}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [field.key]: e.target.value }))
                }
              />
            ))}
          </div>
        </div>

        <GoogleCalendarConnection />

        <div className="flex items-center gap-3 flex-wrap">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save All Settings"}
          </Button>
          {saved && !saveError && (
            <span className="text-success text-[16px] font-sans font-semibold">
              ✓ Saved
            </span>
          )}
          {saveError && (
            <span
              role="alert"
              className="text-danger text-[16px] font-sans font-semibold"
            >
              Couldn&apos;t save — {saveError}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

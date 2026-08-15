"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { PushNotificationSetup } from "@/components/admin/PushNotificationSetup";

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
] as const;

type Values = Record<string, string>;

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
    <form onSubmit={handleSave}>
      <h1 className="font-display text-[28px] font-bold text-dark-brown mb-6">
        Settings
      </h1>

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

      <PushNotificationSetup />

      {/* Google Calendar
          There is no Google Calendar integration in this codebase — no OAuth
          flow, no sync route, and nothing reads a GOOGLE_* variable. This panel
          used to render a Connect button that flipped a local boolean and then
          displayed a green "Connected" dot, so the salon could believe
          appointments were syncing to a phone calendar while nothing was.
          Stating the truth is worth more than a control that pretends. */}
      <div className="bg-white rounded-surface p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] mb-6">
        <h2 className="font-display text-[18px] font-bold text-dark-brown mb-4">
          Google Calendar
        </h2>
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="w-3 h-3 rounded-full bg-muted mt-1.5 shrink-0"
          />
          <div>
            <p className="font-sans text-[16px] text-charcoal">
              Not available yet
            </p>
            <p className="font-sans text-[16px] text-muted leading-[1.5] mt-1 max-w-[46ch]">
              Appointments live in the Bookings and Calendar tabs here. They do
              not sync to Google Calendar — that integration has not been built.
            </p>
          </div>
        </div>
      </div>

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
  );
}

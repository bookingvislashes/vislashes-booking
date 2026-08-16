"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { WeeklyHourRow } from "@/lib/schedule";

const dayNames = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

interface WeeklyHoursPanelProps {
  /** Every weekday row, active or not, from the calendar page's single fetch. */
  rows: WeeklyHourRow[];
  onSaved: () => void | Promise<void>;
}

/**
 * The recurring week — the hours a date falls back on when it has no override
 * of its own. The calendar above overrides single dates; this sets the default.
 *
 * Controlled rather than self-fetching. The page already loads these alongside
 * the schedule, and a second fetch-on-mount here would add another instance of
 * the admin's set-state-in-effect pattern for no benefit. Local state holds the
 * in-progress edit only; the page remounts this component (via a key derived
 * from the rows) whenever the saved data actually changes.
 */
export function WeeklyHoursPanel({ rows, onSaved }: WeeklyHoursPanelProps) {
  const [hours, setHours] = useState<WeeklyHourRow[]>(() =>
    dayNames.map((_, i) => {
      const row = rows.find((r) => r.dayOfWeek === i);
      return (
        row ?? { dayOfWeek: i, startTime: "", endTime: "", isActive: false }
      );
    })
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const supabase = createClient();

  const updateHours = (
    index: number,
    field: keyof WeeklyHourRow,
    value: string | boolean
  ) => {
    setHours((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
    setSaved(false);
  };

  const saveHours = async () => {
    setSaving(true);
    for (const h of hours) {
      const payload = {
        day_of_week: h.dayOfWeek,
        start_time: h.startTime || "09:00",
        end_time: h.endTime || "17:00",
        is_active: h.isActive,
      };

      // Every write's error was discarded and "✓ Saved" shown unconditionally,
      // so a total failure looked exactly like a success.
      const { error } = h.id
        ? await supabase.from("availability").update(payload).eq("id", h.id)
        : await supabase
            .from("availability")
            .upsert({ ...payload }, { onConflict: "day_of_week" });

      if (error) {
        setSaveError(error.message);
        setSaved(false);
        setSaving(false);
        return;
      }
    }
    setSaveError(null);
    setSaved(true);
    setSaving(false);
    await onSaved();
  };

  return (
    <div className="bg-white rounded-surface p-4 sm:p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
      <h2 className="font-display text-[18px] font-bold text-dark-brown mb-1">
        Usual Weekly Hours
      </h2>
      <p className="font-sans text-[13px] text-muted mb-4 max-w-[52ch]">
        Your normal week. Any date you edit on the calendar above uses its own
        hours instead of these.
      </p>

      <div className="flex flex-col gap-3">
        {hours.map((day, i) => (
          <div key={day.dayOfWeek} className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 w-28 cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={day.isActive}
                onChange={(e) => updateHours(i, "isActive", e.target.checked)}
                className="accent-deep-brown w-4 h-4"
              />
              <span className="font-sans text-[16px] text-charcoal font-semibold">
                {dayNames[day.dayOfWeek]}
              </span>
            </label>
            {day.isActive && (
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={day.startTime}
                  onChange={(e) => updateHours(i, "startTime", e.target.value)}
                  aria-label={`${dayNames[day.dayOfWeek]} opening time`}
                  className="bg-white border border-light-tan rounded-control px-2 py-1.5 text-[16px] font-sans focus:outline-none focus:border-deep-brown"
                />
                <span className="text-muted text-[16px]">to</span>
                <input
                  type="time"
                  value={day.endTime}
                  onChange={(e) => updateHours(i, "endTime", e.target.value)}
                  aria-label={`${dayNames[day.dayOfWeek]} closing time`}
                  className="bg-white border border-light-tan rounded-control px-2 py-1.5 text-[16px] font-sans focus:outline-none focus:border-deep-brown"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-4 flex-wrap">
        <Button onClick={saveHours} disabled={saving}>
          {saving ? "Saving..." : "Save Hours"}
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
            Couldn&apos;t save hours — {saveError}
          </span>
        )}
      </div>
    </div>
  );
}

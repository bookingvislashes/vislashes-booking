"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

interface WeeklyHours {
  id?: string;
  day: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

interface BlockedDateRow {
  id: string;
  date: string;
  reason: string | null;
}

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function CalendarPage() {
  const [hours, setHours] = useState<WeeklyHours[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDateRow[]>([]);
  const [newBlockedDate, setNewBlockedDate] = useState("");
  const [newBlockedReason, setNewBlockedReason] = useState("");
  const [loadingHours, setLoadingHours] = useState(true);
  const [loadingBlocked, setLoadingBlocked] = useState(true);
  const [savingHours, setSavingHours] = useState(false);
  const [addingBlock, setAddingBlock] = useState(false);
  const [hoursSaved, setHoursSaved] = useState(false);
  // Kept apart on purpose: a load failure means there is nothing safe to save,
  // while a save failure must leave the button available to retry.
  const [hoursError, setHoursError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const supabase = createClient();

  // Fetch weekly hours from Supabase
  const fetchHours = useCallback(async () => {
    setLoadingHours(true);
    const { data, error } = await supabase
      .from("availability")
      .select("*")
      .order("day_of_week", { ascending: true });

    if (error) {
      // This used to substitute an invented Mon-Fri 09:00-17:00 week, which
      // rendered indistinguishably from real data — and Save would then write
      // that fiction over the salon's actual hours. Wrong opening hours drive
      // wrong booking availability, so failing visibly is the only safe
      // behaviour here.
      console.error("Failed to fetch hours:", error);
      setHoursError(error.message);
      setHours([]);
      setLoadingHours(false);
      return;
    } else {
      setHoursError(null);
      setHours(
        dayNames.map((day, i) => {
          const row = (data || []).find((r) => r.day_of_week === i);
          return {
            id: row?.id,
            day,
            dayOfWeek: i,
            startTime: row?.start_time?.slice(0, 5) || "",
            endTime: row?.end_time?.slice(0, 5) || "",
            isActive: row?.is_active ?? false,
          };
        })
      );
    }
    setLoadingHours(false);
  }, [supabase]);

  // Fetch blocked dates from Supabase
  const fetchBlockedDates = useCallback(async () => {
    setLoadingBlocked(true);
    const { data, error } = await supabase
      .from("blocked_dates")
      .select("*")
      .gte("date", new Date().toISOString().split("T")[0])
      .order("date", { ascending: true });

    if (error) {
      console.error("Failed to fetch blocked dates:", error);
    } else {
      setBlockedDates(data || []);
    }
    setLoadingBlocked(false);
  }, [supabase]);

  useEffect(() => {
    fetchHours();
    fetchBlockedDates();
  }, [fetchHours, fetchBlockedDates]);

  const updateHours = (index: number, field: keyof WeeklyHours, value: string | boolean) => {
    setHours((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
    setHoursSaved(false);
  };

  const saveHours = async () => {
    setSavingHours(true);
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
        setHoursSaved(false);
        setSavingHours(false);
        return;
      }
    }
    setSaveError(null);
    setHoursSaved(true);
    setSavingHours(false);
    // Re-fetch to get IDs for any new rows
    fetchHours();
  };

  const addBlockedDate = async () => {
    if (!newBlockedDate) return;
    setAddingBlock(true);

    const { error } = await supabase.from("blocked_dates").insert({
      date: newBlockedDate,
      reason: newBlockedReason || null,
    });

    if (error) {
      console.error("Failed to block date:", error);
    } else {
      setNewBlockedDate("");
      setNewBlockedReason("");
      fetchBlockedDates();
    }
    setAddingBlock(false);
  };

  const removeBlockedDate = async (id: string) => {
    const { error } = await supabase.from("blocked_dates").delete().eq("id", id);
    if (error) {
      console.error("Failed to remove blocked date:", error);
    } else {
      setBlockedDates((prev) => prev.filter((b) => b.id !== id));
    }
  };

  const formatBlockedDate = (date: string) => {
    return new Date(date + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div>
      <h1 className="font-display text-[28px] font-bold text-dark-brown mb-6">
        Availability
      </h1>

      {/* Weekly Hours */}
      <div className="bg-white rounded-surface p-4 sm:p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] mb-8">
        <h2 className="font-display text-[18px] font-bold text-dark-brown mb-4">
          Weekly Hours
        </h2>

        {loadingHours ? (
          // Seven placeholder rows matching the real geometry, so the panel
          // doesn't jump height when the data lands.
          <div className="flex flex-col gap-3">
            {dayNames.map((day) => (
              <div key={day} className="flex items-center gap-3">
                <div className="h-5 w-28 rounded-control bg-light-tan/70 animate-pulse shrink-0" />
                <div className="h-control-sm flex-1 max-w-[220px] rounded-control bg-light-tan/50 animate-pulse" />
              </div>
            ))}
          </div>
        ) : hoursError ? (
          <div className="py-6 text-center">
            <p className="font-sans text-[14px] text-danger font-semibold">
              Couldn&apos;t load your hours
            </p>
            <p className="font-sans text-[13px] text-muted mt-1 leading-[1.5]">
              {hoursError}
            </p>
            <Button
              variant="secondary"
              onClick={() => {
                setHoursError(null);
                fetchHours();
              }}
              className="mt-3"
            >
              Retry
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {hours.map((day, i) => (
              <div key={day.day} className="flex items-center gap-3 flex-wrap">
                <label className="flex items-center gap-2 w-28 cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={day.isActive}
                    onChange={(e) => updateHours(i, "isActive", e.target.checked)}
                    className="accent-deep-brown w-4 h-4"
                  />
                  <span className="font-sans text-[13px] text-charcoal font-semibold">
                    {day.day}
                  </span>
                </label>
                {day.isActive && (
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={day.startTime}
                      onChange={(e) => updateHours(i, "startTime", e.target.value)}
                      className="bg-white border border-light-tan rounded-control px-2 py-1.5 text-[13px] font-sans focus:outline-none focus:border-deep-brown"
                    />
                    <span className="text-muted text-[13px]">to</span>
                    <input
                      type="time"
                      value={day.endTime}
                      onChange={(e) => updateHours(i, "endTime", e.target.value)}
                      className="bg-white border border-light-tan rounded-control px-2 py-1.5 text-[13px] font-sans focus:outline-none focus:border-deep-brown"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Hidden while hours failed to load — there is nothing trustworthy to
            save, and pressing it would overwrite real rows with an empty set. */}
        {!hoursError && (
          <div className="flex items-center gap-3 mt-4 flex-wrap">
            <Button onClick={saveHours} disabled={savingHours || loadingHours}>
              {savingHours ? "Saving..." : "Save Hours"}
            </Button>
            {hoursSaved && !saveError && (
              <span className="text-success text-[13px] font-sans font-semibold">
                ✓ Saved
              </span>
            )}
            {saveError && (
              <span
                role="alert"
                className="text-danger text-[13px] font-sans font-semibold"
              >
                Couldn&apos;t save hours — {saveError}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Blocked Dates */}
      <div className="bg-white rounded-surface p-4 sm:p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
        <h2 className="font-display text-[18px] font-bold text-dark-brown mb-4">
          Blocked Dates
        </h2>
        <p className="font-sans text-[13px] text-muted mb-4">
          Block off days when you&apos;re unavailable. Clients won&apos;t be able to book on these dates.
        </p>

        <div className="flex flex-wrap gap-3 mb-4">
          <Input
            type="date"
            value={newBlockedDate}
            onChange={(e) => setNewBlockedDate(e.target.value)}
            className="w-auto"
            min={new Date().toISOString().split("T")[0]}
          />
          <Input
            placeholder="Reason (optional)"
            value={newBlockedReason}
            onChange={(e) => setNewBlockedReason(e.target.value)}
            className="w-auto flex-1 min-w-[140px]"
          />
          <Button size="sm" onClick={addBlockedDate} disabled={addingBlock || !newBlockedDate}>
            {addingBlock ? "Adding..." : "Block Date"}
          </Button>
        </div>

        {loadingBlocked ? (
          <p className="font-sans text-[14px] text-muted animate-pulse">
            Loading...
          </p>
        ) : blockedDates.length === 0 ? (
          <p className="font-sans text-[14px] text-muted">
            No dates blocked
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {blockedDates.map((bd) => (
              <div
                key={bd.id}
                className="flex items-center justify-between py-2.5 px-3 bg-cream rounded-control"
              >
                <div className="min-w-0">
                  <span className="font-sans text-[14px] text-charcoal font-semibold">
                    {formatBlockedDate(bd.date)}
                  </span>
                  {bd.reason && (
                    <span className="font-sans text-[13px] text-muted ml-2">
                      — {bd.reason}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => removeBlockedDate(bd.id)}
                  className="text-danger text-[18px] hover:text-red-700 cursor-pointer shrink-0 ml-2"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { MonthGrid } from "@/components/admin/calendar/MonthGrid";
import { DayEditor } from "@/components/admin/calendar/DayEditor";
import { WeeklyHoursPanel } from "@/components/admin/calendar/WeeklyHoursPanel";
import {
  ScheduleDay,
  addDays,
  dayState,
  fetchSchedule,
  formatLongDate,
  formatRange,
  formatShortDate,
  fromISO,
  monthGridRange,
  startOfWeek,
  todayISO,
  toISO,
  type WeeklyHourRow,
} from "@/lib/schedule";

type View = "month" | "week" | "day";

const VIEWS: { key: View; label: string }[] = [
  { key: "month", label: "Month" },
  { key: "week", label: "Week" },
  { key: "day", label: "Day" },
];

/** One day summarised, used by the week and day lists. */
function DaySummary({
  day,
  onEdit,
}: {
  day: ScheduleDay;
  onEdit: () => void;
}) {
  const state = dayState(day);

  return (
    <button
      type="button"
      onClick={onEdit}
      className="w-full text-left bg-white rounded-surface p-3 shadow-[0_1px_4px_rgba(0,0,0,0.06)] hover:bg-cream transition-colors"
    >
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <span className="font-sans text-[14px] font-bold text-dark-brown">
          {formatShortDate(day.date)}
        </span>
        <span
          className={`font-sans text-[12px] ${
            state === "closed" ? "text-danger font-semibold" : "text-muted"
          }`}
        >
          {day.window
            ? formatRange(day.window.start, day.window.end)
            : "Closed"}
          {day.hasOverride && day.window ? " (just today)" : ""}
        </span>
      </div>

      {day.bookings.length === 0 ? (
        <p className="font-sans text-[13px] text-muted">
          {state === "closed" ? "—" : "Nothing booked"}
        </p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {day.bookings.map((b) => (
            <li key={b.id} className="font-sans text-[13px] text-charcoal">
              <strong>{b.timeSlot}</strong>
              {b.client ? ` — ${b.client}` : ""}
              {b.service ? (
                <span className="text-muted"> · {b.service}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {day.blocks.length > 0 && (
        <p className="font-sans text-[12px] text-danger mt-1">
          {day.blocks.some((b) => b.start === null)
            ? "Blocked all day"
            : day.blocks
                .map((b) => formatRange(b.start!, b.end!))
                .join(", ") + " blocked"}
        </p>
      )}
    </button>
  );
}

export default function CalendarPage() {
  const [view, setView] = useState<View>("month");
  const [anchor, setAnchor] = useState<string>(todayISO());
  const [days, setDays] = useState<ScheduleDay[]>([]);
  const [weeklyHours, setWeeklyHours] = useState<WeeklyHourRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  // The range currently on screen. Comparing it to the range we want is what
  // tells us a fetch is outstanding, without setting any state synchronously
  // inside the effect — that is the admin's set-state-in-effect lint rule.
  const [loadedRange, setLoadedRange] = useState<string>("");

  const anchorDate = fromISO(anchor);

  const { from, to } = useMemo(() => {
    if (view === "month") {
      return monthGridRange(anchorDate.getFullYear(), anchorDate.getMonth());
    }
    if (view === "week") {
      const start = startOfWeek(anchor);
      return { from: start, to: addDays(start, 6) };
    }
    return { from: anchor, to: anchor };
  }, [view, anchor, anchorDate]);

  const rangeKey = `${from}..${to}`;
  const loading = loadedRange !== rangeKey && !error;

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const result = await fetchSchedule(from, to, signal);
        if (signal?.aborted) return;
        setDays(result.days);
        setWeeklyHours(result.weeklyHours);
        setLoadedRange(`${from}..${to}`);
        setError(null);
      } catch (err) {
        if (signal?.aborted) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Couldn't load the schedule.");
      }
    },
    [from, to]
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const refresh = useCallback(() => load(), [load]);

  const step = (direction: 1 | -1) => {
    setSelected(null);
    if (view === "month") {
      const d = fromISO(anchor);
      d.setDate(1);
      d.setMonth(d.getMonth() + direction);
      setAnchor(toISO(d));
    } else if (view === "week") {
      setAnchor(addDays(anchor, 7 * direction));
    } else {
      setAnchor(addDays(anchor, direction));
    }
  };

  const selectedDay = selected
    ? days.find((d) => d.date === selected) ?? null
    : null;

  // The day view edits in place; month and week open the same editor in a modal.
  const dayViewDay =
    view === "day" ? days.find((d) => d.date === anchor) ?? null : null;

  const heading =
    view === "month"
      ? anchorDate.toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        })
      : view === "week"
        ? `Week of ${formatShortDate(startOfWeek(anchor))}`
        : formatLongDate(anchor);

  return (
    <div>
      <h1 className="font-display text-[28px] font-bold text-dark-brown mb-4">
        Calendar
      </h1>

      <div className="bg-white rounded-surface p-4 sm:p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] mb-6">
        {/* View switcher */}
        <div
          role="tablist"
          aria-label="Calendar view"
          className="inline-flex bg-cream rounded-control p-1 mb-4"
        >
          {VIEWS.map((v) => (
            <button
              key={v.key}
              role="tab"
              aria-selected={view === v.key}
              onClick={() => {
                setView(v.key);
                setSelected(null);
              }}
              className={`font-sans text-[13px] font-semibold px-3 py-1.5 rounded-control transition-colors cursor-pointer ${
                view === v.key
                  ? "bg-deep-brown text-white"
                  : "text-charcoal hover:text-deep-brown"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* Period navigation */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => step(-1)}
            aria-label="Previous"
          >
            ‹
          </Button>
          <div className="text-center min-w-0">
            <p className="font-display text-[16px] font-bold text-dark-brown truncate">
              {heading}
            </p>
            {anchor !== todayISO() && (
              <button
                onClick={() => {
                  setAnchor(todayISO());
                  setSelected(null);
                }}
                className="font-sans text-[12px] text-muted underline cursor-pointer"
              >
                Back to today
              </button>
            )}
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => step(1)}
            aria-label="Next"
          >
            ›
          </Button>
        </div>

        {error ? (
          <div className="py-8 text-center">
            <p className="font-sans text-[14px] text-danger font-semibold">
              {error}
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => {
                setError(null);
                setLoadedRange("");
              }}
            >
              Try again
            </Button>
          </div>
        ) : loading && days.length === 0 ? (
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }).map((_, i) => (
              <div
                key={i}
                className="min-h-[52px] rounded-control bg-light-tan/50 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className={loading ? "opacity-60 transition-opacity" : ""}>
            {view === "month" && (
              <MonthGrid
                days={days}
                month={anchorDate.getMonth()}
                year={anchorDate.getFullYear()}
                selected={selected}
                onSelect={setSelected}
              />
            )}

            {view === "week" && (
              <div className="flex flex-col gap-2">
                {days.map((d) => (
                  <DaySummary
                    key={d.date}
                    day={d}
                    onEdit={() => setSelected(d.date)}
                  />
                ))}
              </div>
            )}

            {view === "day" &&
              (dayViewDay ? (
                <DayEditor day={dayViewDay} onChanged={refresh} />
              ) : (
                <p className="font-sans text-[14px] text-muted py-6 text-center">
                  Nothing to show for this date.
                </p>
              ))}
          </div>
        )}

        {view === "month" && (
          <p className="font-sans text-[12px] text-muted mt-3">
            Tap any day to set its hours, close it, or block part of it. A red
            dot means part of that day is blocked.
          </p>
        )}
      </div>

      {/* Keyed on the saved rows so the panel remounts — and reseeds its draft —
          only when the underlying hours actually change, not on every refresh. */}
      <WeeklyHoursPanel
        key={JSON.stringify(weeklyHours)}
        rows={weeklyHours}
        onSaved={refresh}
      />

      {/* Month and week edit through a dialog; the day view already shows the
          editor in place, so opening a second copy would be confusing. */}
      <Modal
        isOpen={Boolean(selectedDay) && view !== "day"}
        onClose={() => setSelected(null)}
        title={selectedDay ? formatLongDate(selectedDay.date) : ""}
      >
        {selectedDay && <DayEditor day={selectedDay} onChanged={refresh} />}
      </Modal>
    </div>
  );
}

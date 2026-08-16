"use client";

import {
  ScheduleDay,
  dayState,
  fromISO,
  todayISO,
} from "@/lib/schedule";

const WEEKDAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];

interface MonthGridProps {
  /** Every date the grid draws, including the leading and trailing week days. */
  days: ScheduleDay[];
  /** Which calendar month is in focus; dates outside it render muted. */
  month: number;
  year: number;
  selected: string | null;
  onSelect: (date: string) => void;
}

/**
 * A month at a glance: which days are open, which carry blocks, and how much
 * is booked.
 *
 * Deliberately not a time grid. She reads this on a phone, where six rows of
 * hour-by-hour columns would be unreadable — the day view is where the
 * timeline lives. Here each cell answers only "is this day working, and how
 * full is it".
 */
export function MonthGrid({
  days,
  month,
  year,
  selected,
  onSelect,
}: MonthGridProps) {
  const today = todayISO();

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAY_INITIALS.map((d, i) => (
          <div
            key={i}
            className="text-center font-sans text-[11px] font-semibold text-muted py-1"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const d = fromISO(day.date);
          const inMonth = d.getMonth() === month && d.getFullYear() === year;
          const state = dayState(day);
          const isToday = day.date === today;
          const isSelected = day.date === selected;
          const bookingCount = day.bookings.length;

          // Selection wins over today, which wins over the day's own state —
          // otherwise a closed today reads as an ordinary closed day and she
          // loses her place in the grid.
          const base =
            "relative flex flex-col items-center justify-start gap-0.5 rounded-control py-1.5 min-h-[52px] transition-colors cursor-pointer border-2";
          const tone = isSelected
            ? "bg-deep-brown text-white border-deep-brown"
            : state === "closed"
              ? "bg-cream text-muted border-transparent hover:border-light-tan"
              : "bg-white text-charcoal border-transparent hover:border-light-tan";

          return (
            <button
              key={day.date}
              type="button"
              onClick={() => onSelect(day.date)}
              aria-pressed={isSelected}
              aria-label={`${day.date}, ${state}, ${bookingCount} ${
                bookingCount === 1 ? "appointment" : "appointments"
              }`}
              className={`${base} ${tone} ${
                inMonth ? "" : "opacity-40"
              } ${isToday && !isSelected ? "ring-2 ring-brand-tan" : ""}`}
            >
              <span
                className={`font-sans text-[13px] ${
                  isToday ? "font-bold" : "font-semibold"
                } ${state === "closed" && !isSelected ? "line-through decoration-1" : ""}`}
              >
                {d.getDate()}
              </span>

              {/* One dot per appointment up to three, then a count. Dots read
                  faster than a number for the common case of a light day. */}
              {bookingCount > 0 && (
                <span className="flex items-center gap-0.5">
                  {bookingCount <= 3 ? (
                    Array.from({ length: bookingCount }).map((_, i) => (
                      <span
                        key={i}
                        className={`w-1.5 h-1.5 rounded-full ${
                          isSelected ? "bg-white" : "bg-deep-brown"
                        }`}
                      />
                    ))
                  ) : (
                    <span
                      className={`font-sans text-[10px] font-bold ${
                        isSelected ? "text-white" : "text-deep-brown"
                      }`}
                    >
                      {bookingCount}
                    </span>
                  )}
                </span>
              )}

              {/* A partial block is the one state that is invisible from the
                  booking count alone — the day looks open but has a hole in it. */}
              {state === "blocked" && (
                <span
                  aria-hidden="true"
                  className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${
                    isSelected ? "bg-white" : "bg-danger"
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

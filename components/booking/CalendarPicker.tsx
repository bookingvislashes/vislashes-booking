"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { UseFormReturn } from "react-hook-form";
import { BookingFormData } from "@/lib/schemas";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isBefore,
  isToday,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  addMonths,
  subMonths,
} from "date-fns";

interface CalendarPickerProps {
  form: UseFormReturn<BookingFormData>;
  serviceId: string;
  /** Lengthens the appointment, so it changes which start times fit. */
  hasRemoval: boolean;
}

export function CalendarPicker({
  form,
  serviceId,
  hasRemoval,
}: CalendarPickerProps) {
  // Opens on the month of the date already chosen. This component remounts on
  // every step change, so booking in October and pressing Back landed on the
  // current month with the selection highlighted off-screen — and clicking any
  // visible day to get oriented wiped the chosen time.
  const [currentMonth, setCurrentMonth] = useState(() => {
    const chosen = form.getValues("bookingDate");
    return chosen ? new Date(`${chosen}T00:00:00`) : new Date();
  });
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  // Which dates in the visible grid can actually be booked. `null` means we
  // don't know yet — still loading, or the request failed. Unknown deliberately
  // renders every future date as clickable: a hiccup fetching this should look
  // like the calendar always did, never like a salon with no openings left.
  const [openDates, setOpenDates] = useState<Set<string> | null>(null);
  const [loadingMonth, setLoadingMonth] = useState(false);

  const selectedDate = form.watch("bookingDate");
  const selectedTime = form.watch("timeSlot");

  // The six weeks the grid actually draws, as ISO strings. Deriving the days
  // back out of the endpoints rather than carrying Date objects around is what
  // lets the month fetch below depend on plain values instead of new Date
  // instances that differ on every render.
  const rangeFrom = format(startOfWeek(startOfMonth(currentMonth)), "yyyy-MM-dd");
  const rangeTo = format(endOfWeek(endOfMonth(currentMonth)), "yyyy-MM-dd");

  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: new Date(`${rangeFrom}T00:00:00`),
        end: new Date(`${rangeTo}T00:00:00`),
      }),
    [rangeFrom, rangeTo]
  );

  const fetchTimeSlots = useCallback(async (date: string) => {
    setLoadingSlots(true);
    try {
      const res = await fetch(
        `/api/availability?date=${date}&serviceId=${serviceId}${
          hasRemoval ? "&removal=1" : ""
        }`
      );
      const data = await res.json();
      setTimeSlots(data.slots || []);
    } catch {
      setTimeSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [serviceId, hasRemoval]);

  useEffect(() => {
    if (selectedDate) {
      fetchTimeSlots(selectedDate);
    }
  }, [selectedDate, fetchTimeSlots]);

  // One request per visible month rather than one per date. Aborting on change
  // matters here: paging through months quickly used to be the only way to get
  // a stale answer painted over a newer one.
  useEffect(() => {
    if (!serviceId) {
      setOpenDates(null);
      return;
    }

    const controller = new AbortController();
    setLoadingMonth(true);
    setOpenDates(null);

    fetch(
      `/api/availability/month?from=${rangeFrom}&to=${rangeTo}&serviceId=${serviceId}${
        hasRemoval ? "&removal=1" : ""
      }`,
      { signal: controller.signal }
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (controller.signal.aborted) return;
        // A failed or malformed answer stays unknown, which keeps every date
        // clickable instead of graying out the whole month.
        setOpenDates(
          data && Array.isArray(data.dates) ? new Set<string>(data.dates) : null
        );
        setLoadingMonth(false);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setOpenDates(null);
        setLoadingMonth(false);
      });

    return () => controller.abort();
  }, [rangeFrom, rangeTo, serviceId, hasRemoval]);

  const handleDateSelect = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    form.setValue("bookingDate", dateStr, { shouldValidate: true });
    form.setValue("timeSlot", "", { shouldValidate: false });
  };

  const handleTimeSelect = (slot: string) => {
    form.setValue("timeSlot", slot, { shouldValidate: true });
  };

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  // Only worth saying once the answer is in, and only when it is the whole
  // month — otherwise she gets "no openings" flashing during every page.
  const monthHasNoOpenings =
    openDates !== null &&
    !loadingMonth &&
    days.every(
      (day) =>
        !isSameMonth(day, currentMonth) ||
        isBefore(day, yesterday) ||
        !openDates.has(format(day, "yyyy-MM-dd"))
    );

  return (
    <div>
      <h2 className="font-display text-[24px] font-bold text-dark-brown mb-1">
        Choose Your Availability
      </h2>
      <p className="font-sans text-[14px] text-charcoal mb-6">
        Select a date and time for your appointment.
      </p>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="text-deep-brown hover:text-dark-brown p-1 cursor-pointer"
        >
          &larr;
        </button>
        <span className="font-sans text-[15px] font-semibold text-dark-brown">
          {format(currentMonth, "MMMM yyyy")}
        </span>
        <button
          type="button"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="text-deep-brown hover:text-dark-brown p-1 cursor-pointer"
        >
          &rarr;
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-2">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div
            key={day}
            className="text-center font-sans text-[11px] font-semibold text-muted"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 mb-3">
        {days.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const isPast = isBefore(day, yesterday);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isSelected = selectedDate === dateStr;
          // Three states, not two: open, closed, and not yet known. A date is
          // only grayed out once the answer has actually come back saying the
          // salon has nothing free on it.
          const isOpen = openDates === null ? null : openDates.has(dateStr);
          const isDisabled = isPast || !isCurrentMonth || isOpen === false;

          return (
            <button
              key={dateStr}
              type="button"
              disabled={isDisabled}
              onClick={() => handleDateSelect(day)}
              aria-label={
                isCurrentMonth && !isPast
                  ? `${format(day, "EEEE, MMMM d")}${
                      isOpen === false
                        ? ", no openings"
                        : isOpen
                          ? ", openings available"
                          : ""
                    }`
                  : undefined
              }
              className={`aspect-square flex items-center justify-center rounded-control text-[13px] font-sans transition-colors ${
                isSelected
                  ? "bg-deep-brown text-white font-semibold"
                  : isDisabled
                    ? "text-muted/40 cursor-not-allowed font-normal"
                    : isToday(day)
                      ? `bg-warm-beige/30 text-dark-brown hover:bg-warm-beige/50 ${
                          isOpen ? "font-bold" : ""
                        }`
                      : `text-charcoal hover:bg-light-tan ${
                          isOpen ? "font-bold" : ""
                        }`
              }`}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>

      {/* Legend. Occupies the same line whether loading or loaded, so the grid
          and the times below it don't jump as the answer arrives. */}
      <p className="font-sans text-[12px] text-muted mb-6 min-h-[18px]">
        {loadingMonth
          ? "Checking which days are open..."
          : monthHasNoOpenings
            ? "No openings left this month — try the next one."
            : openDates !== null
              ? "Dates in bold have openings. Grayed-out dates are unavailable."
              : ""}
      </p>

      {/* Time slots */}
      {selectedDate && (
        <div>
          <p className="font-sans text-[12px] font-semibold text-muted uppercase tracking-wider mb-3">
            Available Times
          </p>
          {loadingSlots ? (
            <p className="font-sans text-[14px] text-muted">
              Loading available times...
            </p>
          ) : timeSlots.length === 0 ? (
            <p className="font-sans text-[14px] text-muted">
              No available times for this date. Please select another date.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {timeSlots.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => handleTimeSelect(slot)}
                  className={`h-control box-border inline-flex items-center justify-center px-3 rounded-control text-[13px] font-semibold font-sans border transition-colors ${
                    selectedTime === slot
                      ? "bg-deep-brown text-white border-deep-brown"
                      : "bg-white text-charcoal border-light-tan hover:border-deep-brown"
                  }`}
                >
                  {slot}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {form.formState.errors.bookingDate && (
        <p className="text-danger text-[12px] mt-3 font-sans">
          {form.formState.errors.bookingDate.message}
        </p>
      )}
      {form.formState.errors.timeSlot && (
        <p className="text-danger text-[12px] mt-1 font-sans">
          {form.formState.errors.timeSlot.message}
        </p>
      )}
    </div>
  );
}

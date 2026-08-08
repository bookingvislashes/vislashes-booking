"use client";

import { useState, useEffect, useCallback } from "react";
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
}

export function CalendarPicker({ form, serviceId }: CalendarPickerProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const selectedDate = form.watch("bookingDate");
  const selectedTime = form.watch("timeSlot");

  const fetchTimeSlots = useCallback(async (date: string) => {
    setLoadingSlots(true);
    try {
      const res = await fetch(
        `/api/availability?date=${date}&serviceId=${serviceId}`
      );
      const data = await res.json();
      setTimeSlots(data.slots || []);
    } catch {
      setTimeSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [serviceId]);

  useEffect(() => {
    if (selectedDate) {
      fetchTimeSlots(selectedDate);
    }
  }, [selectedDate, fetchTimeSlots]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

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
      <div className="grid grid-cols-7 gap-1 mb-6">
        {days.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const isPast = isBefore(day, yesterday);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isSelected = selectedDate === dateStr;
          const isDisabled = isPast || !isCurrentMonth;

          return (
            <button
              key={dateStr}
              type="button"
              disabled={isDisabled}
              onClick={() => handleDateSelect(day)}
              className={`aspect-square flex items-center justify-center rounded-md text-[13px] font-sans transition-colors cursor-pointer ${
                isSelected
                  ? "bg-deep-brown text-white"
                  : isDisabled
                    ? "text-muted/40 cursor-not-allowed"
                    : isToday(day)
                      ? "bg-warm-beige/30 text-dark-brown hover:bg-warm-beige/50"
                      : "text-charcoal hover:bg-light-tan"
              }`}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>

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
                  className={`py-2.5 px-3 rounded-md text-[13px] font-semibold font-sans border transition-colors cursor-pointer ${
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

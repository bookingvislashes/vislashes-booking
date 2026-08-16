import { format, addMinutes, parse, isAfter, addHours, isBefore } from "date-fns";

interface TimeRange {
  start: string; // "HH:mm"
  end: string;   // "HH:mm"
}

interface Booking {
  start_time: string;
  end_time: string;
}

interface BlockedDate {
  blocked_date: string;
  start_time: string | null;
  end_time: string | null;
}

interface AvailabilityRow {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

/**
 * "10:00 AM" or "1:30 PM" to "10:00" or "13:30".
 *
 * Lives here rather than beside its callers because both the availability
 * route and the Google Calendar sync need it, and two copies of a 12-hour
 * parser is exactly the kind of duplication that drifts into a scheduling bug.
 */
export function to24Hour(time12: string): string {
  const [timePart, period] = time12.split(" ");
  const [rawHours, minutes] = timePart.split(":").map(Number);
  let hours = rawHours;
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}`;
}

export function generateTimeSlots(
  date: string,
  serviceDurationMinutes: number,
  availabilityRows: AvailabilityRow[],
  blockedDates: BlockedDate[],
  existingBookings: Booking[],
  bufferMinutes: number,
  advanceHours: number
): string[] {
  const dateObj = new Date(date + "T00:00:00");
  const dayOfWeek = dateObj.getDay(); // 0=Sunday

  // 1. Find recurring availability for this day
  const dayAvailability = availabilityRows.find(
    (a) => a.day_of_week === dayOfWeek && a.is_active
  );
  if (!dayAvailability) return [];

  // 2. Check if entire day is blocked
  const fullDayBlock = blockedDates.find(
    (b) => b.blocked_date === date && b.start_time === null
  );
  if (fullDayBlock) return [];

  // 3. Get blocked time ranges for this date
  const blockedRanges: TimeRange[] = blockedDates
    .filter((b) => b.blocked_date === date && b.start_time !== null)
    .map((b) => ({ start: b.start_time!, end: b.end_time! }));

  // 4. Get existing bookings as occupied ranges (including buffer)
  const occupiedRanges: TimeRange[] = existingBookings.map((b) => ({
    start: b.start_time.substring(0, 5),
    end: formatTime(
      addMinutes(
        parse(b.end_time.substring(0, 5), "HH:mm", dateObj),
        bufferMinutes
      )
    ),
  }));

  // 5. Generate slots at 30-min intervals
  const slots: string[] = [];
  const windowStart = parse(
    dayAvailability.start_time.substring(0, 5),
    "HH:mm",
    dateObj
  );
  const windowEnd = parse(
    dayAvailability.end_time.substring(0, 5),
    "HH:mm",
    dateObj
  );
  const minBookingTime = addHours(new Date(), advanceHours);

  let current = windowStart;
  while (isBefore(current, windowEnd)) {
    const slotStart = formatTime(current);
    const slotEnd = formatTime(addMinutes(current, serviceDurationMinutes));
    const slotEndWithBuffer = formatTime(
      addMinutes(current, serviceDurationMinutes + bufferMinutes)
    );

    // Check: does the service fit within the availability window?
    const serviceEnd = addMinutes(current, serviceDurationMinutes);
    if (isAfter(serviceEnd, windowEnd)) {
      current = addMinutes(current, 30);
      continue;
    }

    // Check: is the slot far enough in the future?
    const slotDateTime = parse(slotStart, "HH:mm", new Date(date + "T00:00:00"));
    // Reconstruct as a proper datetime
    const fullSlotDateTime = new Date(`${date}T${slotStart}:00`);
    if (isBefore(fullSlotDateTime, minBookingTime)) {
      current = addMinutes(current, 30);
      continue;
    }

    // Check: does slot overlap with any blocked range?
    const isBlocked = blockedRanges.some(
      (r) => slotStart < r.end && slotEnd > r.start
    );
    if (isBlocked) {
      current = addMinutes(current, 30);
      continue;
    }

    // Check: does slot overlap with any existing booking (including buffer)?
    const isOccupied = occupiedRanges.some(
      (r) => slotStart < r.end && slotEndWithBuffer > r.start
    );
    if (isOccupied) {
      current = addMinutes(current, 30);
      continue;
    }

    slots.push(formatTo12Hour(slotStart));
    current = addMinutes(current, 30);
  }

  return slots;
}

function formatTime(date: Date): string {
  return format(date, "HH:mm");
}

function formatTo12Hour(time24: string): string {
  const [h, m] = time24.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

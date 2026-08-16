/**
 * Shared shapes and date helpers for the admin calendar.
 *
 * Every date here is a plain "YYYY-MM-DD" string and every time a plain
 * "HH:mm", the same basis the slot engine compares on. Nothing converts to a
 * Date except to do calendar arithmetic, and then only through `fromISO`,
 * which pins midnight local — `new Date("2026-08-16")` parses as UTC and lands
 * on the previous evening for anyone west of Greenwich, which is the entire
 * United States.
 */

export interface ScheduleDay {
  date: string;
  /** Effective hours after any override, or null when closed. */
  window: { start: string; end: string } | null;
  /** True when a date_overrides row decides this date rather than its weekday. */
  hasOverride: boolean;
  overrideNote: string | null;
  blocks: {
    id: string;
    start: string | null;
    end: string | null;
    reason: string | null;
  }[];
  bookings: {
    id: string;
    start: string;
    end: string;
    timeSlot: string;
    client: string | null;
    service: string | null;
  }[];
}

export function fromISO(date: string): Date {
  return new Date(date + "T00:00:00");
}

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1)
    .toString()
    .padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
}

export function addDays(date: string, days: number): string {
  const d = fromISO(date);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

export function todayISO(): string {
  return toISO(new Date());
}

/** Sunday of the week containing `date`, matching the grid's column order. */
export function startOfWeek(date: string): string {
  const d = fromISO(date);
  return addDays(date, -d.getDay());
}

/**
 * The six-week span a month grid actually draws — the 1st back to its Sunday,
 * and the last day forward to its Saturday. Fetching the visible range rather
 * than the calendar month is what stops the leading and trailing cells from
 * rendering as though the salon were closed.
 */
export function monthGridRange(year: number, month: number): {
  from: string;
  to: string;
} {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  return {
    from: addDays(toISO(first), -first.getDay()),
    to: addDays(toISO(last), 6 - last.getDay()),
  };
}

export function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  let cursor = from;
  // Bounded so a reversed range cannot spin: the API caps at 120 days anyway.
  for (let i = 0; i < 400 && cursor <= to; i++) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return out;
}

/** "14:30" to "2:30 PM". Matches the labels the booking page shows clients. */
export function to12Hour(time24: string): string {
  const [h, m] = time24.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

export function formatRange(start: string, end: string): string {
  return `${to12Hour(start)} – ${to12Hour(end)}`;
}

export function formatLongDate(date: string): string {
  return fromISO(date).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function formatShortDate(date: string): string {
  return fromISO(date).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * How a date should read at a glance in the grid.
 *
 * "closed" and "blocked" are deliberately distinct: closed is the salon's own
 * hours saying no, blocked is time carved out of a day that is otherwise open.
 * She needs to tell those apart to know whether to edit hours or remove a block.
 */
export type DayState = "closed" | "blocked" | "open";

export function dayState(day: ScheduleDay): DayState {
  if (!day.window) return "closed";
  if (day.blocks.some((b) => b.start === null)) return "closed";
  if (day.blocks.length > 0) return "blocked";
  return "open";
}

/** One weekday's recurring hours. `id` is absent until the row is first saved. */
export interface WeeklyHourRow {
  id?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

export interface SchedulePayload {
  days: ScheduleDay[];
  weeklyHours: WeeklyHourRow[];
}

export async function fetchSchedule(
  from: string,
  to: string,
  signal?: AbortSignal
): Promise<SchedulePayload> {
  const res = await fetch(
    `/api/admin/schedule?from=${from}&to=${to}`,
    signal ? { signal } : undefined
  );
  if (!res.ok) throw new Error("Failed to load the schedule");
  const json = await res.json();
  return {
    days: (json.days || []) as ScheduleDay[],
    weeklyHours: (json.weeklyHours || []) as WeeklyHourRow[],
  };
}

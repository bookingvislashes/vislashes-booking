import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { resolveWindow, to24Hour } from "@/lib/availability";

/**
 * Writes the salon's availability for one specific date.
 *
 * This exists rather than writing `date_overrides` and `blocked_dates` straight
 * from the browser — which RLS would allow — because closing a date is the one
 * scheduling action that can strand a client who has already paid a deposit.
 * The check needs to read confirmed bookings and compare them against the hours
 * that would result, and it must happen on the same round trip that performs
 * the write, or two tabs can each pass their own check and one of them wins.
 *
 * Nothing here touches money. It refuses the write and reports the conflict;
 * cancelling and refunding stays a deliberate act on the booking's own page.
 */

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const schema = z.discriminatedUnion("action", [
  // Replace this date's hours, or close it outright.
  z.object({
    action: z.literal("set-hours"),
    date: z.string().regex(ISO_DATE),
    isOpen: z.literal(true),
    startTime: z.string().regex(HHMM),
    endTime: z.string().regex(HHMM),
    note: z.string().max(200).optional(),
  }),
  z.object({
    action: z.literal("set-hours"),
    date: z.string().regex(ISO_DATE),
    isOpen: z.literal(false),
    note: z.string().max(200).optional(),
  }),
  // Drop the override and fall back to the weekday hours.
  z.object({
    action: z.literal("clear-hours"),
    date: z.string().regex(ISO_DATE),
  }),
  // Subtract a range from whichever window applies. start/end omitted blocks
  // the whole day, matching what blocked_dates has always meant.
  z.object({
    action: z.literal("add-block"),
    date: z.string().regex(ISO_DATE),
    startTime: z.string().regex(HHMM).optional(),
    endTime: z.string().regex(HHMM).optional(),
    reason: z.string().max(200).optional(),
  }),
  z.object({
    action: z.literal("remove-block"),
    blockId: z.string().uuid(),
  }),
]);

interface ConflictBooking {
  id: string;
  time_slot: string;
  client: string | null;
}

/**
 * Confirmed bookings on `date` that the proposed hours would no longer contain.
 *
 * Compared on "HH:mm" strings throughout, the same lexicographic basis the slot
 * engine uses. A booking is stranded when it starts before the window opens, or
 * when any part of it runs past the close, or when a new block covers it.
 */
async function findStrandedBookings(
  admin: Awaited<ReturnType<typeof createServiceClient>>,
  date: string,
  window: { start: string; end: string } | null,
  newBlock: { start: string; end: string } | null
): Promise<ConflictBooking[]> {
  const { data: bookings, error } = await admin
    .from("bookings")
    .select("id, time_slot, services(duration_minutes), clients(full_name)")
    .eq("booking_date", date)
    .eq("status", "confirmed");

  if (error || !bookings || bookings.length === 0) return [];

  return bookings
    .filter((b) => {
      const start = to24Hour(b.time_slot as string);
      const duration =
        (b.services as unknown as { duration_minutes: number })
          ?.duration_minutes ?? 0;
      const [h, m] = start.split(":").map(Number);
      const endMins = h * 60 + m + duration;
      const end = `${Math.floor(endMins / 60)
        .toString()
        .padStart(2, "0")}:${(endMins % 60).toString().padStart(2, "0")}`;

      // Closing the date strands everything already on it.
      if (!window) return true;
      if (start < window.start || end > window.end) return true;
      if (newBlock && start < newBlock.end && end > newBlock.start) return true;
      return false;
    })
    .map((b) => ({
      id: b.id as string,
      time_slot: b.time_slot as string,
      client:
        (b.clients as unknown as { full_name: string } | null)?.full_name ??
        null,
    }));
}

function conflictResponse(conflicts: ConflictBooking[]) {
  return NextResponse.json(
    {
      error: "conflict",
      message:
        conflicts.length === 1
          ? "There is already an appointment booked in that time."
          : `There are already ${conflicts.length} appointments booked in that time.`,
      conflicts,
    },
    { status: 409 }
  );
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const admin = await createServiceClient();

  try {
    if (input.action === "remove-block") {
      // Removing a block only ever frees time, so there is nothing to strand.
      const { error } = await admin
        .from("blocked_dates")
        .delete()
        .eq("id", input.blockId);
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true });
    }

    // Everything below can take time away, so each needs the weekday hours to
    // work out what the date would look like afterwards.
    const { data: availability } = await admin
      .from("availability")
      .select("day_of_week, start_time, end_time, is_active")
      .eq("is_active", true);

    if (input.action === "set-hours") {
      const proposed =
        input.isOpen === true
          ? { start: input.startTime, end: input.endTime }
          : null;

      if (proposed && proposed.start >= proposed.end) {
        return NextResponse.json(
          { error: "The closing time has to be after the opening time." },
          { status: 400 }
        );
      }

      const stranded = await findStrandedBookings(
        admin,
        input.date,
        proposed,
        null
      );
      if (stranded.length > 0) return conflictResponse(stranded);

      const { error } = await admin.from("date_overrides").upsert(
        {
          date: input.date,
          is_open: input.isOpen,
          start_time: proposed ? proposed.start : null,
          end_time: proposed ? proposed.end : null,
          note: input.note ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "date" }
      );
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true });
    }

    if (input.action === "clear-hours") {
      // Falling back to the weekday window can shrink the day, so this is
      // checked too — the weekday hours may be narrower than the override was.
      const fallback = resolveWindow(input.date, availability || [], null);
      const stranded = await findStrandedBookings(
        admin,
        input.date,
        fallback,
        null
      );
      if (stranded.length > 0) return conflictResponse(stranded);

      const { error } = await admin
        .from("date_overrides")
        .delete()
        .eq("date", input.date);
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true });
    }

    // add-block
    const bothOrNeither =
      (input.startTime === undefined) === (input.endTime === undefined);
    if (!bothOrNeither) {
      return NextResponse.json(
        { error: "A block needs both a start and an end time, or neither." },
        { status: 400 }
      );
    }
    if (
      input.startTime !== undefined &&
      input.endTime !== undefined &&
      input.startTime >= input.endTime
    ) {
      return NextResponse.json(
        { error: "The end of the block has to be after its start." },
        { status: 400 }
      );
    }

    const { data: override } = await admin
      .from("date_overrides")
      .select("date, is_open, start_time, end_time")
      .eq("date", input.date)
      .maybeSingle();

    const currentWindow = resolveWindow(
      input.date,
      availability || [],
      override
        ? {
            date: override.date as string,
            is_open: override.is_open as boolean,
            start_time: (override.start_time as string | null) ?? null,
            end_time: (override.end_time as string | null) ?? null,
          }
        : null
    );

    const stranded = await findStrandedBookings(
      admin,
      input.date,
      // A whole-day block leaves no window at all.
      input.startTime === undefined ? null : currentWindow,
      input.startTime !== undefined && input.endTime !== undefined
        ? { start: input.startTime, end: input.endTime }
        : null
    );
    if (stranded.length > 0) return conflictResponse(stranded);

    const { error } = await admin.from("blocked_dates").insert({
      date: input.date,
      start_time: input.startTime ?? null,
      end_time: input.endTime ?? null,
      reason: input.reason ?? null,
    });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Admin availability write failed:", err);
    return NextResponse.json(
      { error: "Couldn't save that. Please try again." },
      { status: 500 }
    );
  }
}

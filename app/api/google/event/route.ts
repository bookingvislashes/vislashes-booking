import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { deleteBookingEvent } from "@/lib/google-calendar";

/**
 * Removes a cancelled booking's calendar event.
 *
 * The admin marks bookings cancelled straight from the browser with the anon
 * key, but the refresh token needed to reach Google is server-only, so the
 * status change calls this afterwards. Deliberately separate from the status
 * write: a calendar that briefly disagrees is recoverable, a booking whose
 * cancellation silently failed is not.
 */
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { bookingId } = z
      .object({ bookingId: z.string().uuid() })
      .parse(await req.json());

    const admin = await createServiceClient();
    await deleteBookingEvent(admin, bookingId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid booking id" }, { status: 400 });
    }
    console.error("Google Calendar: event removal failed:", error);
    return NextResponse.json({ error: "Failed to remove event" }, { status: 500 });
  }
}

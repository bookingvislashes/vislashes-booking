import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { deleteBookingEvent } from "@/lib/google-calendar";

/**
 * Deleting a service from the browser hits two things the anon/authenticated
 * role can't do: reading appointment counts is fine, but bookings has no
 * delete policy (only select/update — see 001_initial_schema.sql), so
 * clearing blocking appointments needs the service role. This mirrors
 * booking-action/route.ts: check the session, then do the whole operation
 * server-side so it can never half-apply.
 */

const schema = z.object({
  serviceId: z.string().uuid(),
  // Set once she's seen the blocked-appointment list and confirmed they're
  // safe to remove. Without it, a delete on a booked service only reports
  // what's blocking it — it never removes anything by accident.
  deleteBookings: z.boolean().optional().default(false),
});

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

  const { data: service, error: serviceError } = await admin
    .from("services")
    .select("id, name")
    .eq("id", input.serviceId)
    .maybeSingle();

  if (serviceError || !service) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  const {
    data: blocking,
    count,
    error: countError,
  } = await admin
    .from("bookings")
    .select("id, booking_date, time_slot, client:clients(full_name)", {
      count: "exact",
    })
    .eq("service_id", service.id)
    .order("booking_date", { ascending: false });

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  const appointmentCount = count ?? 0;

  if (appointmentCount > 0 && !input.deleteBookings) {
    return NextResponse.json({
      blocked: true,
      count: appointmentCount,
      appointments: (blocking || []).slice(0, 5).map((b) => {
        const client = Array.isArray(b.client) ? b.client[0] : b.client;
        return {
          date: b.booking_date,
          time: b.time_slot,
          client: client?.full_name || "Unknown",
        };
      }),
    });
  }

  if (appointmentCount > 0 && input.deleteBookings) {
    // Best-effort: a stale calendar event is a smaller problem than leaving
    // the delete half-done, so a failure here never blocks the rest.
    for (const booking of blocking || []) {
      await deleteBookingEvent(admin, booking.id);
    }

    // intake_forms and agreements cascade automatically (booking_id is
    // "on delete cascade" — see 001_initial_schema.sql).
    const { error: deleteBookingsError } = await admin
      .from("bookings")
      .delete()
      .eq("service_id", service.id);

    if (deleteBookingsError) {
      return NextResponse.json(
        { error: deleteBookingsError.message },
        { status: 500 }
      );
    }

    // Nullable and unrelated to whether the service exists — clearing it
    // keeps the Square payment ID on record for reconciliation.
    const { error: orphanError } = await admin
      .from("orphan_payments")
      .update({ service_id: null })
      .eq("service_id", service.id);

    if (orphanError) {
      return NextResponse.json({ error: orphanError.message }, { status: 500 });
    }
  }

  const { error: deleteServiceError } = await admin
    .from("services")
    .delete()
    .eq("id", service.id);

  if (deleteServiceError) {
    return NextResponse.json(
      { error: deleteServiceError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, deletedAppointments: appointmentCount });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { syncBookingEvent } from "@/lib/google-calendar";
import {
  getEmailSettings,
  ownerRecipients,
  sendConfirmationEmail,
  sendOwnerBookingAlert,
} from "@/lib/email";
import { notifyAdmins } from "@/lib/push";

/**
 * Appointments the salon books herself.
 *
 * The public checkout at /api/bookings exists to take a card. This one exists
 * for everything that never touches a card on this site: the regular who
 * Zelles her deposit at the end of the previous appointment, and the enquiry
 * in the Instagram DMs who is sent an invoice and books once it clears. Both
 * were being kept on Acuity purely because the site could not write them down.
 *
 * It is deliberately not the checkout with the payment step removed:
 *
 *   * There is no charge. The deposit has already arrived, somewhere else, and
 *     this records that fact — it never moves money. Nothing here can capture,
 *     refund, or reference a Square payment.
 *   * There is no intake form and no signed agreement, because nobody has
 *     filled them in. The booking says so (`booked_by = 'admin'`) rather than
 *     writing an unsigned waiver, and the calendar entry says so too.
 *   * Availability is not enforced. She is the one with the diary, and the
 *     appointment she is typing in has usually already been agreed out loud.
 *     A double-booking is still refused — that is a mistake, not a choice.
 */

// Everything the payment_method constraint allows for a deposit she takes
// herself, plus 'square' for one she keyed into the Square app. The checkout's
// own apple_pay/google_pay are not offered: those only ever come from a wallet
// sheet on the booking page.
const DEPOSIT_METHODS = [
  "zelle",
  "cash",
  "square",
  "apple_cash",
  "venmo",
  "invoice",
  "other",
] as const;

/** How each one should read to the client in her confirmation email. */
const METHOD_LABELS: Record<(typeof DEPOSIT_METHODS)[number], string> = {
  zelle: "Zelle",
  cash: "cash",
  square: "card",
  apple_cash: "Apple Cash",
  venmo: "Venmo",
  invoice: "invoice",
  other: "other",
};

const schema = z.object({
  // Either an existing client, or enough to create one. Checked below rather
  // than in the schema so the message can name what is actually missing.
  clientId: z.string().uuid().nullable().optional(),
  fullName: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().email().max(200).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),

  serviceId: z.string().uuid(),
  hasRemoval: z.boolean().default(false),

  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // The one shape the rest of the app can read back: the slot engine, the
  // reminder clock and the calendar all parse "10:00 AM" and nothing else.
  timeSlot: z
    .string()
    .trim()
    .regex(/^\d{1,2}:\d{2}\s?(AM|PM)$/i, "Use a time like 10:00 AM"),

  depositPaid: z.boolean().default(false),
  depositMethod: z.enum(DEPOSIT_METHODS).default("zelle"),
  /** Omitted means "the service's usual deposit", resolved server-side. */
  depositAmount: z.number().min(0).max(2000).optional(),

  note: z.string().trim().max(1000).nullable().optional(),
  bookingSource: z.string().trim().max(80).nullable().optional(),
  sendConfirmation: z.boolean().default(true),
});

/** Last ten digits, so "(973) 851-0685" and "+19738510685" are one number. */
const digits = (value: string) => value.replace(/[^0-9]/g, "").slice(-10);

function formatDuration(mins: number): string {
  const hrs = Math.floor(mins / 60);
  const m = mins % 60;
  if (hrs && m) return `${hrs} hr ${m} min`;
  if (hrs) return `${hrs} hr`;
  return `${m} min`;
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
  } catch (err) {
    const issue =
      err instanceof z.ZodError ? err.issues[0]?.message : undefined;
    return NextResponse.json(
      { error: issue || "Check the client, service, date and time." },
      { status: 400 }
    );
  }

  const admin = await createServiceClient();

  // ── The service, and every number that comes from it ────────────────────
  // Read here and never taken from the browser. The same rule the card path
  // follows: a price or a deposit that arrives from a form is a price someone
  // can edit.
  const { data: service, error: serviceError } = await admin
    .from("services")
    .select("id, name, price, deposit_amount, duration_minutes")
    .eq("id", input.serviceId)
    .maybeSingle();

  if (serviceError || !service) {
    return NextResponse.json({ error: "Service not found." }, { status: 404 });
  }

  const { data: settingsRows } = await admin
    .from("settings")
    .select("key, value")
    .in("key", ["removal_price", "removal_duration_minutes"]);
  const settings = Object.fromEntries(
    (settingsRows || []).map((s) => [s.key as string, s.value as string])
  );

  const removalMinutes = input.hasRemoval
    ? parseInt(settings.removal_duration_minutes || "30", 10)
    : 0;
  const removalPrice = input.hasRemoval
    ? Number(settings.removal_price || 0)
    : 0;
  const appointmentMinutes = service.duration_minutes + removalMinutes;
  const appointmentTotal = Number(service.price) + removalPrice;

  // Her figure when she gives one — she is the one who saw the money arrive,
  // and a returning client's deposit is not always the standard amount. It is
  // still clamped to the appointment total, because a deposit larger than the
  // service is a typo every time and would report a negative balance due.
  const depositAmount = input.depositPaid
    ? Math.min(
        Math.round((input.depositAmount ?? Number(service.deposit_amount)) * 100) /
          100,
        appointmentTotal
      )
    : Number(service.deposit_amount);

  // ── The client ──────────────────────────────────────────────────────────
  const email = input.email ? input.email.toLowerCase() : null;
  let clientId = input.clientId ?? null;
  // Only true when no existing record matched and a new one was created —
  // the same distinction her copy of a website booking draws.
  let isNewClient = false;

  if (clientId) {
    const { data: existing } = await admin
      .from("clients")
      .select("id")
      .eq("id", clientId)
      .maybeSingle();
    if (!existing) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }
  } else {
    if (!input.fullName) {
      return NextResponse.json(
        { error: "Pick a client, or give a name for a new one." },
        { status: 400 }
      );
    }

    // Match before creating, on email first and then phone. Booking a regular
    // by hand must not fork her into a second record — that resets her visit
    // count and splits the history the Clients page reads.
    if (email) {
      const { data: byEmail } = await admin
        .from("clients")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      clientId = byEmail?.id ?? null;
    }

    if (!clientId && input.phone && digits(input.phone).length === 10) {
      const target = digits(input.phone);
      const { data: candidates } = await admin
        .from("clients")
        .select("id, phone")
        .not("phone", "is", null)
        .limit(2000);
      clientId =
        (candidates || []).find((c) => digits(c.phone || "") === target)?.id ??
        null;
    }

    if (clientId) {
      // Fill in only what was blank. She is booking an appointment, not
      // editing a client record, and quietly overwriting a good email with a
      // half-remembered one is how a confirmation stops arriving.
      const { data: current } = await admin
        .from("clients")
        .select("email, phone")
        .eq("id", clientId)
        .maybeSingle();

      const patch: Record<string, string> = {};
      if (email && !current?.email) patch.email = email;
      if (input.phone && !current?.phone) patch.phone = input.phone;
      if (Object.keys(patch).length) {
        patch.updated_at = new Date().toISOString();
        await admin.from("clients").update(patch).eq("id", clientId);
      }
    } else {
      const { data: created, error: createError } = await admin
        .from("clients")
        .insert({
          full_name: input.fullName,
          email,
          phone: input.phone || null,
        })
        .select("id")
        .single();

      if (createError || !created) {
        console.error("Admin booking: client create failed:", createError);
        return NextResponse.json(
          { error: "Could not save that client." },
          { status: 500 }
        );
      }
      clientId = created.id;
      isNewClient = true;
    }
  }

  // ── The slot ────────────────────────────────────────────────────────────
  // Normalised to the exact casing and spacing everything else stores, so
  // "10:00am" typed on a phone keyboard still collides with an existing
  // "10:00 AM" here rather than sitting invisibly on top of it.
  const timeSlot = input.timeSlot.replace(/\s+/g, " ").toUpperCase().trim();
  const normalisedSlot = /\s/.test(timeSlot)
    ? timeSlot
    : timeSlot.replace(/(AM|PM)$/, " $1");

  const { data: clash } = await admin
    .from("bookings")
    .select("id")
    .eq("booking_date", input.bookingDate)
    .eq("time_slot", normalisedSlot)
    .eq("status", "confirmed")
    .maybeSingle();

  if (clash) {
    return NextResponse.json(
      {
        error: "SLOT_TAKEN",
        message: "There's already an appointment at that time.",
      },
      { status: 409 }
    );
  }

  // ── The booking ─────────────────────────────────────────────────────────
  const { data: booking, error: bookingError } = await admin
    .from("bookings")
    .insert({
      client_id: clientId,
      service_id: service.id,
      booking_date: input.bookingDate,
      time_slot: normalisedSlot,
      status: "confirmed",
      payment_method: input.depositPaid ? input.depositMethod : "cash",
      deposit_paid: input.depositPaid,
      deposit_amount: depositAmount,
      has_removal: input.hasRemoval,
      notes: input.note || null,
      booking_source: input.bookingSource || null,
      booked_by: "admin",
    })
    .select("id")
    .single();

  if (bookingError || !booking) {
    console.error("Admin booking: insert failed:", bookingError);
    return NextResponse.json(
      { error: "Could not save that appointment." },
      { status: 500 }
    );
  }

  // ── Everything that happens because it exists ───────────────────────────
  // Both best-effort, and in that order. The appointment is saved either way,
  // and neither an email Resend refused nor a calendar Google could not reach
  // is worth telling her the booking failed and having her enter it twice.
  const { data: client } = await admin
    .from("clients")
    .select("full_name, email")
    .eq("id", clientId)
    .maybeSingle();

  // Same private-address contract as the site's own checkout: read fresh from
  // Settings, sent only in the confirmation, never guessed at if the lookup
  // fails. Business Email comes back in the same read and is both the
  // Reply-To on her client's confirmation and where her own copy goes.
  const { studioAddress, businessEmail } = await getEmailSettings(admin);

  let emailed = false;
  if (input.sendConfirmation && client?.email) {
    try {
      await sendConfirmationEmail({
        clientName: client.full_name,
        clientEmail: client.email,
        serviceName: input.hasRemoval
          ? `${service.name} + lash removal`
          : service.name,
        bookingDate: input.bookingDate,
        timeSlot: normalisedSlot,
        duration: formatDuration(appointmentMinutes),
        depositAmount,
        totalPrice: appointmentTotal,
        paymentMethod: input.depositPaid ? input.depositMethod : "cash",
        depositPaid: input.depositPaid,
        depositMethodLabel: input.depositPaid
          ? METHOD_LABELS[input.depositMethod]
          : undefined,
        studioAddress,
        replyTo: businessEmail,
      });
      emailed = true;
    } catch (err) {
      console.error("Admin booking: confirmation email failed:", err);
    }
  }

  // Her own copy, for the same reason the push alert below fires on an
  // appointment she entered herself: every appointment in the business
  // announces itself the same way, and this is the one that is still
  // searchable in her inbox weeks later. Unlike the client's confirmation it
  // is not gated on the "send confirmation" tick — that box decides what the
  // client receives, not whether she gets her own record.
  await sendOwnerBookingAlert({
    to: ownerRecipients(businessEmail),
    clientName: client?.full_name || input.fullName || "Client",
    clientEmail: client?.email || email || "",
    clientPhone: input.phone || null,
    isNewClient,
    serviceName: input.hasRemoval
      ? `${service.name} + lash removal`
      : service.name,
    bookingDate: input.bookingDate,
    timeSlot: normalisedSlot,
    duration: formatDuration(appointmentMinutes),
    depositAmount,
    depositPaid: input.depositPaid,
    depositMethodLabel: input.depositPaid
      ? METHOD_LABELS[input.depositMethod]
      : undefined,
    totalPrice: appointmentTotal,
    paymentMethod: input.depositPaid ? input.depositMethod : "cash",
    source: "Added in the admin",
    bookingId: booking.id,
    notes: input.note || null,
  });

  // The same alert a client's own booking sends. Worth having even though
  // she is the one who just pressed the button: it is the receipt that the
  // appointment landed, it reaches the phone when she booked from somewhere
  // else, and it means every appointment in the business announces itself the
  // same way rather than only the ones that came with a card.
  await notifyAdmins(admin, {
    title: "Appointment booked",
    body: `${client?.full_name || "Client"} · ${service.name} · ${
      input.bookingDate
    } at ${normalisedSlot}`,
    url: `/admin/bookings/${booking.id}`,
  });

  // From here the appointment is indistinguishable from one a client made
  // herself: the same calendar entry, and the same two reminder emails on the
  // same schedule, with nothing further for her to do.
  await syncBookingEvent(admin, booking.id);

  return NextResponse.json({
    ok: true,
    bookingId: booking.id,
    clientId,
    emailed,
    // So the page can say "saved, but she has no email address on file"
    // rather than implying a confirmation went out.
    clientHasEmail: Boolean(client?.email),
  });
}

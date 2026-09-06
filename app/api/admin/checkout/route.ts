import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { listSquareAddOns } from "@/lib/square-customers";
import {
  buildPosCheckoutUrl,
  checkoutNote,
  isPosConfigured,
  newCheckoutRef,
} from "@/lib/square-pos";

/**
 * Works out what a client owes right now, and hands the whole sale to the
 * Square app.
 *
 * Every figure in the total is read here, from the database and from her
 * Square catalog. None of it is taken from the browser — the same rule the
 * deposit route follows, and for the same reason: an amount that arrives from
 * a form is an amount somebody can edit. The browser sends which appointment
 * and which extras, never what they cost.
 */

const schema = z.object({
  bookingId: z.string().uuid(),
  addOns: z
    .array(
      z.object({
        // A Square catalog *variation* id. Priced here by looking it up.
        id: z.string().min(1).max(64),
        quantity: z.number().int().min(1).max(20),
      })
    )
    .max(20)
    .default([]),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isPosConfigured()) {
    return NextResponse.json(
      {
        error:
          "Square isn't set up for this yet — the app ID is missing. Check Settings.",
      },
      { status: 503 }
    );
  }

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const admin = await createServiceClient();

  const { data: booking, error: bookingError } = await admin
    .from("bookings")
    .select(
      `id, has_removal, deposit_paid, deposit_amount, checkout_ref,
       loyalty_discount, loyalty_note,
       clients(full_name, square_customer_id),
       services(name, price)`
    )
    .eq("id", input.bookingId)
    .maybeSingle();

  if (bookingError || !booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const client = Array.isArray(booking.clients)
    ? booking.clients[0]
    : booking.clients;
  const service = Array.isArray(booking.services)
    ? booking.services[0]
    : booking.services;

  if (!service) {
    return NextResponse.json(
      { error: "That appointment has no service on it." },
      { status: 400 }
    );
  }

  // ── What the appointment itself still owes ──────────────────────────────
  const { data: settingsRows } = await admin
    .from("settings")
    .select("key, value")
    .eq("key", "removal_price");
  const removalPrice = booking.has_removal
    ? Number(settingsRows?.[0]?.value ?? 0)
    : 0;

  // Anything already recorded against this booking — a Zelle she took at the
  // door, or an earlier card. Only the service half; a tip is not a debt.
  const { data: collectedRows } = await admin
    .from("payments")
    .select("service_amount")
    .eq("booking_id", booking.id);
  const collected = (collectedRows || []).reduce(
    (sum, row) => sum + Number(row.service_amount ?? 0),
    0
  );

  const deposit =
    booking.deposit_paid && booking.deposit_amount
      ? Number(booking.deposit_amount)
      : 0;

  // A loyalty reward already attached to this appointment. Read from the
  // booking, like every other figure here, and never from the browser — this
  // is a discount, and a discount that arrives from a form is a discount
  // anybody can grant themselves.
  const loyaltyDiscount = Math.max(0, Number(booking.loyalty_discount ?? 0));

  const appointmentTotal = Number(service.price) + removalPrice;
  const gross = Math.max(0, appointmentTotal - deposit - collected);
  // Clamped against the gross rather than subtracted blindly, so a $15 reward
  // on a balance of $10 takes $10 off and not $15 — the salon does not hand
  // back change on a discount.
  const loyaltyApplied = Math.min(loyaltyDiscount, gross);

  // ── The extras ──────────────────────────────────────────────────────────
  const lines: { name: string; amountCents: number }[] = [];

  if (gross > 0) {
    lines.push({
      name: booking.has_removal
        ? `${service.name} + removal`
        : service.name,
      amountCents: Math.round(gross * 100),
    });
  }

  // Its own line, negative, so the sheet she is looking at shows the client
  // the same arithmetic the client is expecting: the set, then the $15 off.
  if (loyaltyApplied > 0) {
    lines.push({
      name: (booking.loyalty_note as string | null) ?? "Loyalty reward",
      amountCents: -Math.round(loyaltyApplied * 100),
    });
  }

  if (input.addOns.length) {
    let catalog;
    try {
      catalog = await listSquareAddOns();
    } catch (err) {
      console.error("Checkout: could not read the Square catalog:", err);
      return NextResponse.json(
        { error: "Couldn't reach Square to price those extras." },
        { status: 502 }
      );
    }

    const byId = new Map(catalog.map((item) => [item.id, item]));

    for (const requested of input.addOns) {
      const item = byId.get(requested.id);
      if (!item) {
        return NextResponse.json(
          { error: "One of those extras is no longer in your Square library." },
          { status: 400 }
        );
      }
      lines.push({
        name:
          requested.quantity > 1
            ? `${item.name} × ${requested.quantity}`
            : item.name,
        amountCents: item.priceCents * requested.quantity,
      });
    }
  }

  const totalCents = lines.reduce((sum, line) => sum + line.amountCents, 0);

  if (totalCents <= 0) {
    return NextResponse.json(
      {
        error: "SETTLED",
        message: "There's nothing left to collect on this one.",
      },
      { status: 400 }
    );
  }

  // ── The reference that comes back ───────────────────────────────────────
  // Reused when the booking already has one. She might take part of it on a
  // card and the rest another way, or start a checkout and back out; every
  // payment against this appointment should carry the same reference so they
  // all land on the same booking.
  let ref = booking.checkout_ref as string | null;
  if (!ref) {
    ref = newCheckoutRef();
    const { error: refError } = await admin
      .from("bookings")
      .update({ checkout_ref: ref })
      .eq("id", booking.id);

    if (refError) {
      // Not fatal to the sale — she can still charge the card, and the
      // webhook falls back to its own attribution. Worth knowing about,
      // because the exact link is what it costs.
      console.error("Checkout: could not save the reference:", refError);
    }
  }

  const base = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
  const clientName = client?.full_name || "Client";

  const url = buildPosCheckoutUrl({
    amountCents: totalCents,
    note: checkoutNote(clientName, ref),
    customerId: client?.square_customer_id ?? null,
    callbackUrl: `${base}/api/square/pos-return`,
    state: booking.id,
  });

  return NextResponse.json({
    url,
    totalCents,
    lines,
    ref,
    clientName,
    // So the sheet can say "she isn't linked to a Square profile yet" rather
    // than letting her assume the sale will be filed against her history.
    customerLinked: Boolean(client?.square_customer_id),
  });
}

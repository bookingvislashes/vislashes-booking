import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { salonDateOf } from "@/lib/salon-time";

/**
 * Recording what she collects herself — Zelle, Apple Cash, cash, Venmo, or a
 * card she keyed in outside the site. Square's own card payments arrive
 * through the webhook instead; this route exists for the money that never
 * touches an API.
 *
 * Like invoices, this goes through the service role after a session check:
 * `payments` has no anon policy, and the tip/service split below is
 * server-authoritative for the same reason a charge amount is — a number
 * typed in the browser is a suggestion, not a fact, until this route decides
 * what it means.
 */

const createSchema = z.object({
  bookingId: z.string().uuid().nullable().optional(),
  clientId: z.string().uuid().nullable().optional(),
  clientName: z.string().trim().min(1).max(120),
  method: z.enum(["card", "zelle", "apple_cash", "cash", "venmo", "other"]),
  // A ceiling well above anything she charges, so a typo of $8,500 instead of
  // $85 fails here instead of landing in a tax report.
  amount: z.number().positive().max(5000),
  // Only meaningful when there is no bookingId to compare against a service
  // price — see the split logic below.
  tipAmount: z.number().min(0).max(5000).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

const deleteSchema = z.object({
  id: z.string().uuid(),
});

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let input: z.infer<typeof createSchema>;
  try {
    input = createSchema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: "Check the client, method and amount." },
      { status: 400 }
    );
  }

  const admin = await createServiceClient();
  const amount = Math.round(input.amount * 100) / 100;
  let serviceAmount = amount;
  let tipAmount = 0;

  if (input.bookingId) {
    // The split is "anything over what the appointment was worth" — her own
    // definition — computed against the price on file, never a number she
    // could have mistyped in this request. A booking may already have a
    // deposit and earlier manual payments (a partial payment collected, the
    // rest a week later), so the tip is the *increase* in how far collections
    // sit past the price, not a fresh comparison each time — otherwise a
    // second, smaller payment after the price is already covered would count
    // as entirely tip twice over.
    const { data: booking, error: bookingError } = await admin
      .from("bookings")
      .select("deposit_paid, deposit_amount, service:services(price)")
      .eq("id", input.bookingId)
      .maybeSingle();

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: "Could not find that appointment." },
        { status: 400 }
      );
    }

    const serviceRow = Array.isArray(booking.service)
      ? booking.service[0]
      : booking.service;
    const price = Number(serviceRow?.price ?? 0);
    const depositAlready =
      booking.deposit_paid && booking.deposit_amount
        ? Number(booking.deposit_amount)
        : 0;

    const { data: priorPayments } = await admin
      .from("payments")
      .select("total_collected")
      .eq("booking_id", input.bookingId);
    const priorCollected = (priorPayments ?? []).reduce(
      (sum, p) => sum + Number(p.total_collected ?? 0),
      0
    );

    const runningBefore = depositAlready + priorCollected;
    const runningAfter = runningBefore + amount;
    const tipBefore = Math.max(0, runningBefore - price);
    const tipAfter = Math.max(0, runningAfter - price);
    tipAmount = Math.round((tipAfter - tipBefore) * 100) / 100;
    serviceAmount = Math.round((amount - tipAmount) * 100) / 100;
  } else if (input.tipAmount) {
    // No appointment to compare against — a walk-in, or money for something
    // that never became a booking row. She states the tip herself.
    tipAmount = Math.min(Math.round(input.tipAmount * 100) / 100, amount);
    serviceAmount = Math.round((amount - tipAmount) * 100) / 100;
  }

  const paidOn = input.paidOn || salonDateOf();

  const { data, error } = await admin
    .from("payments")
    .insert({
      booking_id: input.bookingId ?? null,
      client_id: input.clientId ?? null,
      client_name: input.clientName,
      method: input.method,
      source: "manual",
      service_amount: serviceAmount,
      tip_amount: tipAmount,
      paid_on: paidOn,
      note: input.note || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Payment record failed:", error);
    return NextResponse.json(
      { error: "Could not record the payment." },
      { status: 500 }
    );
  }

  return NextResponse.json({ id: data.id, serviceAmount, tipAmount });
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let input: z.infer<typeof deleteSchema>;
  try {
    input = deleteSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Missing payment id." }, { status: 400 });
  }

  const admin = await createServiceClient();

  // A Square-sourced row is Square's own record of a real card charge —
  // deleting it here would not undo the charge, only make the ledger lie
  // about it. Only a manual entry, which exists nowhere but this table, is
  // safe to remove outright.
  const { data: existing } = await admin
    .from("payments")
    .select("source")
    .eq("id", input.id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  }
  if (existing.source !== "manual") {
    return NextResponse.json(
      { error: "Only a manually entered payment can be removed here." },
      { status: 400 }
    );
  }

  const { error } = await admin.from("payments").delete().eq("id", input.id);
  if (error) {
    console.error("Payment delete failed:", error);
    return NextResponse.json(
      { error: "Could not remove the payment." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * Creating and settling invoices.
 *
 * Both go through the service role after a session check, for the same reason
 * delete-service does: `invoices` has no anon policy at all, and the token
 * that ends up in a client's link must be minted here rather than in the
 * browser, where it would be neither secret nor verifiable.
 */

const createSchema = z.object({
  clientId: z.string().uuid().nullable().optional(),
  clientName: z.string().trim().min(1).max(120),
  clientEmail: z.string().email().nullable().optional(),
  clientPhone: z.string().trim().max(40).nullable().optional(),
  bookingId: z.string().uuid().nullable().optional(),
  // Two decimal places, and a ceiling — a typo of 8500 instead of 85 should
  // fail here rather than show up on someone's card.
  amount: z.number().positive().max(2000),
  description: z.string().trim().min(1).max(200),
  note: z.string().trim().max(500).nullable().optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["mark_paid", "mark_unpaid", "void", "delete"]),
  note: z.string().trim().max(500).nullable().optional(),
});

/** 32 hex characters of crypto randomness. Long enough that guessing a live
 *  invoice link is not a thing anyone can do, short enough to text. */
function newToken() {
  return randomBytes(16).toString("hex");
}

/**
 * The client this invoice belongs to, always.
 *
 * An invoice with `client_id` null shows up nowhere on a client's profile,
 * and that was the common case: the form drops the picked client the moment
 * she edits the name on the invoice, which she does constantly ("Tabitha"
 * rather than "Tabitha Rosado"). So the link is settled here instead of being
 * left to the browser — matched on email, then on the name as typed, and only
 * created when neither finds anyone.
 *
 * Nothing is invented to make a row fit: email and phone go in exactly as
 * given, which since migration 010 may be nothing at all.
 */
async function resolveClientId(
  admin: Awaited<ReturnType<typeof createServiceClient>>,
  input: z.infer<typeof createSchema>
): Promise<string | null> {
  if (input.clientId) return input.clientId;

  const email = input.clientEmail?.trim().toLowerCase();
  if (email) {
    const { data } = await admin
      .from("clients")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  const name = input.clientName.trim();
  const { data: byName } = await admin
    .from("clients")
    .select("id")
    .ilike("full_name", name)
    .limit(1);
  if (byName?.[0]?.id) return byName[0].id;

  // Nobody by that name or address, so she is invoicing someone new. Creating
  // the profile now is what makes "every invoice appears on a client" true —
  // otherwise this one would be the exception forever.
  const { data: created, error: createError } = await admin
    .from("clients")
    .insert({
      full_name: name,
      email: email || null,
      phone: input.clientPhone?.trim() || null,
    })
    .select("id")
    .single();

  if (createError) {
    // A failure here must not cost her the invoice — it is filed without a
    // profile link, exactly as it would have been before.
    console.error("Invoice: could not create a client for", name, createError);
    return null;
  }
  return created.id;
}

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
      { error: "Check the name, amount and description." },
      { status: 400 }
    );
  }

  const admin = await createServiceClient();
  const clientId = await resolveClientId(admin, input);

  const { data, error } = await admin
    .from("invoices")
    .insert({
      token: newToken(),
      client_id: clientId,
      client_name: input.clientName,
      client_email: input.clientEmail || null,
      client_phone: input.clientPhone || null,
      booking_id: input.bookingId ?? null,
      // Rounded here rather than trusted: the form works in dollars and a
      // stray third decimal would round again, differently, at charge time.
      amount: Math.round(input.amount * 100) / 100,
      description: input.description,
      note: input.note || null,
      due_date: input.dueDate || null,
    })
    .select("id, token")
    .single();

  if (error || !data) {
    console.error("Invoice create failed:", error);
    return NextResponse.json(
      { error: "Could not create the invoice." },
      { status: 500 }
    );
  }

  return NextResponse.json({ id: data.id, token: data.token });
}

export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let input: z.infer<typeof updateSchema>;
  try {
    input = updateSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const admin = await createServiceClient();

  const { data: invoice, error: loadError } = await admin
    .from("invoices")
    .select("id, status, square_payment_id")
    .eq("id", input.id)
    .maybeSingle();

  if (loadError || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  // A card payment is a real Square record. Flipping it back to unpaid or
  // deleting it here would leave the money with no invoice pointing at it, so
  // that combination is refused rather than silently allowed.
  if (
    invoice.square_payment_id &&
    (input.action === "mark_unpaid" || input.action === "delete")
  ) {
    return NextResponse.json(
      {
        error:
          "This invoice was paid by card through the link, so it can't be reopened or deleted. Refund it in Square if you need to.",
      },
      { status: 409 }
    );
  }

  if (input.action === "delete") {
    const { error } = await admin.from("invoices").delete().eq("id", input.id);
    if (error) {
      return NextResponse.json({ error: "Could not delete." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const patch =
    input.action === "mark_paid"
      ? {
          status: "paid" as const,
          paid_method: "manual" as const,
          paid_at: new Date().toISOString(),
          ...(input.note !== undefined ? { note: input.note } : {}),
        }
      : input.action === "mark_unpaid"
        ? {
            status: "unpaid" as const,
            paid_method: null,
            paid_at: null,
          }
        : { status: "void" as const };

  const { error } = await admin.from("invoices").update(patch).eq("id", input.id);

  if (error) {
    console.error("Invoice update failed:", error);
    return NextResponse.json({ error: "Could not update." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

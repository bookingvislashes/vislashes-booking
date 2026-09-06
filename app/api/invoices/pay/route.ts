import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SquareError } from "square";
import { getSquareClient, toCents } from "@/lib/square";
import { createServiceClient } from "@/lib/supabase/server";
import { notifyAdmins } from "@/lib/push";
import { recordOrphanPayment } from "@/lib/orphan-payments";

/**
 * Paying an invoice from its link.
 *
 * The amount is read from the invoice row, never from the request — the same
 * rule that governs process-payment, and for the same reason: a number sent
 * from the browser is a number the buyer chooses.
 *
 * The token in the link is the only credential. It is matched exactly against
 * a single row; there is no listing, no partial match, and an unknown token is
 * indistinguishable from an unpaid one that has already been settled.
 */

const schema = z.object({
  token: z.string().regex(/^[a-f0-9]{32}$/),
  sourceId: z.string().min(1),
  attemptId: z.string().uuid(),
  verificationToken: z.string().optional(),
  buyerEmail: z.string().email().optional(),
});

export async function POST(req: NextRequest) {
  let paymentId: string | undefined;

  try {
    const data = schema.parse(await req.json());
    const supabase = await createServiceClient();

    const { data: invoice, error } = await supabase
      .from("invoices")
      .select("id, token, client_name, client_email, amount, description, status")
      .eq("token", data.token)
      .maybeSingle();

    if (error || !invoice) {
      return NextResponse.json({ error: "This invoice link isn't valid." }, { status: 404 });
    }

    if (invoice.status === "paid") {
      // Not an error worth alarming anyone about — a second tap on a slow
      // connection lands here, and the right answer is "you're already done".
      return NextResponse.json({ alreadyPaid: true });
    }

    if (invoice.status === "void") {
      return NextResponse.json(
        { error: "This invoice was cancelled. Please check with the studio." },
        { status: 409 }
      );
    }

    const amount = Number(invoice.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      console.error("Invoice has an unusable amount", { id: invoice.id });
      return NextResponse.json(
        { error: "Something is wrong with this invoice. Please contact the studio." },
        { status: 500 }
      );
    }

    const square = getSquareClient();
    const { payment } = await square.payments.create({
      sourceId: data.sourceId,
      idempotencyKey: data.attemptId,
      amountMoney: { amount: toCents(amount), currency: "USD" },
      locationId: process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID!,
      buyerEmailAddress: data.buyerEmail || invoice.client_email || undefined,
      note: `VIS Lashes - ${invoice.description}`,
      referenceId: invoice.id,
      verificationToken: data.verificationToken,
    });

    // A COMPLETED payment with no id cannot be refunded or reconciled later,
    // so it is treated as a failure here rather than recorded as a success.
    if (!payment || payment.status !== "COMPLETED" || !payment.id) {
      if (payment && payment.status === "COMPLETED" && !payment.id) {
        console.error("Square returned a COMPLETED invoice payment with no id.", {
          invoiceId: invoice.id,
          amount,
        });
      }
      return NextResponse.json({ error: "Payment was not completed." }, { status: 400 });
    }

    paymentId = payment.id;

    // The card has been charged. If marking the invoice paid fails, the money
    // still exists — so the payment id goes somewhere durable and is returned
    // to the payer, rather than vanishing into a generic 500.
    const { error: markError } = await supabase
      .from("invoices")
      .update({
        status: "paid",
        paid_method: "card",
        square_payment_id: payment.id,
        paid_at: new Date().toISOString(),
      })
      .eq("id", invoice.id)
      .eq("status", "unpaid");

    if (markError) {
      console.error(
        `Invoice paid but not marked. paymentId=${payment.id} invoiceId=${invoice.id} amount=${amount}`,
        markError
      );

      await recordOrphanPayment(supabase, {
        squarePaymentId: payment.id,
        amount,
        currency: "USD",
        customerEmail: data.buyerEmail || invoice.client_email || null,
        failureReason: `Invoice ${invoice.id} was paid by card but could not be marked paid.`,
      });

      return NextResponse.json(
        {
          error: "PAID_NOT_RECORDED",
          paymentId: payment.id,
          message:
            "Your card was charged, but we couldn't update the invoice. Please send the studio this reference so it isn't charged twice.",
        },
        { status: 409 }
      );
    }

    await notifyAdmins(supabase, {
      title: "Invoice paid",
      body: `${invoice.client_name} paid $${amount.toFixed(2)} - ${invoice.description}`,
      url: "/admin/invoices",
    });

    return NextResponse.json({ paid: true, paymentId: payment.id });
  } catch (err: unknown) {
    console.error("Invoice payment error:", { paymentId }, err);

    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    if (err instanceof SquareError) {
      return NextResponse.json(
        { error: err.errors?.[0]?.detail || "Payment failed." },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Payment could not be processed.", paymentId },
      { status: 500 }
    );
  }
}

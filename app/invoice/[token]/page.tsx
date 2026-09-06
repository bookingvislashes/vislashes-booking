import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/server";
import { InvoicePayment } from "@/components/invoice/InvoicePayment";

/**
 * A client's invoice link.
 *
 * Read through the service role after an exact token match, so `invoices`
 * needs no anon policy and nobody can list or enumerate invoices. The token is
 * the whole credential, which is why the route is never indexed.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your invoice · VIS Lashes",
  robots: { index: false, follow: false },
};

function money(value: number) {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function longDate(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d, 12).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Cheap shape check before touching the database: every token this site
  // issues is 32 hex characters.
  if (!/^[a-f0-9]{32}$/.test(token)) notFound();

  const supabase = await createServiceClient();

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select(
      "token, client_name, client_email, amount, description, status, due_date, paid_at"
    )
    .eq("token", token)
    .maybeSingle();

  if (error || !invoice) notFound();

  const amount = Number(invoice.amount);
  const firstName = invoice.client_name.split(" ")[0];

  return (
    <div className="min-h-[100dvh] bg-cream px-4 py-10 sm:py-16">
      <div className="max-w-[440px] mx-auto">
        {/* Wordmark, matching the site header. Not a link — someone here came
            to pay, and the destination is this page. */}
        <div className="flex items-baseline justify-center gap-0.5 mb-8">
          <span className="font-display text-[14px] font-bold text-dark-brown tracking-[4px] uppercase">
            VIS
          </span>
          <span className="font-display text-[14px] font-bold text-dark-brown tracking-[4px] uppercase italic">
            LASHES
          </span>
        </div>

        <div className="bg-white rounded-surface shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden">
          <div className="px-6 py-6 border-b border-light-tan text-center">
            <p className="font-sans text-[12px] text-muted uppercase tracking-[1px]">
              {invoice.status === "paid" ? "Paid in full" : "Amount due"}
            </p>
            <p className="font-display text-[40px] leading-[1.1] font-bold text-dark-brown mt-1 tabular-nums">
              {money(amount)}
            </p>
            <p className="font-sans text-[16px] text-charcoal mt-2 leading-[1.5]">
              {invoice.description}
            </p>
          </div>

          <dl className="px-6 py-4 border-b border-light-tan">
            <div className="flex items-baseline justify-between gap-4 py-1">
              <dt className="font-sans text-[16px] text-muted">For</dt>
              <dd className="font-sans text-[16px] text-charcoal font-semibold text-right">
                {invoice.client_name}
              </dd>
            </div>
            {/* A due date on a settled invoice reads as though something is
                still owed, so it is only shown while something is. */}
            {invoice.due_date && invoice.status === "unpaid" && (
              <div className="flex items-baseline justify-between gap-4 py-1">
                <dt className="font-sans text-[16px] text-muted">Due</dt>
                <dd className="font-sans text-[16px] text-charcoal text-right">
                  {longDate(invoice.due_date)}
                </dd>
              </div>
            )}
          </dl>

          <div className="px-6 py-6">
            {invoice.status === "paid" ? (
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-3">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-success"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
                <p className="font-display text-[24px] font-bold text-dark-brown">
                  All set, {firstName}
                </p>
                <p className="font-sans text-[16px] text-muted mt-1 leading-[1.5]">
                  This invoice is paid. There is nothing else to do.
                </p>
              </div>
            ) : invoice.status === "void" ? (
              <div className="text-center">
                <p className="font-display text-[24px] font-bold text-dark-brown">
                  This invoice was cancelled
                </p>
                <p className="font-sans text-[16px] text-muted mt-1 leading-[1.5]">
                  Nothing is owed. If that looks wrong, message the studio and
                  she&apos;ll sort it out.
                </p>
              </div>
            ) : (
              <>
                <p className="font-sans text-[16px] text-charcoal mb-4 leading-[1.5]">
                  Hi {firstName} — enter your card below to pay. It takes a few
                  seconds and holds your appointment.
                </p>
                <InvoicePayment
                  token={invoice.token}
                  amount={amount}
                  clientName={invoice.client_name}
                  clientEmail={invoice.client_email}
                />
              </>
            )}
          </div>
        </div>

        <p className="font-sans text-[12px] text-muted text-center mt-6 leading-[1.6]">
          Questions about this invoice? Reply to the message it came in and
          she&apos;ll get back to you.
        </p>
      </div>
    </div>
  );
}

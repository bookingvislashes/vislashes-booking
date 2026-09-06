"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";

interface InvoicePaymentProps {
  token: string;
  amount: number;
  clientName: string;
  clientEmail: string | null;
}

/**
 * The card form on a client's invoice link.
 *
 * Deliberately close to SquareCardForm: one attempt id per mounted form so a
 * second tap after a failure settles on a single Square charge, and the amount
 * is displayed here but never sent — the server reads it from the invoice row.
 */
export function InvoicePayment({
  token,
  amount,
  clientName,
  clientEmail,
}: InvoicePaymentProps) {
  const [loading, setLoading] = useState(false);
  const [cardReady, setCardReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  const cardRef = useRef<SquareCard | null>(null);
  const paymentsRef = useRef<SquarePayments | null>(null);
  const attemptIdRef = useRef<string>(crypto.randomUUID());

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      // The SDK is loaded lazily in the root layout, so on a cold open it may
      // not be on `window` yet. Poll briefly rather than failing the page.
      for (let i = 0; i < 40 && !window.Square; i += 1) {
        await new Promise((r) => setTimeout(r, 100));
      }
      if (cancelled) return;

      if (!window.Square) {
        setError("The payment form couldn't load. Please refresh the page.");
        return;
      }

      try {
        const payments = await window.Square.payments(
          process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID!,
          process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID!
        );
        if (cancelled) return;
        paymentsRef.current = payments;
        const card = await payments.card();
        await card.attach("#invoice-card-container");
        if (cancelled) {
          card.destroy();
          return;
        }
        cardRef.current = card;
        setCardReady(true);
      } catch (err) {
        console.error("Failed to initialize Square card:", err);
        if (!cancelled) {
          setError("The payment form couldn't load. Please refresh the page.");
        }
      }
    };

    init();

    return () => {
      cancelled = true;
      cardRef.current?.destroy();
    };
  }, []);

  const pay = useCallback(async () => {
    if (!cardRef.current || !paymentsRef.current) return;
    setLoading(true);
    setError(null);

    try {
      const tokenResult = await cardRef.current.tokenize();
      if (tokenResult.status !== "OK" || !tokenResult.token) {
        setError(tokenResult.errors?.[0]?.message || "Please check your card details.");
        setLoading(false);
        return;
      }

      let verificationToken: string | undefined;
      try {
        const verify = await paymentsRef.current.verifyBuyer(tokenResult.token, {
          amount: amount.toFixed(2),
          billingContact: {
            givenName: clientName.split(" ")[0] || "",
            familyName: clientName.split(" ").slice(1).join(" ") || "",
          },
          currencyCode: "USD",
          intent: "CHARGE",
        });
        verificationToken = verify?.token;
      } catch {
        // 3DS is not required for every transaction.
      }

      const res = await fetch("/api/invoices/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          sourceId: tokenResult.token,
          attemptId: attemptIdRef.current,
          verificationToken,
          ...(clientEmail ? { buyerEmail: clientEmail } : {}),
        }),
      });

      const data = await res.json();

      if (data.paid || data.alreadyPaid) {
        setPaid(true);
        return;
      }

      // Charged but not recorded. The reference is the only way the studio can
      // find the money, so it is shown rather than logged.
      if (data.paymentId) setReference(data.paymentId);
      setError(data.message || data.error || "Payment failed. Please try again.");
    } catch (err) {
      console.error("Invoice payment error:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [token, amount, clientName, clientEmail]);

  if (paid) {
    return (
      <div className="text-center py-6">
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
          Payment received
        </p>
        <p className="font-sans text-[16px] text-muted mt-1 leading-[1.5]">
          Thank you, {clientName.split(" ")[0]}. Your deposit is paid and your
          spot is held. See you soon!
        </p>
      </div>
    );
  }

  return (
    <div>
      <div
        id="invoice-card-container"
        className="min-h-[90px] rounded-control border border-light-tan"
      />

      {error && (
        <div className="mt-3 rounded-control border border-danger/30 bg-danger/5 p-3">
          <p className="font-sans text-[16px] text-danger leading-[1.5]">{error}</p>
          {reference && (
            <p className="font-sans text-[12px] text-charcoal mt-2 break-all">
              Reference: <span className="tabular-nums">{reference}</span>
            </p>
          )}
        </div>
      )}

      <Button
        type="button"
        size="lg"
        onClick={pay}
        disabled={loading || !cardReady}
        className="w-full mt-4"
      >
        {loading ? "Processing..." : `Pay $${amount.toFixed(2)}`}
      </Button>

      <p className="font-sans text-[12px] text-muted text-center mt-3 leading-[1.6]">
        Payments are processed securely by Square. Your card details never touch
        this site.
      </p>
    </div>
  );
}

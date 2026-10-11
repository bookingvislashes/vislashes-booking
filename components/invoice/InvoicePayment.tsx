"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { waitForSquare } from "@/lib/wait-for-square";
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
 * Deliberately close to SquareCardForm: stable attempt ids so a second tap
 * after a failure settles on a single Square charge, and the amount
 * is displayed here but never sent — the server reads it from the invoice row.
 *
 * Apple Pay and Google Pay sit side by side above the card fields. Each only
 * appears when Square says this device can use it, so on a phone without a
 * wallet the row collapses and the card form is all that shows.
 *
 * On success nothing is rendered here: the page is refreshed so the server
 * renders its own receipt for the now-paid invoice. The card iframe is
 * destroyed first so the card number is never left on screen under it.
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
  const [applePayReady, setApplePayReady] = useState(false);
  const [googlePayReady, setGooglePayReady] = useState(false);
  const router = useRouter();

  const cardRef = useRef<SquareCard | null>(null);
  const paymentsRef = useRef<SquarePayments | null>(null);
  const applePayRef = useRef<SquareApplePay | null>(null);
  const googlePayRef = useRef<SquareGooglePay | null>(null);
  // One attempt id per method, not per form: Square rejects an idempotency
  // key reused with a different source, so a declined card followed by Apple
  // Pay must not share one. Retries within a method still settle on a single
  // charge.
  const attemptIdsRef = useRef({
    card: crypto.randomUUID(),
    apple_pay: crypto.randomUUID(),
    google_pay: crypto.randomUUID(),
  });

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      // The SDK is loaded lazily in the root layout, so on a cold open it may
      // not be on `window` yet. Poll briefly rather than failing the page.
      const square = await waitForSquare(4000, () => cancelled);
      if (cancelled) return;

      if (!square) {
        setError("The payment form couldn't load. Please refresh the page.");
        return;
      }

      try {
        const payments = await square.payments(
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

        // Wallets after the card, so a wallet failing can never take the card
        // form down with it. See SquareWalletButton for why the request has to
        // go through paymentRequest() and why null is not an error.
        const paymentRequest = payments.paymentRequest({
          countryCode: "US",
          currencyCode: "USD",
          total: { amount: amount.toFixed(2), label: "VIS Lashes" },
        });

        try {
          const ap = await payments.applePay(paymentRequest);
          if (ap && !cancelled) {
            applePayRef.current = ap;
            setApplePayReady(true);
          }
        } catch (err) {
          console.warn("Apple Pay unavailable:", err);
        }

        try {
          const gp = await payments.googlePay(paymentRequest);
          if (gp && !cancelled) {
            await gp.attach("#invoice-google-pay", { buttonSizeMode: "fill", buttonType: "plain" });
            if (cancelled) {
              gp.destroy();
              return;
            }
            googlePayRef.current = gp;
            setGooglePayReady(true);
          }
        } catch (err) {
          console.warn("Google Pay unavailable:", err);
        }
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
      googlePayRef.current?.destroy();
    };
  }, [amount]);

  /** Sends a tokenized card or wallet to the server. Shared by all three. */
  const submit = useCallback(
    async (
      method: "card" | "apple_pay" | "google_pay",
      sourceId: string,
      verificationToken?: string
    ) => {
      const res = await fetch("/api/invoices/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          sourceId,
          attemptId: attemptIdsRef.current[method],
          verificationToken,
          ...(clientEmail ? { buyerEmail: clientEmail } : {}),
        }),
      });

      const data = await res.json();

      if (data.paid || data.alreadyPaid) {
        // Take the card fields off the page before anything else, then let
        // the server render the receipt.
        cardRef.current?.destroy();
        cardRef.current = null;
        setPaid(true);
        router.refresh();
        return;
      }

      // Charged but not recorded. The reference is the only way the studio can
      // find the money, so it is shown rather than logged.
      if (data.paymentId) setReference(data.paymentId);
      setError(data.message || data.error || "Payment failed. Please try again.");
    },
    [token, clientEmail, router]
  );

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

      await submit("card", tokenResult.token, verificationToken);
    } catch (err) {
      console.error("Invoice payment error:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [amount, clientName, submit]);

  // Wallets are already verified by Apple and Google, so there is no
  // verifyBuyer step — the token goes straight to the server.
  const payWithWallet = useCallback(
    async (
      method: "apple_pay" | "google_pay",
      wallet: SquareApplePay | SquareGooglePay | null
    ) => {
      if (!wallet || loading) return;
      setError(null);
      try {
        const tokenResult = await wallet.tokenize();
        if (tokenResult.status !== "OK" || !tokenResult.token) {
          // Closing the wallet sheet lands here; that is not worth an error.
          return;
        }
        setLoading(true);
        await submit(method, tokenResult.token);
      } catch (err) {
        console.error("Invoice wallet payment error:", err);
        setError("Something went wrong. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [loading, submit]
  );

  // Between the charge succeeding and the refreshed page arriving. The card
  // iframe has already been destroyed, so only this shows.
  if (paid) {
    return (
      <div className="py-10 flex flex-col items-center gap-3" role="status">
        <div className="w-6 h-6 rounded-full border-2 border-light-tan border-t-dark-brown animate-spin" />
        <p className="font-sans text-[14px] text-muted">Confirming your payment…</p>
      </div>
    );
  }

  const anyWallet = applePayReady || googlePayReady;

  return (
    <div>
      {/* Side by side when both are available; whichever one is alone takes
          the full row. The Google Pay box stays in the DOM (hidden) so
          attach() has somewhere to render during init. */}
      <div className={`flex gap-2 ${anyWallet ? "" : "hidden"}`}>
        {applePayReady && (
          <button
            type="button"
            onClick={() => payWithWallet("apple_pay", applePayRef.current)}
            disabled={loading}
            aria-label="Pay with Apple Pay"
            // Black is an Apple Pay brand requirement.
            className="flex-1 min-w-0 h-control box-border bg-black text-white rounded-control font-sans font-semibold text-[17px] flex items-center justify-center gap-1 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg width="17" height="20" viewBox="0 0 20 24" fill="currentColor" aria-hidden="true">
              <path d="M15.07 11.61c-.02-2.32 1.9-3.44 1.99-3.5-1.09-1.59-2.78-1.8-3.38-1.83-1.42-.15-2.81.85-3.54.85-.74 0-1.87-.83-3.08-.81-1.57.02-3.03.93-3.84 2.35-1.65 2.87-.42 7.1 1.17 9.43.79 1.14 1.72 2.42 2.94 2.37 1.19-.05 1.63-.76 3.07-.76 1.43 0 1.84.76 3.08.73 1.27-.02 2.07-1.15 2.84-2.3.91-1.31 1.28-2.6 1.29-2.66-.03-.01-2.49-.95-2.51-3.79l-.03.02z" />
              <path d="M12.71 4.45c.64-.79 1.08-1.87.96-2.96-.93.04-2.08.63-2.75 1.41-.6.7-1.13 1.83-.99 2.9 1.04.08 2.11-.52 2.78-1.35z" />
            </svg>
            Pay
          </button>
        )}
        <div
          id="invoice-google-pay"
          onClick={() => payWithWallet("google_pay", googlePayRef.current)}
          className={`flex-1 min-w-0 h-control box-border ${googlePayReady ? "" : "hidden"}`}
        />
      </div>

      {anyWallet && (
        <div className="flex items-center gap-3 my-4" aria-hidden="true">
          <div className="flex-1 border-t border-light-tan" />
          <span className="font-sans text-[12px] text-muted uppercase tracking-[1px]">
            or pay with card
          </span>
          <div className="flex-1 border-t border-light-tan" />
        </div>
      )}

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

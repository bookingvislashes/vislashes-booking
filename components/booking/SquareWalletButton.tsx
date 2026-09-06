"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { waitForSquare } from "@/lib/wait-for-square";

interface SquareWalletButtonProps {
  depositAmount: number;
  serviceName: string;
  serviceId: string;
  formData: Record<string, unknown>;
  onSuccess: (bookingId: string) => void;
  onError: (message: string) => void;
}

export function SquareWalletButton({
  depositAmount,
  serviceName,
  serviceId,
  formData,
  onSuccess,
  onError,
}: SquareWalletButtonProps) {
  // Tracked separately: one shared "available" flag meant Apple Pay succeeding
  // was indistinguishable from Google Pay succeeding.
  const [applePayReady, setApplePayReady] = useState(false);
  const [googlePayReady, setGooglePayReady] = useState(false);
  // Only ever populated when the URL carries ?debug=wallet. Apple Pay failing
  // is silent by design — Square returns null for "this device can't" and for
  // "this domain isn't registered" alike, and on an iPhone there is no console
  // to read the difference from. This surfaces it on the page instead, for the
  // salon owner only.
  const [diagnostics, setDiagnostics] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const applePayRef = useRef<SquareApplePay | null>(null);
  const googlePayRef = useRef<SquareGooglePay | null>(null);
  const googlePayContainerRef = useRef<HTMLDivElement>(null);
  // See SquareCardForm — stable per mount so a retry cannot double-charge.
  const attemptIdRef = useRef<string>(crypto.randomUUID());

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      // The SDK is lazy-loaded in the root layout, so on a cold open it is
      // usually not on `window` yet when this mounts. This used to be a bare
      // `if (!window.Square) return;`, which lost that race silently and left
      // the wallet uninitialised — the Apple Pay button then never rendered,
      // with no error anywhere to say why.
      const debugging =
        typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("debug") === "wallet";
      const notes: string[] = [];
      const note = (line: string) => {
        notes.push(line);
        if (debugging) setDiagnostics([...notes]);
      };

      const square = await waitForSquare(6000, () => cancelled);
      if (cancelled) return;
      note(`SDK loaded: ${square ? "yes" : "NO — gave up after 6s"}`);
      if (!square) return;

      if (debugging) {
        const w = window as unknown as Record<string, unknown>;
        const session = w.ApplePaySession as
          | { canMakePayments?: () => boolean; supportsVersion?: (v: number) => boolean }
          | undefined;
        note(`host: ${window.location.hostname}`);
        note(`ApplePaySession present: ${session ? "yes" : "NO"}`);
        if (session?.canMakePayments) {
          try {
            note(`canMakePayments: ${session.canMakePayments()}`);
          } catch (err) {
            note(`canMakePayments threw: ${String(err)}`);
          }
        }
        if (session?.supportsVersion) {
          try {
            note(`supportsVersion(3): ${session.supportsVersion(3)}`);
          } catch {
            note("supportsVersion threw");
          }
        }
        note(`appId: ${String(process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID).slice(0, 12)}…`);
        note(`locationId: ${String(process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID)}`);
      }

      try {
        const payments = await square.payments(
          process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID!,
          process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID!
        );
        // Square requires the request to be built through paymentRequest()
        // rather than passed as a plain object. Handing applePay() the raw
        // options throws "expected property: paymentRequest of type
        // PaymentRequest" — which is why neither wallet ever appeared, on any
        // device, since this component was written. The throw was caught and
        // logged to a console nobody reads on a phone, so it looked like an
        // Apple restriction or a missing domain registration instead.
        const paymentRequest = payments.paymentRequest({
          countryCode: "US",
          currencyCode: "USD",
          total: {
            amount: depositAmount.toFixed(2),
            label: `VIS Lashes Deposit - ${serviceName}`,
          },
        });

        // With a real PaymentRequest, applePay() resolves to null — rather
        // than throwing — when the device genuinely cannot pay: not Safari, no
        // card in Wallet, or the domain not registered under this application
        // in the Square dashboard. Null and a throw mean different things, so
        // both are recorded; ?debug=wallet is what makes them readable on a
        // phone, where there is no console.
        try {
          const ap = await payments.applePay(paymentRequest);
          note(`applePay() returned: ${ap ? "an object" : "null"}`);
          if (ap && !cancelled) {
            applePayRef.current = ap;
            setApplePayReady(true);
          }
        } catch (err) {
          console.warn("Apple Pay unavailable:", err);
          note(`applePay() threw: ${err instanceof Error ? err.message : String(err)}`);
        }

        // Try Google Pay. The container is mounted unconditionally now — it
        // used to sit behind `if (!available) return null`, so during this
        // effect the component had rendered nothing, the ref was null, the
        // guard below failed, and Google Pay never attached for anyone. Every
        // Android and desktop-Chrome customer saw blank space.
        try {
          const gp = await payments.googlePay(paymentRequest);
          if (gp && googlePayContainerRef.current && !cancelled) {
            await gp.attach("#square-google-pay");
            googlePayRef.current = gp;
            setGooglePayReady(true);
          }
        } catch (err) {
          console.warn("Google Pay unavailable:", err);
        }
      } catch (err) {
        console.error("Failed to initialize Square wallets:", err);
        note(`payments() threw: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    init();

    return () => {
      cancelled = true;
    };
  }, [depositAmount, serviceName]);

  const processPayment = useCallback(
    async (
      tokenResult: SquareTokenResult,
      // Which wallet actually tokenized. Previously every wallet payment was
      // recorded as "apple_pay" by a setValue that ran after a navigation and
      // so never executed at all — "google_pay" was never written to the
      // database by any path.
      walletKind: "apple_pay" | "google_pay"
    ) => {
      if (tokenResult.status !== "OK" || !tokenResult.token) {
        onError(tokenResult.errors?.[0]?.message || "Tokenization failed");
        return;
      }
      setProcessing(true);
      try {
        const res = await fetch("/api/square/process-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceId: tokenResult.token,
            serviceId,
            serviceName,
            attemptId: attemptIdRef.current,
            // depositAmount deliberately omitted — server-authoritative.
            bookingDate: formData.bookingDate,
            timeSlot: formData.timeSlot,
            customerEmail: formData.email,
            customerName: formData.fullName,
            formData: { ...formData, paymentMethod: walletKind },
          }),
        });
        const data = await res.json();
        if (data.bookingId) {
          onSuccess(data.bookingId);
        } else {
          onError(data.message || data.error || "Payment failed");
        }
      } catch {
        onError("Payment processing failed");
      } finally {
        setProcessing(false);
      }
    },
    [serviceId, serviceName, depositAmount, formData, onSuccess, onError]
  );

  const handleApplePay = useCallback(async () => {
    if (!applePayRef.current || processing) return;
    try {
      const result = await applePayRef.current.tokenize();
      await processPayment(result, "apple_pay");
    } catch {
      onError("Apple Pay cancelled or failed");
    }
  }, [processing, processPayment, onError]);

  // Google Pay had no handler at all: attach() rendered the button but nothing
  // ever called tokenize(), so tapping it did nothing.
  const handleGooglePay = useCallback(async () => {
    if (!googlePayRef.current || processing) return;
    try {
      const result = await googlePayRef.current.tokenize();
      await processPayment(result, "google_pay");
    } catch {
      onError("Google Pay cancelled or failed");
    }
  }, [processing, processPayment, onError]);

  return (
    <div className="flex flex-col gap-2 w-full">
      {applePayReady && (
        <button
          type="button"
          onClick={handleApplePay}
          disabled={processing}
          // Black is an Apple Pay brand requirement, but the height and radius
          // come from the control scale so it stacks flush with the card
          // Button underneath it instead of being 6px-rounded next to 3px.
          className="w-full h-control box-border bg-black text-white rounded-control font-sans font-semibold text-[15px] flex items-center justify-center gap-2 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg width="20" height="24" viewBox="0 0 20 24" fill="currentColor">
            <path d="M15.07 11.61c-.02-2.32 1.9-3.44 1.99-3.5-1.09-1.59-2.78-1.8-3.38-1.83-1.42-.15-2.81.85-3.54.85-.74 0-1.87-.83-3.08-.81-1.57.02-3.03.93-3.84 2.35-1.65 2.87-.42 7.1 1.17 9.43.79 1.14 1.72 2.42 2.94 2.37 1.19-.05 1.63-.76 3.07-.76 1.43 0 1.84.76 3.08.73 1.27-.02 2.07-1.15 2.84-2.3.91-1.31 1.28-2.6 1.29-2.66-.03-.01-2.49-.95-2.51-3.79l-.03.02z" />
            <path d="M12.71 4.45c.64-.79 1.08-1.87.96-2.96-.93.04-2.08.63-2.75 1.41-.6.7-1.13 1.83-.99 2.9 1.04.08 2.11-.52 2.78-1.35z" />
          </svg>
          {processing ? "Processing..." : "Pay with Apple Pay"}
        </button>
      )}
      {/* Always in the DOM so attach() can find it during init; hidden rather
          than unmounted until Square confirms Google Pay is usable. */}
      <div
        id="square-google-pay"
        ref={googlePayContainerRef}
        onClick={handleGooglePay}
        className={googlePayReady ? "" : "hidden"}
      />
      {diagnostics.length > 0 && (
        <div className="rounded-control border border-light-tan bg-white p-3 text-left">
          <p className="font-sans text-[11px] font-semibold text-muted uppercase tracking-[1px] mb-1">
            Wallet check
          </p>
          {diagnostics.map((line) => (
            <p
              key={line}
              className="font-mono text-[11px] leading-[1.5] text-charcoal break-words"
            >
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

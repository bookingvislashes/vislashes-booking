"use client";

import { useState, useEffect, useRef, useCallback } from "react";

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
  const [available, setAvailable] = useState(false);
  const [processing, setProcessing] = useState(false);
  const applePayRef = useRef<SquareApplePay | null>(null);
  const googlePayRef = useRef<SquareGooglePay | null>(null);
  const googlePayContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const init = async () => {
      if (!window.Square) return;
      try {
        const payments = await window.Square.payments(
          process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID!,
          process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID!
        );
        const paymentRequest: SquarePaymentRequest = {
          countryCode: "US",
          currencyCode: "USD",
          total: {
            amount: depositAmount.toFixed(2),
            label: `VIS Lashes Deposit - ${serviceName}`,
          },
        };

        // Try Apple Pay
        try {
          const ap = await payments.applePay(paymentRequest);
          if (ap) {
            applePayRef.current = ap;
            setAvailable(true);
          }
        } catch {
          /* Apple Pay not available */
        }

        // Try Google Pay
        try {
          const gp = await payments.googlePay(paymentRequest);
          if (gp && googlePayContainerRef.current) {
            await gp.attach("#square-google-pay");
            googlePayRef.current = gp;
            setAvailable(true);
          }
        } catch {
          /* Google Pay not available */
        }
      } catch (err) {
        console.error("Failed to initialize Square wallets:", err);
      }
    };
    init();
  }, [depositAmount, serviceName]);

  const processPayment = useCallback(
    async (tokenResult: SquareTokenResult) => {
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
            depositAmount,
            bookingDate: formData.bookingDate,
            timeSlot: formData.timeSlot,
            customerEmail: formData.email,
            customerName: formData.fullName,
            formData,
          }),
        });
        const data = await res.json();
        if (data.bookingId) {
          onSuccess(data.bookingId);
        } else {
          onError(data.error || "Payment failed");
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
      await processPayment(result);
    } catch {
      onError("Apple Pay cancelled or failed");
    }
  }, [processing, processPayment, onError]);

  if (!available) return null;

  return (
    <div className="flex flex-col gap-2 w-full">
      {applePayRef.current && (
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
      <div id="square-google-pay" ref={googlePayContainerRef} />
    </div>
  );
}

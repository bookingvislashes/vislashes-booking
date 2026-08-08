"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";

interface SquareCardFormProps {
  depositAmount: number;
  serviceName: string;
  serviceId: string;
  formData: Record<string, unknown>;
  onSuccess: (bookingId: string) => void;
  onError: (message: string) => void;
}

export function SquareCardForm({
  depositAmount,
  serviceName,
  serviceId,
  formData,
  onSuccess,
  onError,
}: SquareCardFormProps) {
  const [loading, setLoading] = useState(false);
  const [cardReady, setCardReady] = useState(false);
  const cardRef = useRef<SquareCard | null>(null);
  const paymentsRef = useRef<SquarePayments | null>(null);

  useEffect(() => {
    const init = async () => {
      if (!window.Square) return;
      try {
        const payments = await window.Square.payments(
          process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID!,
          process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID!
        );
        paymentsRef.current = payments;
        const card = await payments.card();
        await card.attach("#square-card-container");
        cardRef.current = card;
        setCardReady(true);
      } catch (err) {
        console.error("Failed to initialize Square card:", err);
        onError("Failed to load payment form");
      }
    };
    init();

    return () => {
      cardRef.current?.destroy();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePayment = useCallback(async () => {
    if (!cardRef.current || !paymentsRef.current) return;
    setLoading(true);
    try {
      const tokenResult = await cardRef.current.tokenize();
      if (tokenResult.status !== "OK" || !tokenResult.token) {
        onError(tokenResult.errors?.[0]?.message || "Card validation failed");
        setLoading(false);
        return;
      }

      // SCA / 3DS verification (optional, not required for all transactions)
      let verificationToken: string | undefined;
      try {
        const verifyResult = await paymentsRef.current.verifyBuyer(
          tokenResult.token,
          {
            amount: depositAmount.toFixed(2),
            billingContact: {
              givenName:
                (formData.fullName as string)?.split(" ")[0] || "",
              familyName:
                (formData.fullName as string)?.split(" ").slice(1).join(" ") ||
                "",
            },
            currencyCode: "USD",
            intent: "CHARGE",
          }
        );
        verificationToken = verifyResult?.token;
      } catch {
        // Verification not required for all transactions
      }

      const res = await fetch("/api/square/process-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: tokenResult.token,
          verificationToken,
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
        onError(data.error || "Payment failed. Please try again.");
      }
    } catch (err) {
      console.error("Payment error:", err);
      onError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [depositAmount, serviceName, serviceId, formData, onSuccess, onError]);

  return (
    <div>
      <div
        id="square-card-container"
        className="min-h-[90px] rounded-control border border-light-tan"
      />
      <Button
        type="button"
        onClick={handlePayment}
        disabled={loading || !cardReady}
        className="w-full mt-3"
      >
        {loading ? "Processing..." : `Pay $${depositAmount.toFixed(2)} Deposit`}
      </Button>
    </div>
  );
}

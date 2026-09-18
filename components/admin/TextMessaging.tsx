"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Proves the appointment texts work, without taking a booking to find out.
 *
 * Two things are reported separately on purpose, because they fail for
 * different reasons and the difference is the whole point:
 *
 *   Accepted  — Twilio took the message. The account details are right.
 *   Delivered — the carrier put it on the handset. The campaign, the sending
 *               number and the destination are all right too.
 *
 * A message can be accepted and then never delivered, which is what happens
 * when an A2P campaign is registered but the number sending it has not been
 * attached to it. Reporting "sent" on the first of those would say everything
 * is fine while no client ever receives a word.
 */

type Phase = "idle" | "sending" | "accepted" | "settled" | "error";

interface Settled {
  status: string;
  errorCode: number | null;
  errorMessage: string | null;
}

// Twilio's terminal states. Anything else is still in flight.
const FINAL = new Set(["delivered", "undelivered", "failed", "canceled"]);

export function TextMessaging() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [phone, setPhone] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [settled, setSettled] = useState<Settled | null>(null);

  // Cleared on unmount so a poll in flight cannot set state on a dead
  // component if she navigates away mid-test.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/test-sms")
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (cancelled || !body) return;
        setConfigured(Boolean(body.configured));
        if (body.defaultPhone) setPhone(String(body.defaultPhone));
      })
      .catch(() => {
        if (!cancelled) setConfigured(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Ask Twilio what became of the message. Delivery takes a few seconds on a
   * good day, so this checks for about half a minute and then stops rather
   * than polling forever: a message still queued after that is a real answer
   * in itself, and her phone is the tiebreaker either way.
   */
  const followUp = useCallback(async (sid: string) => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      if (!alive.current) return;

      try {
        const res = await fetch(
          `/api/admin/test-sms?sid=${encodeURIComponent(sid)}`
        );
        const body = await res.json();
        if (!res.ok) continue;

        if (FINAL.has(body.status)) {
          if (!alive.current) return;
          setSettled(body as Settled);
          setPhase("settled");
          return;
        }
      } catch {
        // A blip while polling is not a failed send. Keep asking.
      }
    }
    if (!alive.current) return;
    setSettled({ status: "queued", errorCode: null, errorMessage: null });
    setPhase("settled");
  }, []);

  const send = async () => {
    setPhase("sending");
    setError(null);
    setSettled(null);

    try {
      const res = await fetch("/api/admin/test-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const body = await res.json();

      if (!res.ok) {
        setError(body.error || "Couldn't send the test text.");
        setPhase("error");
        return;
      }

      setPhase("accepted");
      followUp(body.sid);
    } catch {
      setError("Couldn't reach the server. Try again.");
      setPhase("error");
    }
  };

  const busy = phase === "sending" || phase === "accepted";

  return (
    <div className="bg-white rounded-surface shadow-[0_1px_4px_rgba(0,0,0,0.06)] p-5 mb-6">
      <h2 className="font-display text-[18px] font-bold text-dark-brown">
        Appointment texts
      </h2>
      <p className="font-sans text-[14px] text-muted mt-1 leading-[1.5] max-w-[60ch]">
        Sends one real text to the number below so you can check the setup
        works before a client depends on it. It costs one message and nothing
        else — no booking is made and nobody else is texted.
      </p>

      {configured === false && (
        <p
          role="alert"
          className="font-sans text-[14px] text-danger mt-3 max-w-[60ch]"
        >
          Twilio isn&apos;t switched on. All three settings — TWILIO_ACCOUNT_SID,
          TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER — have to be in Vercel, and
          the site has to be redeployed afterwards for them to take effect.
        </p>
      )}

      {configured === true && (
        <p className="font-sans text-[14px] text-charcoal mt-3">
          Twilio is switched on.
        </p>
      )}

      <div className="flex flex-col gap-3 max-w-[260px] mt-4">
        <Input
          id="testSmsPhone"
          label="Send to"
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          // This card sits inside the settings form, so Enter here would
          // otherwise submit that form and save every setting on the page —
          // a surprising thing to have happen while typing a phone number.
          // Enter does the obvious local thing instead.
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            if (!busy && configured !== false) send();
          }}
        />
        <Button
          type="button"
          variant="secondary"
          onClick={send}
          disabled={busy || configured === false}
        >
          {phase === "sending"
            ? "Sending…"
            : phase === "accepted"
              ? "Waiting for delivery…"
              : "Send a test text"}
        </Button>
      </div>

      {phase === "error" && error && (
        <p role="alert" className="font-sans text-[14px] text-danger mt-3 max-w-[60ch]">
          {error}
        </p>
      )}

      {phase === "accepted" && (
        <p className="font-sans text-[14px] text-charcoal mt-3 max-w-[60ch]">
          Twilio accepted it. Checking whether it actually reaches the
          phone&nbsp;…
        </p>
      )}

      {phase === "settled" && settled && (
        <div className="font-sans text-[14px] mt-3 max-w-[60ch]">
          {settled.status === "delivered" ? (
            <p className="text-success font-semibold">
              Delivered. Appointment texts are working.
            </p>
          ) : settled.status === "queued" ? (
            <p className="text-charcoal">
              Twilio took it but hasn&apos;t confirmed delivery yet. Check the
              phone — if it arrived, you&apos;re fine. If nothing turns up in a
              few minutes, the message log in the Twilio Console will say why.
            </p>
          ) : (
            <div className="text-danger">
              <p className="font-semibold">
                Not delivered — Twilio says &ldquo;{settled.status}&rdquo;
                {settled.errorCode ? ` (error ${settled.errorCode})` : ""}.
              </p>
              {settled.errorMessage && (
                <p className="mt-1">{settled.errorMessage}</p>
              )}
              <p className="text-muted mt-2">
                The usual cause is the sending number not being attached to
                your approved A2P campaign. In the Twilio Console that is
                Messaging → Services: the number has to be in the Messaging
                Service the campaign belongs to.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

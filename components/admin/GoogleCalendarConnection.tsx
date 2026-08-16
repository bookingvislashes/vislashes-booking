"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

interface Status {
  configured: boolean;
  connected: boolean;
  email?: string | null;
  connectedAt?: string | null;
  /** Set when the credentials are present but cannot work — see the API. */
  problem?: string | null;
}

// Google hands control back with ?google=<result>. Anything unmapped is
// reported generically rather than echoed, so a crafted URL cannot put
// arbitrary text on the page.
const CALLBACK_MESSAGES: Record<string, string> = {
  connected: "",
  cancelled: "Connection cancelled — nothing was changed.",
  invalid_state:
    "That sign-in link had expired. Please try connecting again.",
  no_refresh_token:
    "Google didn't return the long-term permission we need. Try again and make sure you press Allow.",
  unconfigured:
    "The Google keys aren't set up on this deployment yet.",
  failed: "Something went wrong connecting to Google. Please try again.",
};

export function GoogleCalendarConnection() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const callbackResult = searchParams.get("google");

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/google/status");
      if (!res.ok) throw new Error();
      setStatus(await res.json());
    } catch {
      setStatus({ configured: false, connected: false });
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const disconnect = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/google/disconnect", { method: "POST" });
      if (!res.ok) throw new Error();
      await fetchStatus();
    } catch {
      setError("Couldn't disconnect. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const callbackMessage =
    callbackResult && callbackResult !== "connected"
      ? CALLBACK_MESSAGES[callbackResult] ??
        "Something went wrong connecting to Google."
      : null;

  return (
    <div className="bg-white rounded-surface p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] mb-6">
      <h2 className="font-display text-[18px] font-bold text-dark-brown mb-1">
        Google Calendar
      </h2>
      <p className="font-sans text-[13px] text-muted mb-4 max-w-[52ch]">
        Put every new appointment straight onto your calendar, so it shows up
        on your phone alongside everything else.
      </p>

      {status === null && (
        <div className="h-control w-[200px] rounded-control bg-light-tan/70 animate-pulse" />
      )}

      {status && !status.configured && (
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="w-3 h-3 rounded-full bg-muted mt-1.5 shrink-0"
          />
          <div>
            <p className="font-sans text-[14px] text-charcoal font-semibold">
              Not set up yet
            </p>
            <p className="font-sans text-[13px] text-muted mt-1 max-w-[46ch]">
              This needs a Google account key added to the site before it can
              be switched on. Everything else is ready and waiting for it.
            </p>
          </div>
        </div>
      )}

      {status?.configured && status.connected && (
        <div className="flex items-start gap-4 flex-wrap">
          <div className="min-w-0">
            <span className="flex items-center gap-2 font-sans text-[14px] text-success font-semibold">
              <span
                aria-hidden="true"
                className="w-2 h-2 rounded-full bg-success"
              />
              Connected
            </span>
            {/* Indented to clear the status dot so it reads as belonging to
                "Connected". break-all because a long address has nowhere to go
                on a phone, which is where she uses this. */}
            {status.email && (
              <p className="font-sans text-[13px] text-charcoal mt-1 pl-4 break-all">
                {status.email}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={disconnect}
            disabled={busy}
          >
            {busy ? "Disconnecting..." : "Disconnect"}
          </Button>
        </div>
      )}

      {status?.configured && !status.connected && status.problem && (
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="w-3 h-3 rounded-full bg-danger mt-1.5 shrink-0"
          />
          <div>
            <p className="font-sans text-[14px] text-charcoal font-semibold">
              Check the Google keys
            </p>
            <p className="font-sans text-[13px] text-muted mt-1 max-w-[46ch]">
              {status.problem}
            </p>
          </div>
        </div>
      )}

      {status?.configured && !status.connected && !status.problem && (
        // A plain link, not fetch: this begins a full-page redirect out to
        // Google's consent screen and back.
        <a
          href="/api/google/connect"
          className="inline-flex items-center justify-center box-border font-sans font-semibold rounded-control border-2 transition-[color,background-color,border-color,transform] duration-150 cursor-pointer active:scale-[0.98] bg-text-brown text-white border-transparent hover:bg-deep-brown h-control text-[14px] px-7"
        >
          Connect Google Calendar
        </a>
      )}

      {(callbackMessage || error) && (
        <p role="alert" className="font-sans text-[13px] text-danger mt-3">
          {error || callbackMessage}
        </p>
      )}

      {status?.connected && (
        <p className="font-sans text-[13px] text-muted mt-3 max-w-[52ch]">
          Cancelling an appointment here removes it from your calendar too.
          Appointments already on the calendar stay there if you disconnect.
        </p>
      )}
    </div>
  );
}

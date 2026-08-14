"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

// iOS exposes this on navigator when the page is running as a home-screen
// app; it is not in the standard DOM lib types.
interface StandaloneNavigator extends Navigator {
  standalone?: boolean;
}

type Status =
  | "checking"
  | "unsupported"
  | "not-installed"
  | "denied"
  | "off"
  | "on"
  | "error";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as StandaloneNavigator).standalone === true
  );
}

// applicationServerKey must be a Uint8Array over a plain ArrayBuffer, not the
// base64url string the server hands out — TS's BufferSource type rejects a
// Uint8Array whose backing buffer type is only inferred as ArrayBufferLike.
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export function PushNotifications() {
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const checkStatus = useCallback(async () => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setStatus("unsupported");
      return;
    }

    // iOS refuses Notification.requestPermission() from an ordinary Safari
    // tab — this only works once the admin has been added to the home
    // screen and is being viewed as its own app.
    if (!isStandalone()) {
      setStatus("not-installed");
      return;
    }

    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }

    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      const reg = registrations.find((r) =>
        r.active?.scriptURL.endsWith("/sw-push.js")
      );
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      setStatus(sub ? "on" : "off");
    } catch {
      setStatus("off");
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const enable = async () => {
    setBusy(true);
    setError(null);
    try {
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        throw new Error(
          "Notifications aren't set up on this deployment yet."
        );
      }

      const reg = await navigator.serviceWorker.register("/sw-push.js");
      await navigator.serviceWorker.ready;

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        setBusy(false);
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("The browser did not return a usable subscription.");
      }

      const { error: dbError } = await supabase
        .from("push_subscriptions")
        .upsert(
          {
            endpoint: json.endpoint,
            p256dh: json.keys.p256dh,
            auth: json.keys.auth,
          },
          { onConflict: "endpoint" }
        );

      if (dbError) throw new Error(dbError.message);

      setStatus("on");
    } catch (err) {
      console.error("Push enable failed:", err);
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setError(null);
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      const reg = registrations.find((r) =>
        r.active?.scriptURL.endsWith("/sw-push.js")
      );
      const sub = reg ? await reg.pushManager.getSubscription() : null;

      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
      }

      setStatus("off");
    } catch (err) {
      console.error("Push disable failed:", err);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-surface p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] mb-6">
      <h2 className="font-display text-[18px] font-bold text-dark-brown mb-1">
        Notifications
      </h2>
      <p className="font-sans text-[13px] text-muted mb-4 max-w-[52ch]">
        Get an alert on this device the moment a new appointment is booked.
      </p>

      {status === "checking" && (
        <div className="h-control w-[180px] rounded-control bg-light-tan/70 animate-pulse" />
      )}

      {status === "unsupported" && (
        <p className="font-sans text-[14px] text-muted">
          This browser doesn&apos;t support notifications. Try Safari on
          iPhone or Chrome on Android.
        </p>
      )}

      {status === "not-installed" && (
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="w-3 h-3 rounded-full bg-muted mt-1.5 shrink-0"
          />
          <div>
            <p className="font-sans text-[14px] text-charcoal font-semibold">
              Add this to your home screen first
            </p>
            <p className="font-sans text-[13px] text-muted mt-1 max-w-[46ch]">
              iPhone only allows notifications for apps added to the home
              screen. In Safari, tap Share, then &quot;Add to Home Screen,&quot;
              then open VIS Admin from there and come back to this page.
            </p>
          </div>
        </div>
      )}

      {status === "denied" && (
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="w-3 h-3 rounded-full bg-danger mt-1.5 shrink-0"
          />
          <div>
            <p className="font-sans text-[14px] text-charcoal font-semibold">
              Notifications are blocked for this app
            </p>
            <p className="font-sans text-[13px] text-muted mt-1 max-w-[46ch]">
              iPhone Settings → Notifications → VIS Admin → turn Allow
              Notifications on, then reload this page.
            </p>
          </div>
        </div>
      )}

      {(status === "off" || status === "error") && (
        <div>
          <Button onClick={enable} disabled={busy}>
            {busy ? "Enabling..." : "Enable Notifications"}
          </Button>
          {error && (
            <p role="alert" className="font-sans text-[13px] text-danger mt-2">
              {error}
            </p>
          )}
        </div>
      )}

      {status === "on" && (
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2 font-sans text-[14px] text-success font-semibold">
            <span
              aria-hidden="true"
              className="w-2 h-2 rounded-full bg-success"
            />
            Notifications on
          </span>
          <Button variant="ghost" size="sm" onClick={disable} disabled={busy}>
            {busy ? "Turning off..." : "Turn off"}
          </Button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

// applicationServerKey must be a Uint8Array — the subscribe() call rejects a
// bare base64url string.
function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

type Status = "unsupported" | "unconfigured" | "checking" | "off" | "on" | "denied";

export function PushNotificationSetup() {
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    if (!VAPID_PUBLIC_KEY) {
      setStatus("unconfigured");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }

    navigator.serviceWorker
      .getRegistration("/sw-push.js")
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => setStatus(sub ? "on" : "off"))
      .catch(() => setStatus("off"));
  }, []);

  const handleEnable = async () => {
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw-push.js");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const json = subscription.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });

      if (!res.ok) throw new Error("Server rejected the subscription");
      setStatus("on");
    } catch {
      setError("Couldn't turn on notifications. Please try again.");
      setStatus("off");
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw-push.js");
      const subscription = await registration?.pushManager.getSubscription();

      if (subscription) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setStatus("off");
    } catch {
      setError("Couldn't turn off notifications. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const dot =
    status === "on"
      ? "bg-success"
      : status === "denied" || status === "unconfigured" || status === "unsupported"
        ? "bg-muted"
        : "bg-muted";

  return (
    <div className="bg-white rounded-surface p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] mb-6">
      <h2 className="font-display text-[18px] font-bold text-dark-brown mb-4">
        Push Notifications
      </h2>
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className={`w-3 h-3 rounded-full mt-1.5 shrink-0 ${dot}`} />
        <div className="flex-1">
          {status === "checking" && (
            <p className="font-sans text-[16px] text-muted">Checking...</p>
          )}

          {status === "unsupported" && (
            <>
              <p className="font-sans text-[16px] text-charcoal">Not supported</p>
              <p className="font-sans text-[16px] text-muted leading-[1.5] mt-1 max-w-[46ch]">
                This browser doesn&apos;t support push notifications. Try a recent
                version of Chrome, Edge, or Safari.
              </p>
            </>
          )}

          {status === "unconfigured" && (
            <>
              <p className="font-sans text-[16px] text-charcoal">Not available yet</p>
              <p className="font-sans text-[16px] text-muted leading-[1.5] mt-1 max-w-[46ch]">
                The server isn&apos;t configured for push notifications yet
                (missing VAPID keys).
              </p>
            </>
          )}

          {status === "denied" && (
            <>
              <p className="font-sans text-[16px] text-charcoal">Blocked</p>
              <p className="font-sans text-[16px] text-muted leading-[1.5] mt-1 max-w-[46ch]">
                Notifications are blocked for this site in your browser
                settings. Allow them there, then reload this page.
              </p>
            </>
          )}

          {(status === "on" || status === "off") && (
            <>
              <p className="font-sans text-[16px] text-charcoal">
                {status === "on" ? "On for this device" : "Off for this device"}
              </p>
              <p className="font-sans text-[16px] text-muted leading-[1.5] mt-1 max-w-[46ch]">
                Get notified about new bookings even when the admin app isn&apos;t
                open. This is per-device — turn it on separately on your phone
                and laptop.
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-3"
                disabled={busy}
                onClick={status === "on" ? handleDisable : handleEnable}
              >
                {busy ? "Working..." : status === "on" ? "Turn Off" : "Turn On"}
              </Button>
            </>
          )}

          {error && (
            <p role="alert" className="text-danger text-[14px] font-sans mt-2">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

let configured = false;

function configure(): boolean {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;

  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:admin@vislashes.com",
      publicKey,
      privateKey
    );
    configured = true;
    return true;
  } catch (err) {
    // A malformed key pasted into Vercel should silently disable
    // notifications, not take down the booking request that triggered this.
    console.error("Push: invalid VAPID configuration:", err);
    return false;
  }
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/**
 * Notifies every device subscribed from the admin Settings page. Called
 * inline from the booking flow, so failure here must never propagate — a
 * booking that just charged a real card has to succeed regardless of whether
 * anyone's phone happens to be reachable. Every error is caught and logged,
 * never thrown.
 */
export async function notifyAdmins(
  supabase: SupabaseClient,
  payload: PushPayload
): Promise<void> {
  if (!configure()) return; // Not set up yet — silently skip.

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth");

  if (error) {
    console.error("Push: could not load subscriptions:", error);
    return;
  }
  if (!subs || subs.length === 0) return;

  const body = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number } | undefined)
          ?.statusCode;
        // 404/410 mean the browser has invalidated this subscription — she
        // removed the app, cleared its data, or it silently expired. Retrying
        // it on every future booking would only accumulate failures, so it is
        // removed rather than left to fail forever.
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        } else {
          console.error("Push: send failed for", sub.endpoint, err);
        }
      }
    })
  );
}

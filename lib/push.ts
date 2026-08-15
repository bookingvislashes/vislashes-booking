import webpush from "web-push";
import { createServiceClient } from "./supabase/server";

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || "";
const vapidSubject = process.env.VAPID_SUBJECT || "";

export function isPushConfigured(): boolean {
  return Boolean(vapidPublicKey && vapidPrivateKey && vapidSubject);
}

let configured = false;
function ensureConfigured() {
  if (configured) return;
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  configured = true;
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/**
 * Best-effort fan-out to every subscribed admin device. Never throws — a
 * missing VAPID config or a rejected push must not take down the booking
 * flow that triggered it, the way a failed confirmation email doesn't either.
 *
 * A 404/410 from the push service means the browser subscription is gone
 * (uninstalled, permission revoked, endpoint expired) — those rows are
 * deleted so the table doesn't accumulate dead endpoints forever.
 */
export async function sendPushToAdmins(payload: PushPayload): Promise<void> {
  if (!isPushConfigured()) return;

  try {
    ensureConfigured();
    const supabase = await createServiceClient();
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth");

    if (!subscriptions?.length) return;

    const body = JSON.stringify(payload);

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            body
          );
        } catch (err) {
          const statusCode = (err as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          } else {
            console.error("Push send failed:", err);
          }
        }
      })
    );
  } catch (err) {
    console.error("sendPushToAdmins failed:", err);
  }
}

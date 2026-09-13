import crypto from "node:crypto";

/**
 * The link in a client's confirmation that lets them move their own
 * appointment.
 *
 * Signed rather than stored. A token column on `bookings` would mean a
 * migration she has to run by hand before a single confirmation could carry
 * the link, and a booking written before that ran would silently go out
 * without one. An HMAC of the booking id needs no schema change and no
 * backfill: every appointment, past or future, already has a valid link.
 *
 * The signature is the whole credential, so it is derived from a server-only
 * secret and compared in constant time. RESCHEDULE_LINK_SECRET when it is
 * set; otherwise the service-role key, which is already required for the app
 * to function server-side and never leaves it. HMAC is one-way, so a link
 * cannot be worked back into the key it was signed with.
 */

const LABEL = "vislashes:reschedule:v1";

function signingKey(): string | null {
  const explicit = (process.env.RESCHEDULE_LINK_SECRET || "").trim();
  if (explicit) return explicit;
  const fallback = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  return fallback || null;
}

function sign(bookingId: string, key: string): string {
  return crypto
    .createHmac("sha256", `${LABEL}:${key}`)
    .update(bookingId)
    .digest("hex")
    .slice(0, 32);
}

/** `<booking id>.<signature>`, or null when no secret is configured. */
export function rescheduleToken(bookingId: string): string | null {
  const key = signingKey();
  return key ? `${bookingId}.${sign(bookingId, key)}` : null;
}

/** The booking id a token proves ownership of, or null if it proves nothing. */
export function bookingIdFromToken(token: string): string | null {
  const key = signingKey();
  if (!key) return null;

  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;

  const bookingId = token.slice(0, dot);
  const provided = token.slice(dot + 1);

  // Shape-checked before any comparison: a uuid and 32 hex characters are the
  // only things this ever issues, and it keeps malformed input away from the
  // buffer comparison below.
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      bookingId
    ) ||
    !/^[0-9a-f]{32}$/.test(provided)
  ) {
    return null;
  }

  const expected = sign(bookingId, key);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) return null;

  return crypto.timingSafeEqual(a, b) ? bookingId : null;
}

/** The full link for an email, or null when it cannot be built. */
export function rescheduleUrl(bookingId: string): string | null {
  const base = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
  const token = rescheduleToken(bookingId);
  return base && token ? `${base}/reschedule/${token}` : null;
}

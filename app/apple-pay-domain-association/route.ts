/**
 * Serves Apple's domain verification file at
 * `/.well-known/apple-developer-merchantid-domain-association`
 * (see the rewrite in next.config.ts — Next ignores dot-directories under
 * app/, so the route lives here and the well-known path maps onto it).
 *
 * Apple fetches this to prove we control the domain before Apple Pay will
 * render. Square hosts the canonical copy and warns that it changes:
 *
 *   "This file is subject to change; we strongly recommend checking for
 *    updates regularly and avoiding long-lived caches that might not keep in
 *    sync with the correct file version."
 *
 * So rather than committing a snapshot that silently rots — and would then
 * fail a re-validation months later with no obvious cause — this proxies
 * Square's copy and re-checks hourly. The tradeoff is a runtime dependency on
 * Square being reachable, which the payment flow already has anyway.
 */

const SQUARE_ASSOCIATION_FILE =
  "https://app.squareup.com/digital-wallets/apple-pay/apple-developer-merchantid-domain-association";

// Re-fetch at most once an hour; Apple's validation is infrequent and this
// keeps a Square outage from becoming a request-per-visit stampede.
export const revalidate = 3600;

export async function GET() {
  try {
    const res = await fetch(SQUARE_ASSOCIATION_FILE, {
      next: { revalidate },
    });

    if (!res.ok) {
      console.error(
        `Apple Pay domain association: Square returned ${res.status}`
      );
      return new Response("Verification file unavailable", { status: 503 });
    }

    const body = await res.text();

    return new Response(body, {
      status: 200,
      headers: {
        // Apple is strict about getting the raw token back. text/plain avoids
        // any chance of a framework or CDN trying to interpret it.
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("Apple Pay domain association fetch failed:", err);
    return new Response("Verification file unavailable", { status: 503 });
  }
}

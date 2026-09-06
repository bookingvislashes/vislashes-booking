/**
 * Wait for the Square Web Payments SDK to appear on `window`.
 *
 * The SDK is loaded in the root layout with `strategy="lazyOnload"`, which
 * defers it until the browser is idle after the load event. Any component that
 * checks `window.Square` once, at mount, is therefore racing that script — and
 * losing the race is silent. That is exactly how the Apple Pay button went
 * missing: SquareWalletButton did `if (!window.Square) return;` with nothing to
 * retry it, so on any load where the SDK had not landed yet the wallet was
 * never initialised and the button simply never rendered. Nothing errored,
 * nothing logged, and it looked like an Apple or a domain-registration problem.
 *
 * The invoice payment form already polled for this and was the one payment
 * surface that worked reliably. This is that logic, in one place, so a fourth
 * payment component cannot reintroduce the same bug.
 *
 * Resolves with the SDK, or null if it never arrived inside the timeout —
 * callers surface that to the customer rather than rendering a dead form.
 */
export async function waitForSquare(
  timeoutMs = 6000,
  isCancelled: () => boolean = () => false
): Promise<typeof window.Square | null> {
  const intervalMs = 100;
  const attempts = Math.ceil(timeoutMs / intervalMs);

  for (let i = 0; i < attempts; i += 1) {
    if (isCancelled()) return null;
    if (window.Square) return window.Square;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return window.Square ?? null;
}

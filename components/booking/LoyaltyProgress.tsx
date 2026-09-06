"use client";

import { useSyncExternalStore } from "react";

/**
 * The loyalty card on the confirmation page.
 *
 * A bar of five, the client's place in it, and — on the fifth — the bar
 * giving way to the reward with confetti over it. It is the only celebratory
 * thing on an otherwise quiet receipt, so it is kept to the salon's own
 * palette and typeface: warm browns, Playfair for the number, nothing that
 * looks like a coupon.
 *
 * Every figure is worked out on the server (lib/loyalty.ts) and handed down
 * as props. Nothing here counts anything.
 */

interface LoyaltyProgressProps {
  /** Segments in a run — five, unless she changes it in Settings. */
  visitsRequired: number;
  /** Segments already behind them, before this appointment. */
  completedInCycle: number;
  /** Which segment this appointment is, 1…visitsRequired. */
  position: number;
  /** True while this appointment is still ahead of them. */
  pending: boolean;
  /** True when this appointment is the last of the run. */
  completesCycle: boolean;
  /** What a reward is worth, in dollars. */
  rewardAmount: number;
  /** A reward already taken off this appointment. */
  applied: { amount: number; note: string } | null;
}

/**
 * Fixed rather than random, for two reasons: a random scatter regenerated on
 * the server and again in the browser is a hydration mismatch, and a scatter
 * chosen once and looked at properly falls better than one rolled fresh every
 * time. Colours are the brand palette — deep brown, the two tans, the beige
 * and the one green — so it reads as the salon and not as a party popper.
 */
const CONFETTI = [
  { left: 6, delay: 0, duration: 2.6, drift: 14, spin: 540, size: 7, color: "var(--color-deep-brown)", round: true },
  { left: 14, delay: 0.32, duration: 3.1, drift: -18, spin: -420, size: 5, color: "var(--color-warm-beige)", round: false },
  { left: 21, delay: 0.12, duration: 2.4, drift: 10, spin: 640, size: 6, color: "var(--color-brand-tan)", round: false },
  { left: 28, delay: 0.68, duration: 2.9, drift: -8, spin: 380, size: 8, color: "var(--color-card-beige)", round: true },
  { left: 35, delay: 0.22, duration: 3.3, drift: 22, spin: -600, size: 5, color: "var(--color-deep-brown)", round: false },
  { left: 42, delay: 0.9, duration: 2.5, drift: -14, spin: 500, size: 7, color: "var(--color-success)", round: true },
  { left: 48, delay: 0.05, duration: 3.0, drift: 6, spin: 720, size: 6, color: "var(--color-warm-beige)", round: false },
  { left: 55, delay: 0.5, duration: 2.7, drift: -22, spin: -480, size: 8, color: "var(--color-brand-brown)", round: true },
  { left: 62, delay: 0.15, duration: 3.2, drift: 16, spin: 560, size: 5, color: "var(--color-brand-tan)", round: false },
  { left: 69, delay: 0.78, duration: 2.6, drift: -6, spin: 420, size: 7, color: "var(--color-card-beige)", round: true },
  { left: 76, delay: 0.38, duration: 2.9, drift: 20, spin: -660, size: 6, color: "var(--color-deep-brown)", round: false },
  { left: 83, delay: 0.6, duration: 3.4, drift: -16, spin: 600, size: 5, color: "var(--color-warm-beige)", round: true },
  { left: 90, delay: 0.08, duration: 2.8, drift: 8, spin: 460, size: 7, color: "var(--color-brand-tan)", round: false },
  { left: 96, delay: 0.45, duration: 3.1, drift: -12, spin: -520, size: 6, color: "var(--color-success)", round: true },
  { left: 10, delay: 1.15, duration: 2.7, drift: 18, spin: 580, size: 6, color: "var(--color-brand-brown)", round: false },
  { left: 32, delay: 1.35, duration: 3.0, drift: -20, spin: 500, size: 5, color: "var(--color-card-beige)", round: true },
  { left: 58, delay: 1.05, duration: 2.5, drift: 12, spin: -440, size: 7, color: "var(--color-warm-beige)", round: false },
  { left: 80, delay: 1.42, duration: 2.9, drift: -10, spin: 680, size: 6, color: "var(--color-deep-brown)", round: true },
] as const;

/**
 * Whether the person has asked their phone to stop moving things.
 *
 * useSyncExternalStore rather than a state-and-effect pair: the value is read
 * from the browser, not owned by React, and this is the hook that says so
 * without a render-then-correct on mount. The server snapshot is `false`
 * because the CSS guard in globals.css already flattens every animation on a
 * device that asks — this only decides whether the confetti is worth putting
 * in the page at all.
 */
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia("(prefers-reduced-motion: reduce)");
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false
  );
}

function Confetti() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-surface"
    >
      {CONFETTI.map((piece, index) => (
        <span
          key={index}
          className="absolute top-0 block"
          style={{
            left: `${piece.left}%`,
            width: piece.size,
            height: piece.round ? piece.size : piece.size * 2.2,
            backgroundColor: piece.color,
            borderRadius: piece.round ? "9999px" : "1px",
            animation: `confetti-fall ${piece.duration}s cubic-bezier(0.3, 0.6, 0.5, 1) ${piece.delay}s both`,
            ["--drift" as string]: `${piece.drift}px`,
            ["--spin" as string]: `${piece.spin}deg`,
          }}
        />
      ))}
    </div>
  );
}

function money(value: number) {
  return Number.isInteger(value) ? `$${value}` : `$${value.toFixed(2)}`;
}

/** The 1–5 bar. Filled behind them, lit where they are, waiting ahead. */
function SegmentBar({
  visitsRequired,
  completedInCycle,
  position,
  pending,
}: Pick<
  LoyaltyProgressProps,
  "visitsRequired" | "completedInCycle" | "position" | "pending"
>) {
  return (
    <ol className="flex gap-1.5 sm:gap-2" role="list">
      {Array.from({ length: visitsRequired }, (_, index) => {
        const number = index + 1;
        const isDone = number <= completedInCycle;
        const isCurrent = number === position;
        return (
          <li
            key={number}
            className={`flex-1 h-11 rounded-control flex items-center justify-center font-sans text-[15px] font-semibold animate-loyalty-segment ${
              isDone
                ? "bg-deep-brown text-white"
                : isCurrent
                  ? "bg-white text-deep-brown border-2 border-deep-brown animate-loyalty-glow"
                  : "bg-light-tan text-muted"
            }`}
            // Left to right, a beat apart, so the bar draws itself.
            style={{ animationDelay: `${120 + index * 90}ms` }}
          >
            {number}
            <span className="sr-only">
              {isDone
                ? " — visit complete"
                : isCurrent
                  ? pending
                    ? " — the appointment you just booked"
                    : " — this appointment"
                  : " — still to come"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export default function LoyaltyProgress({
  visitsRequired,
  completedInCycle,
  position,
  pending,
  completesCycle,
  rewardAmount,
  applied,
}: LoyaltyProgressProps) {
  const reducedMotion = usePrefersReducedMotion();
  // Confetti belongs to a moment, not to a screen: the fifth visit, or a
  // reward actually coming off this appointment. Never to "visit 2 of 5".
  const celebrating = completesCycle || Boolean(applied);
  const remaining = visitsRequired - position;

  return (
    <section
      aria-label="Your lash loyalty"
      className="relative bg-white rounded-surface p-5 sm:p-6 shadow-[0_1px_4px_rgba(0,0,0,0.06)] mb-6 overflow-hidden"
    >
      {celebrating && !reducedMotion && <Confetti />}

      <div className="relative">
        <p className="font-sans text-[11px] font-semibold text-muted uppercase tracking-[1.4px] mb-4">
          Your lash loyalty
        </p>

        {applied && (
          // The reward is already off this appointment. That is the strongest
          // thing this card can say, so it says it first and in the salon's
          // own typeface.
          <div className="animate-loyalty-reward mb-4 rounded-surface bg-cream border border-light-tan px-4 py-4 text-center">
            <p className="font-display text-[30px] font-bold text-dark-brown leading-none">
              {money(applied.amount)} off
            </p>
            <p className="font-sans text-[14px] text-charcoal mt-1.5">
              Already taken off this appointment.
            </p>
            <p className="font-sans text-[12px] text-muted mt-1">
              {applied.note}
            </p>
          </div>
        )}

        {completesCycle ? (
          // The fifth. The bar has done its job and gets out of the way.
          <div className="animate-loyalty-reward text-center py-2">
            <p className="font-display text-[34px] font-bold text-dark-brown leading-none">
              {money(rewardAmount)} off
            </p>
            <p className="font-display text-[18px] font-semibold text-deep-brown mt-1">
              your next set
            </p>
            <p className="font-sans text-[14px] text-charcoal mt-3 leading-[1.5]">
              {pending
                ? `This is visit ${position} — once you're out of the chair, ${money(
                    rewardAmount
                  )} comes off your next appointment. We'll apply it the moment you book.`
                : `Visit ${position} is in. ${money(
                    rewardAmount
                  )} comes off your next appointment, applied automatically when you book.`}
            </p>
          </div>
        ) : (
          <>
            <SegmentBar
              visitsRequired={visitsRequired}
              completedInCycle={completedInCycle}
              position={position}
              pending={pending}
            />
            <p className="font-sans text-[14px] text-charcoal mt-3 leading-[1.5]">
              {pending ? (
                <>
                  This one is visit{" "}
                  <span className="font-semibold text-dark-brown">
                    {position}
                  </span>{" "}
                  of {visitsRequired}.{" "}
                </>
              ) : (
                <>
                  That was visit{" "}
                  <span className="font-semibold text-dark-brown">
                    {position}
                  </span>{" "}
                  of {visitsRequired}.{" "}
                </>
              )}
              {remaining === 1
                ? `One more and your next set is ${money(rewardAmount)} off.`
                : `${remaining} more and your next set is ${money(
                    rewardAmount
                  )} off.`}
            </p>
          </>
        )}
      </div>
    </section>
  );
}

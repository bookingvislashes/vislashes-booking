"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

interface RevealProps {
  children: ReactNode;
  /** Stagger, in ms, for items revealing as a group. Keep it small. */
  delay?: number;
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * Fades a section up as it comes into view.
 *
 * This replaces an earlier version that was removed because it made the page
 * feel broken, and the difference is worth recording so it is not reintroduced:
 * the problem was never the animation, it was that the photos inside were lazy.
 * A section held at opacity 0 does not begin downloading its images until the
 * reveal fires, so the fade started on an empty box and the picture landed
 * somewhere in the middle of it. Every image on the home page is eager now, and
 * small enough to have arrived long before its section is reached, so this
 * animates content that is already there.
 *
 * Tuned to stay out of the way:
 *   - it starts BEFORE the section reaches the viewport (rootMargin), so it is
 *     essentially finished by the time she is looking at it
 *   - threshold 0, so any sliver of overlap is enough — the old 0.15 meant a
 *     tall panel had to be a sixth of the way in before anything happened
 *   - 500ms, not 700
 *   - opacity and transform only, so it never leaves the compositor
 *
 * It can never leave content permanently invisible: reduced motion or a missing
 * IntersectionObserver both resolve to revealed, and layout.tsx carries a
 * <noscript> rule that shows every [data-reveal] outright.
 */
export function Reveal({ children, delay = 0 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  // matchMedia is an external store, so it is read through the API built for
  // that rather than mirrored into state from an effect. The server snapshot
  // is `false` so SSR keeps the hidden markup and hydration stays consistent.
  const skipAnimation = useSyncExternalStore(
    subscribeToReducedMotion,
    useCallback(
      () =>
        window.matchMedia(REDUCED_MOTION_QUERY).matches ||
        typeof IntersectionObserver === "undefined",
      []
    ),
    useCallback(() => false, [])
  );

  useEffect(() => {
    if (skipAnimation) return;

    let timeoutId: ReturnType<typeof setTimeout>;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        timeoutId = setTimeout(() => setIsVisible(true), delay);
        observer.unobserve(entry.target);
      },
      {
        // Any overlap at all counts...
        threshold: 0,
        // ...against a root extended a third of a screen further down, so the
        // fade is under way before the section is actually on screen.
        rootMargin: "0px 0px 33% 0px",
      }
    );

    if (ref.current) observer.observe(ref.current);
    return () => {
      clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [delay, skipAnimation]);

  const revealed = isVisible || skipAnimation;

  return (
    <div
      ref={ref}
      data-reveal
      style={{
        transition:
          "opacity 500ms cubic-bezier(0.16, 1, 0.3, 1), transform 500ms cubic-bezier(0.16, 1, 0.3, 1)",
        // Dropped once revealed so the browser stops holding a layer for a
        // section that will never animate again.
        willChange: revealed ? "auto" : "opacity, transform",
      }}
      className={
        revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      }
    >
      {children}
    </div>
  );
}

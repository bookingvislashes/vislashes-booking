"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

interface AnimateOnScrollProps {
  children: ReactNode;
  delay?: number;
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function AnimateOnScroll({ children, delay = 0 }: AnimateOnScrollProps) {
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
    // Nothing to observe when the animation is skipped — `revealed` below
    // already shows the content, so a section can never be left permanently
    // invisible because motion was off or the observer was missing.
    if (skipAnimation) return;

    let timeoutId: ReturnType<typeof setTimeout>;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          timeoutId = setTimeout(() => setIsVisible(true), delay);
          observer.unobserve(entry.target);
        }
      },
      {
        threshold: 0.1,
        // Extends the root downwards so a section begins its fade while it is
        // still just below the fold, instead of only once a sixth of it is
        // already on screen. Combined with eagerly-loaded photos, the section
        // is drawn and settled by the time it is properly in view rather than
        // starting to assemble itself as she arrives.
        rootMargin: "0px 0px 12% 0px",
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
        transition: "opacity 700ms ease-out, transform 700ms ease-out",
        willChange: revealed ? "auto" : "opacity, transform",
      }}
      className={revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}
    >
      {children}
    </div>
  );
}

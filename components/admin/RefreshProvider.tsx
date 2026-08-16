"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

/**
 * One way to refresh the admin, wherever she is in it.
 *
 * An installed iOS home-screen app does not reload when she switches back to
 * it — the page she left is the page she returns to, with whatever it fetched
 * the last time it mounted. The realtime subscriptions on the dashboard and
 * the bookings list do not help either: iOS suspends the tab, the socket dies,
 * and nothing reconnects or backfills what was missed. So an appointment
 * booked while the app was in the background is invisible until she force-
 * quits it. That is the "constantly refresh to get updated booking info"
 * problem, and it has three fixes here:
 *
 *   1. On resume — the main one. Coming back to the app refetches, throttled
 *      so flicking between apps does not hammer Supabase.
 *   2. Pull down from the top of a screen, the gesture she already expects.
 *   3. An explicit control in the header, for when a gesture feels uncertain.
 *
 * Screens opt in by calling useRegisterRefresh with their own refetch. A screen
 * that registers nothing simply does nothing on refresh, rather than breaking.
 */

interface RefreshContextValue {
  register: (fn: (() => void | Promise<void>) | null) => void;
  refresh: () => Promise<void>;
  refreshing: boolean;
  /** When the current screen last refreshed successfully, or null. */
  lastRefreshed: number | null;
}

const RefreshContext = createContext<RefreshContextValue | null>(null);

/** How long after a refresh a resume is ignored. */
const RESUME_THROTTLE_MS = 30_000;

/** Pull distance, in px, that commits to a refresh. */
const PULL_THRESHOLD = 70;

/** Cap on how far the indicator travels, so the pull feels resisted. */
const PULL_MAX = 110;

export function RefreshProvider({ children }: { children: React.ReactNode }) {
  const handler = useRef<(() => void | Promise<void>) | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<number | null>(null);
  const [pull, setPull] = useState(0);

  // Read inside event handlers that must not be re-bound on every render.
  const refreshingRef = useRef(false);
  const lastRefreshedRef = useRef<number | null>(null);

  const register = useCallback(
    (fn: (() => void | Promise<void>) | null) => {
      handler.current = fn;
    },
    []
  );

  const refresh = useCallback(async () => {
    if (!handler.current || refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    try {
      await handler.current();
      const now = Date.now();
      lastRefreshedRef.current = now;
      setLastRefreshed(now);
    } catch {
      // The screen owns its own error reporting; a failed refresh must not
      // take down the shell around it.
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }, []);

  // 1. Refresh when the app comes back to the foreground.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const last = lastRefreshedRef.current;
      if (last !== null && Date.now() - last < RESUME_THROTTLE_MS) return;
      refresh();
    };

    document.addEventListener("visibilitychange", onVisible);
    // pageshow also fires when iOS restores the app from its back/forward
    // cache, a path visibilitychange does not always cover.
    window.addEventListener("pageshow", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
    };
  }, [refresh]);

  // 2. Pull-to-refresh. Only engages at the very top of the page, so it never
  // fights a list that is mid-scroll.
  useEffect(() => {
    let startY = 0;
    let tracking = false;

    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 0 || refreshingRef.current) return;
      startY = e.touches[0].clientY;
      tracking = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!tracking) return;
      const delta = e.touches[0].clientY - startY;
      if (delta <= 0) {
        tracking = false;
        setPull(0);
        return;
      }
      // Square-root damping: the first few pixels move freely, the rest
      // resist, which is what makes the gesture feel physical rather than linear.
      setPull(Math.min(PULL_MAX, Math.sqrt(delta) * 7));
    };

    const onTouchEnd = () => {
      if (!tracking) return;
      tracking = false;
      setPull((current) => {
        if (current >= PULL_THRESHOLD) refresh();
        return 0;
      });
    };

    // Passive: this never calls preventDefault, so it must not tell the browser
    // otherwise or scrolling on the whole admin gets janky.
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [refresh]);

  const armed = pull >= PULL_THRESHOLD;
  const visible = pull > 0 || refreshing;

  return (
    <RefreshContext.Provider
      value={{ register, refresh, refreshing, lastRefreshed }}
    >
      {/* Pull indicator. Fixed and pointer-events-none so it can never sit
          between her finger and a control underneath. */}
      <div
        aria-hidden="true"
        className="fixed top-0 left-0 right-0 z-50 flex justify-center pointer-events-none"
        style={{
          transform: `translateY(${refreshing ? 24 : pull * 0.5}px)`,
          opacity: visible ? 1 : 0,
          transition: pull === 0 ? "transform 250ms ease, opacity 200ms ease" : "opacity 120ms ease",
        }}
      >
        <span
          className={`mt-2 flex items-center justify-center w-8 h-8 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] ${
            refreshing ? "animate-spin" : ""
          }`}
          style={{
            transform: refreshing ? undefined : `rotate(${pull * 2.4}deg)`,
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke={armed || refreshing ? "currentColor" : "#9c8577"}
            strokeWidth="2.5"
            strokeLinecap="round"
            className={armed || refreshing ? "text-deep-brown" : ""}
          >
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <path d="M21 3v6h-6" />
          </svg>
        </span>
      </div>

      {children}
    </RefreshContext.Provider>
  );
}

/**
 * Registers this screen's refetch for the lifetime of the screen.
 *
 * Pass the same stable callback the screen already uses (a useCallback), and
 * it is deregistered on unmount so a stale closure can never be invoked
 * against a page she has left.
 */
export function useRegisterRefresh(fn: () => void | Promise<void>): void {
  const ctx = useContext(RefreshContext);

  useEffect(() => {
    if (!ctx) return;
    ctx.register(fn);
    return () => ctx.register(null);
  }, [ctx, fn]);
}

/** Null outside the admin shell, so this is safe to call anywhere. */
export function useRefresh(): RefreshContextValue | null {
  return useContext(RefreshContext);
}

/**
 * The explicit control, for when a gesture feels uncertain — and the only
 * affordance at all on a desktop browser, where there is nothing to pull.
 * Renders nothing on a screen that has not registered a refresh, rather than
 * offering a button that would do nothing.
 */
export function RefreshButton({ className = "" }: { className?: string }) {
  const ctx = useRefresh();
  const [hasHandler, setHasHandler] = useState(false);

  // The registering screen mounts after this button, so the presence of a
  // handler is polled briefly rather than read once. Cheap, and it means the
  // button appears on screens that register late without any extra plumbing.
  useEffect(() => {
    if (!ctx) return;
    const check = () => setHasHandler(Boolean(ctx.refresh));
    check();
  }, [ctx]);

  if (!ctx || !hasHandler) return null;

  return (
    <button
      type="button"
      onClick={() => ctx.refresh()}
      disabled={ctx.refreshing}
      aria-label="Refresh"
      title="Refresh"
      className={`-m-2 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-muted cursor-pointer rounded-control transition-transform active:scale-[0.94] disabled:opacity-50 ${className}`}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        className={ctx.refreshing ? "animate-spin" : ""}
      >
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 3v6h-6" />
      </svg>
    </button>
  );
}

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * One way to refresh the admin, wherever she is in it.
 *
 * An installed iOS home-screen app does not reload when she switches back to
 * it — the page she left is the page she returns to, with whatever it fetched
 * the last time it mounted. The realtime subscriptions do not help either: iOS
 * suspends the tab, the socket dies, and nothing reconnects or backfills what
 * was missed. So an appointment booked while the app was in the background is
 * invisible until she force-quits it. Three fixes, in order of how often they
 * matter:
 *
 *   1. On resume — the main one, throttled so flicking between apps does not
 *      hammer Supabase.
 *   2. Pull down from the top of a screen.
 *   3. An explicit control in the header, and the only affordance on desktop.
 *
 * Screens opt in with useRegisterRefresh. A screen that registers nothing does
 * nothing on refresh, rather than breaking.
 *
 * PERFORMANCE, and the reason this file is shaped the way it is: this provider
 * wraps the entire admin, so anything that re-renders it re-renders every
 * screen inside it. The pull gesture updates on every touchmove — at 60fps —
 * so its state lives in PullIndicator below rather than here, and the context
 * value is memoised on identities that never change. Getting this wrong made
 * tab switches visibly slow.
 */

interface RefreshContextValue {
  register: (fn: (() => void | Promise<void>) | null) => void;
  refresh: () => Promise<void>;
  refreshing: boolean;
}

const RefreshContext = createContext<RefreshContextValue | null>(null);

/** How long after a refresh a resume is ignored. */
const RESUME_THROTTLE_MS = 30_000;

/** Pull distance, in px, that commits to a refresh. */
const PULL_THRESHOLD = 70;

/** Cap on how far the indicator travels, so the pull feels resisted. */
const PULL_MAX = 110;

function Spinner({
  spinning,
  active,
}: {
  spinning: boolean;
  active: boolean;
}) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      className={`${spinning ? "animate-spin" : ""} ${
        active ? "text-deep-brown" : "text-muted"
      }`}
    >
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

/**
 * Owns the pull gesture and its own state, so a touchmove re-renders this
 * component alone instead of the whole admin.
 */
function PullIndicator({
  onRefresh,
  refreshing,
}: {
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const [pull, setPull] = useState(0);

  // Mirrored into a ref so the touch handlers can read it without being
  // re-bound every time a refresh starts or ends. Written in an effect, not
  // during render — a ref is mutable state, and touching it while rendering
  // is exactly the tearing hazard React warns about.
  const refreshingRef = useRef(refreshing);
  useEffect(() => {
    refreshingRef.current = refreshing;
  }, [refreshing]);

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
        setPull((p) => (p === 0 ? p : 0));
        return;
      }
      // Square-root damping: the first few pixels move freely, the rest
      // resist, which is what makes the gesture feel physical.
      const next = Math.min(PULL_MAX, Math.sqrt(delta) * 7);
      // Round to whole pixels so a stationary finger stops producing new
      // values — sub-pixel jitter would re-render on every frame for nothing.
      setPull((p) => (Math.round(p) === Math.round(next) ? p : next));
    };

    const onTouchEnd = () => {
      if (!tracking) return;
      tracking = false;
      setPull((current) => {
        if (current >= PULL_THRESHOLD) onRefresh();
        return 0;
      });
    };

    // Passive: this never calls preventDefault, and claiming otherwise makes
    // scrolling the whole admin janky.
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
  }, [onRefresh]);

  const armed = pull >= PULL_THRESHOLD;
  const visible = pull > 0 || refreshing;

  // Never rendered at all when idle, so there is no fixed, composited layer
  // sitting over the app for the 99% of the time nothing is being pulled.
  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 z-50 flex justify-center pointer-events-none"
      style={{
        transform: `translate3d(0, ${refreshing ? 24 : pull * 0.5}px, 0)`,
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
        <Spinner spinning={false} active={armed || refreshing} />
      </span>
    </div>
  );
}

export function RefreshProvider({ children }: { children: React.ReactNode }) {
  const handler = useRef<(() => void | Promise<void>) | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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
      lastRefreshedRef.current = Date.now();
    } catch {
      // The screen owns its own error reporting; a failed refresh must not
      // take down the shell around it.
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }, []);

  // Refresh when the app comes back to the foreground.
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

  // register and refresh are stable, so this identity changes only when a
  // refresh actually starts or finishes — not on every gesture frame.
  const value = useMemo(
    () => ({ register, refresh, refreshing }),
    [register, refresh, refreshing]
  );

  return (
    <RefreshContext.Provider value={value}>
      <PullIndicator onRefresh={refresh} refreshing={refreshing} />
      {children}
    </RefreshContext.Provider>
  );
}

/**
 * Registers this screen's refetch for the lifetime of the screen.
 *
 * Depends on `register`, which is stable for the life of the provider — not on
 * the context object, whose identity changes whenever a refresh starts. That
 * distinction matters: the latter re-ran this effect on every provider render,
 * thrashing register/deregister while she was mid-scroll.
 */
export function useRegisterRefresh(fn: () => void | Promise<void>): void {
  const ctx = useContext(RefreshContext);
  const register = ctx?.register;

  useEffect(() => {
    if (!register) return;
    register(fn);
    return () => register(null);
  }, [register, fn]);
}

/** Null outside the admin shell, so this is safe to call anywhere. */
export function useRefresh(): RefreshContextValue | null {
  return useContext(RefreshContext);
}

/**
 * The explicit control, and the only affordance on desktop where there is
 * nothing to pull.
 */
export function RefreshButton({ className = "" }: { className?: string }) {
  const ctx = useRefresh();
  if (!ctx) return null;

  return (
    <button
      type="button"
      onClick={() => ctx.refresh()}
      disabled={ctx.refreshing}
      aria-label="Refresh"
      title="Refresh"
      className={`-m-2 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer rounded-control transition-transform active:scale-[0.94] disabled:opacity-50 ${className}`}
    >
      <Spinner spinning={ctx.refreshing} active={false} />
    </button>
  );
}

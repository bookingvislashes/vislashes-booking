/**
 * A small on-device cache for admin screens, so the installed app opens
 * showing yesterday's answer instead of a spinner.
 *
 * localStorage rather than IndexedDB or Cache Storage: every payload here is a
 * few kilobytes of JSON read once per screen, which is exactly what
 * localStorage is good at, and it is synchronous — so a page can seed its
 * first render from cache without an effect, which both avoids a flash of
 * empty state and keeps this off the admin's set-state-in-effect lint pattern.
 *
 * This is a display cache and nothing more. Every screen still fetches on
 * mount and overwrites what it finds here. Nothing is ever WRITTEN to Supabase
 * from it, so a stale entry can never become stale data in the database.
 */

const PREFIX = "vis-admin:";

// Bumped when a cached shape changes. An entry written by an older build is
// discarded rather than fed to a component that expects different fields —
// the app updates underneath her without warning, so this will happen.
const VERSION = 1;

// Long enough to survive an overnight suspend, short enough that a genuinely
// old payload is not mistaken for live data. Screens still refetch regardless;
// this only bounds what is shown in the meantime.
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface Entry<T> {
  v: number;
  at: number;
  data: T;
}

export function readCache<T>(key: string): { data: T; age: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as Entry<T>;
    if (entry.v !== VERSION) return null;
    const age = Date.now() - entry.at;
    if (age > MAX_AGE_MS) return null;
    return { data: entry.data, age };
  } catch {
    // Private mode, a quota error, or hand-edited JSON. A cache that cannot be
    // read is simply a cache miss.
    return null;
  }
}

export function writeCache<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    const entry: Entry<T> = { v: VERSION, at: Date.now(), data };
    window.localStorage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {
    // Over quota, or storage disabled. Not being able to cache must never
    // break the screen that was trying to.
  }
}

export function clearCache(): void {
  if (typeof window === "undefined") return;
  try {
    const doomed: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(PREFIX)) doomed.push(key);
    }
    doomed.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // Nothing to do — see above.
  }
}

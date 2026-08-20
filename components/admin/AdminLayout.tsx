"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ReactNode, useState } from "react";
import { RefreshProvider, RefreshButton } from "@/components/admin/RefreshProvider";

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (name) {
    case "grid":
      return (
        <svg {...props}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      );
    case "calendar-check":
      return (
        <svg {...props}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
          <path d="M9 16l2 2 4-4" />
        </svg>
      );
    case "clock":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 3" />
        </svg>
      );
    case "users":
      return (
        <svg {...props}>
          <circle cx="9" cy="7" r="3.5" />
          <path d="M2 21v-1a5 5 0 015-5h4a5 5 0 015 5v1" />
          <circle cx="18" cy="8" r="2.5" />
          <path d="M22 21v-.5a4 4 0 00-3-3.87" />
        </svg>
      );
    case "file-text":
      return (
        <svg {...props}>
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
          <path d="M14 2v6h6M8 13h8M8 17h6" />
        </svg>
      );
    case "tag":
      return (
        <svg {...props}>
          <path d="M12 2l-8 4v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V6l-8-4z" />
          <circle cx="12" cy="11" r="2" />
        </svg>
      );
    case "receipt":
      return (
        <svg {...props}>
          <path d="M5 3v18l2-1.4 2 1.4 2-1.4 2 1.4 2-1.4 2 1.4V3l-2 1.4L13 3l-2 1.4L9 3 7 4.4 5 3z" />
          <path d="M9 8h6M9 12h6" />
        </svg>
      );
    case "sparkle":
      return (
        <svg {...props}>
          <path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4L12 3z" />
          <path d="M18.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z" />
        </svg>
      );
    case "settings":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1.08-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1.08 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001.08 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1.08z" />
        </svg>
      );
    case "ellipsis":
      return (
        <svg {...props}>
          <circle cx="5" cy="12" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="19" cy="12" r="1.5" />
        </svg>
      );
    case "database":
      return (
        <svg {...props}>
          <ellipse cx="12" cy="5" rx="8" ry="3" />
          <path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5" />
          <path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3" />
        </svg>
      );
    default:
      return null;
  }
}

const navItems = [
  { label: "Dashboard", href: "/admin", icon: "grid" },
  { label: "Bookings", href: "/admin/bookings", icon: "calendar-check" },
  { label: "Calendar", href: "/admin/calendar", icon: "clock" },
  { label: "Clients", href: "/admin/clients", icon: "users" },
  { label: "Agreements", href: "/admin/agreements", icon: "file-text" },
  { label: "Services", href: "/admin/services", icon: "tag" },
  { label: "Payments", href: "/admin/payments", icon: "receipt" },
  { label: "Settings", href: "/admin/settings", icon: "settings" },
  { label: "Migrations", href: "/admin/migrations", icon: "database" },
  { label: "What's New", href: "/admin/whats-new", icon: "sparkle" },
];

// The phone's tab bar fits five targets at a comfortable size. It used to be
// the first five nav items full stop, which quietly stranded everything after
// Agreements — Services, Payments, Settings and What's New had no route on a
// phone at all, and Settings is where notifications and the deposit live. Four
// primary destinations plus "More" reaches all of them.
const PRIMARY_TAB_COUNT = 4;
const primaryNavItems = navItems.slice(0, PRIMARY_TAB_COUNT);
const overflowNavItems = navItems.slice(PRIMARY_TAB_COUNT);

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);

  // "/admin" would prefix-match every page, so it alone is compared exactly.
  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  const overflowActive = overflowNavItems.some((item) => isActive(item.href));

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
  };

  return (
    // Wraps the whole shell so pull-to-refresh, refresh-on-resume and the
    // header control all reach whichever screen is currently mounted.
    <RefreshProvider>
    <div className="min-h-[100dvh] bg-cream">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-[200px] bg-white border-r border-light-tan p-4">
        {/* The wordmark doubles as the way back to the public site. */}
        <Link
          href="/"
          title="Back to the VIS Lashes site"
          className="flex items-baseline gap-0.5 mb-8 px-2 py-1 -mx-1 rounded-control transition-colors hover:bg-light-tan/60 active:bg-light-tan"
        >
          <span className="font-display text-[12px] font-bold text-dark-brown tracking-[3px] uppercase">
            VIS
          </span>
          <span className="font-display text-[12px] font-bold text-dark-brown tracking-[3px] uppercase italic">
            LASHES
          </span>
          <span className="font-sans text-[12px] text-muted ml-1">
            Admin
          </span>
        </Link>

        <nav className="flex flex-col gap-1 flex-1">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                // The 3px active border lives in the shared class as
                // transparent, so the label doesn't jump sideways when the
                // route changes — only the colour switches.
                className={`flex items-center gap-3 px-3 py-2 min-h-control rounded-control border-l-[3px] border-transparent text-[14px] font-sans transition-[color,background-color,border-color,transform] duration-200 active:scale-[0.98] ${
                  active
                    ? "bg-deep-brown/10 text-deep-brown font-semibold border-deep-brown"
                    : "text-charcoal hover:bg-light-tan"
                }`}
              >
                <Icon name={item.icon} size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={handleSignOut}
          className="mt-auto px-3 py-2 text-[14px] text-muted hover:text-danger font-sans text-left cursor-pointer"
        >
          Sign Out
        </button>
      </aside>

      {/* Mobile header — sticky so the way out is always reachable on a long
          list, and translucent so content passing under it reads as depth
          rather than a hard cut. pt picks up the notch inset on iOS. */}
      <header
        className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-white/85 backdrop-blur-md border-b border-light-tan"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <Link
          href="/"
          title="Back to the VIS Lashes site"
          className="flex items-baseline gap-0.5 -m-2 p-2 rounded-control transition-transform active:scale-[0.97]"
        >
          <span className="font-display text-[12px] font-bold text-dark-brown tracking-[3px] uppercase">
            VIS
          </span>
          <span className="font-display text-[12px] font-bold text-dark-brown tracking-[3px] uppercase italic">
            LASHES
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <RefreshButton />
          <button
            onClick={handleSignOut}
            className="-m-2 p-2 min-h-[44px] flex items-center text-[14px] text-muted font-sans cursor-pointer rounded-control transition-transform active:scale-[0.97]"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main content. The bottom padding has to clear the fixed tab bar AND
          the home indicator, otherwise the last row of any list is
          permanently unreachable on an iPhone. */}
      {/* As a Tailwind class rather than an inline style — inline wins at every
          breakpoint, so md:pb-6 never applied and desktop carried the mobile
          tab-bar clearance as dead space. */}
      {/* 16px baseline for the admin. Anything that doesn't set its own size
          inherits readable body text rather than the browser default. */}
      <main className="md:ml-[200px] p-4 md:p-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-6 max-w-[1100px] text-[16px]">
        {children}

        {/* Same build stamp the public footer carries, so a deploy can be
            confirmed from inside the admin without leaving it. Links to the
            release notes — the same place the version is displayed is the
            most natural thing to tap to find out what changed. What's New is
            also in the phone's More menu. */}
        <Link
          href="/admin/whats-new"
          className="mt-10 inline-block font-sans text-[12px] tracking-[0.4px] text-muted/70 tabular-nums underline decoration-transparent hover:decoration-inherit transition-colors"
        >
          {process.env.NEXT_PUBLIC_BUILD_ID}
        </Link>
      </main>

      {/* Overflow sheet. Rendered above the tab bar and dismissed by tapping
          the backdrop, the close button, or any destination inside it. */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMoreOpen(false)}
            className="absolute inset-0 w-full h-full bg-dark-brown/40 animate-fade-in cursor-default"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="More"
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-surface border-t border-light-tan pt-2 pb-[env(safe-area-inset-bottom)] animate-sheet-up"
          >
            {/* Grab handle: signals the sheet is dismissable without needing a
                visible Cancel row. */}
            <div
              aria-hidden="true"
              className="w-9 h-1 rounded-full bg-light-tan mx-auto mb-2"
            />
            {overflowNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMoreOpen(false)}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={`flex items-center gap-3 px-5 min-h-[52px] text-[16px] font-sans transition-colors ${
                  isActive(item.href)
                    ? "text-deep-brown font-semibold bg-deep-brown/5"
                    : "text-charcoal"
                }`}
              >
                <Icon name={item.icon} size={18} />
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Mobile bottom nav */}
      <nav
        // blur-md, not blur-xl. A backdrop filter re-samples everything behind
        // a full-width fixed bar on every frame, and on iOS the cost scales
        // hard with the radius — xl plus saturate made switching tabs visibly
        // slow. md reads nearly the same and composites cheaply.
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/80 backdrop-blur-md border-t border-light-tan/80 flex"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {primaryNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(item.href) ? "page" : undefined}
            className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[52px] py-2 text-[12px] font-sans transition-[color,transform] duration-150 active:scale-[0.94] ${
              isActive(item.href) ? "text-deep-brown font-semibold" : "text-muted"
            }`}
          >
            {/* Active marker rides the top edge. Scales on the x-axis rather
                than animating width, so it stays on the compositor. */}
            <span
              aria-hidden="true"
              className={`absolute top-0 h-[2px] w-8 rounded-full bg-deep-brown origin-center transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                isActive(item.href) ? "scale-x-100" : "scale-x-0"
              }`}
            />
            {/* Glass pill behind the active tab. Transform and opacity only, so
                it composites; the overshoot in the curve gives it the slight
                settle an iOS selection has. */}
            <span
              aria-hidden="true"
              className={`absolute inset-x-2 inset-y-1 rounded-control bg-light-tan/45 origin-center transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.34,1.4,0.64,1)] ${
                isActive(item.href)
                  ? "scale-100 opacity-100"
                  : "scale-75 opacity-0"
              }`}
            />
            <span className="relative">
              <Icon name={item.icon} size={18} />
            </span>
            <span className="relative">{item.label}</span>
          </Link>
        ))}

        {/* Reads as selected whenever the current page lives inside it, so the
            bar never looks like nothing is active. */}
        <button
          type="button"
          onClick={() => setMoreOpen((open) => !open)}
          aria-expanded={moreOpen}
          aria-haspopup="menu"
          className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[52px] py-2 text-[12px] font-sans transition-[color,transform] duration-150 active:scale-[0.94] cursor-pointer ${
            overflowActive || moreOpen
              ? "text-deep-brown font-semibold"
              : "text-muted"
          }`}
        >
          <span
            aria-hidden="true"
            className={`absolute top-0 h-[2px] w-8 rounded-full bg-deep-brown origin-center transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              overflowActive ? "scale-x-100" : "scale-x-0"
            }`}
          />
          <span
            aria-hidden="true"
            className={`absolute inset-x-2 inset-y-1 rounded-control bg-light-tan/45 origin-center transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.34,1.4,0.64,1)] ${
              overflowActive || moreOpen
                ? "scale-100 opacity-100"
                : "scale-75 opacity-0"
            }`}
          />
          <span className="relative">
            <Icon name="ellipsis" size={18} />
          </span>
          <span className="relative">More</span>
        </button>
      </nav>
    </div>
    </RefreshProvider>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ReactNode } from "react";

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
    case "settings":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1.08-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1.08 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001.08 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1.08z" />
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
  { label: "Settings", href: "/admin/settings", icon: "settings" },
];

// Mobile bottom nav shows first 5
const mobileNavItems = navItems.slice(0, 5);

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
  };

  return (
    <div className="min-h-[100dvh] bg-cream">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-[200px] bg-white border-r border-light-tan p-4">
        <div className="flex items-baseline gap-0.5 mb-8 px-2">
          <span className="font-display text-[12px] font-bold text-dark-brown tracking-[3px] uppercase">
            VIS
          </span>
          <span className="font-display text-[12px] font-bold text-dark-brown tracking-[3px] uppercase italic">
            LASHES
          </span>
          <span className="font-sans text-[10px] text-muted ml-1">
            Admin
          </span>
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          {navItems.map((item) => {
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-control text-[13px] font-sans transition-colors ${
                  isActive
                    ? "bg-deep-brown/10 text-deep-brown font-semibold border-l-[3px] border-deep-brown"
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
          className="mt-auto px-3 py-2 text-[13px] text-muted hover:text-danger font-sans text-left cursor-pointer"
        >
          Sign Out
        </button>
      </aside>

      {/* Mobile header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-light-tan">
        <div className="flex items-baseline gap-0.5">
          <span className="font-display text-[12px] font-bold text-dark-brown tracking-[3px] uppercase">
            VIS
          </span>
          <span className="font-display text-[12px] font-bold text-dark-brown tracking-[3px] uppercase italic">
            LASHES
          </span>
        </div>
        <button
          onClick={handleSignOut}
          className="text-[12px] text-muted font-sans cursor-pointer"
        >
          Sign Out
        </button>
      </header>

      {/* Main content */}
      <main className="md:ml-[200px] p-4 md:p-6 pb-20 md:pb-6 max-w-[1100px]">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-light-tan flex">
        {mobileNavItems.map((item) => {
          const isActive =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center py-2 text-[10px] font-sans ${
                isActive ? "text-deep-brown font-semibold" : "text-muted"
              }`}
            >
              <Icon name={item.icon} size={18} />
              <span className="mt-0.5">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

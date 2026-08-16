"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PRODUCTS_ENABLED } from "@/lib/features";

/**
 * The public site's navigation on a phone.
 *
 * There was none. The header's nav is `hidden md:flex` and the cart sits behind
 * the retail flag, so below 768px the bar held the wordmark and nothing else —
 * no way to reach Contact, and no route to booking except the hero's button,
 * which scrolls away and never comes back.
 *
 * The links are the site's own sections plus the one action that matters.
 * Booking is a filled button rather than another line of text: it is the reason
 * the site exists, and it is the only item here that leaves the page.
 */

const LINKS = [
  { label: "Home", href: "/" },
  { label: "About Vianney", href: "/#about" },
  { label: "How to Book", href: "/#how-to-book" },
  ...(PRODUCTS_ENABLED ? [{ label: "Lash Products", href: "/#products" }] : []),
  { label: "Contact", href: "/#contact" },
];

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Escape closes, and focus returns to the button that opened it — otherwise
  // focus is left on a node that has just been removed and the next Tab starts
  // from the top of the document.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Hold the page still behind the panel. Restoring the previous value rather
  // than clearing it means this cannot clobber another lock.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Move focus into the panel so a screen reader lands on the menu rather than
  // continuing to read the page underneath it.
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="mobile-menu"
        // -m-2 p-2 keeps the tap target at 44px without the icon itself
        // growing, which is the minimum iOS treats as reliably hittable.
        className="md:hidden -m-2 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-nav-brown cursor-pointer rounded-control transition-transform active:scale-[0.94]"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <line x1="3" y1="7" x2="21" y2="7" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="17" x2="21" y2="17" />
        </svg>
      </button>

      {open && (
        <div className="md:hidden fixed inset-0 z-50">
          {/* Backdrop. A button rather than a div so it is reachable by
              keyboard and announced as the way out. */}
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 w-full h-full bg-dark-brown/40 animate-fade-in cursor-default"
          />

          <div
            id="mobile-menu"
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="absolute top-0 left-0 right-0 bg-cream rounded-b-surface shadow-[0_10px_30px_rgba(0,0,0,0.15)] animate-sheet-down outline-none"
            style={{ paddingTop: "env(safe-area-inset-top)" }}
          >
            {/* Mirrors the header's own row so the panel reads as the bar
                expanding rather than a separate thing landing on top of it. */}
            <div className="flex items-center justify-between px-6 pt-[27px] pb-4">
              <span className="flex items-baseline gap-0.5">
                <span className="font-display text-[14px] font-bold text-dark-brown tracking-[3px] uppercase">
                  VIS
                </span>
                <span className="font-display text-[14px] font-bold text-dark-brown tracking-[3px] uppercase italic">
                  LASHES
                </span>
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="-m-2 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-nav-brown cursor-pointer rounded-control transition-transform active:scale-[0.94]"
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <nav className="flex flex-col px-6 pb-6">
              {LINKS.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="font-display text-[26px] text-dark-brown py-3 border-b border-light-tan/70 transition-colors active:text-brand-brown"
                >
                  {link.label}
                </Link>
              ))}

              <Link
                href="/book"
                onClick={() => setOpen(false)}
                className="mt-6 h-control inline-flex items-center justify-center bg-brand-brown text-white font-sans font-semibold text-[15px] rounded-control transition-[background-color,transform] active:scale-[0.98] hover:bg-text-brown"
              >
                Book Appointment
              </Link>

              <a
                href="https://instagram.com/vislashesbooking"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="mt-4 inline-flex items-center justify-center gap-2 font-sans text-[14px] text-charcoal py-2"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="2" y="2" width="20" height="20" rx="5" />
                  <circle cx="12" cy="12" r="5" />
                  <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                </svg>
                @vislashesbooking
              </a>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}

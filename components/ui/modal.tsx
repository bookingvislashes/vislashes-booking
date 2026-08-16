"use client";

import { ReactNode, useEffect, useId, useRef } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  // Held in a ref so the effect below can key on `isOpen` alone.
  //
  // Every caller passes this as an inline arrow (`onClose={() => setDraft(null)}`),
  // so its identity changes on every render of the parent. With `onClose` in
  // the dependency array, typing one character into a field inside the dialog
  // re-ran the whole effect: the cleanup moved focus back to whatever opened
  // the dialog and the re-run moved it to the panel, so the field lost focus
  // on every keystroke and the iOS keyboard collapsed after each letter. It
  // also unpinned and re-pinned the body and re-ran window.scrollTo each time.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    // Whatever had focus before the dialog opened gets it back on close,
    // otherwise focus falls to <body> and keyboard users lose their place.
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // iOS Safari ignores `overflow: hidden` on body — the page rubber-bands
    // under the dimmer and ends up scrolled somewhere else once the dialog
    // closes. Pinning the body at a negative offset is what actually holds it,
    // at the cost of having to restore the position by hand below.
    const scrollY = window.scrollY;
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    panelRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;

      // Keep Tab inside the dialog — without this it walks into the page
      // behind the overlay, which is inert to the mouse but not the keyboard.
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      // Before restoring focus — focusing an element first would scroll it into
      // view and fight the position we are about to set.
      window.scrollTo(0, scrollY);
      previouslyFocused?.focus();
    };
    // `onClose` is deliberately absent — see onCloseRef above. Adding it back
    // reintroduces the keystroke-by-keystroke focus loss.
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        // dvh, not vh: iOS measures vh against the large viewport, so with the
        // toolbar showing the bottom of the panel — usually the submit button —
        // sits below the fold with no way to reach it.
        className="relative bg-white rounded-surface shadow-lg max-w-lg w-full max-h-[85dvh] overflow-y-auto overscroll-contain p-6"
      >
        {title && (
          <h3
            id={titleId}
            className="text-[18px] font-bold text-dark-brown mb-4 font-display pr-8"
          >
            {title}
          </h3>
        )}
        <button
          onClick={onClose}
          // The glyph stays put optically; the hit box grows outward from
          // ~20px to the 44px minimum by moving the anchor in and padding out.
          className="absolute top-2 right-2 w-11 h-11 inline-flex items-center justify-center rounded-control text-muted hover:text-charcoal active:bg-light-tan transition-colors text-xl leading-none"
          aria-label="Close"
        >
          &times;
        </button>
        {children}
      </div>
    </div>
  );
}

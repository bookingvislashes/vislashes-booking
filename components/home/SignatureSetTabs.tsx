"use client";

import Image from "next/image";
import { useId, useRef, useState } from "react";
import { CtaLink } from "@/components/ui/CtaLink";

/**
 * The Signature Sets on a phone: a tab strip and one large portrait, instead
 * of three stacked rows.
 *
 * WHY NOT THE ROWS. The desktop layout is a circle beside its text, alternating
 * sides. Every way of squeezing that into 390px was worse than the thing it
 * replaced: stacked, it left a hundred pixels of empty space beside a
 * left-pinned photo; zigzagged, it shrank the photographs to thumbnails and
 * stacked three identical full-width buttons. The portraits are the whole
 * appeal of this section — real clients, real lashes — so here the photograph
 * gets nearly the full width of the screen.
 *
 * WHY TABS, AND NOT A CAROUSEL. All three prices stay on screen at once, which
 * is the comparison a visitor is actually making, and the three options are
 * labelled controls rather than something you have to know to swipe. The whole
 * section is about one screen tall instead of two and a half.
 *
 * It is only used below sm. From sm the original rows take over, unchanged, so
 * everything the rows render is also rendered here, and the rows are hidden
 * with `hidden` rather than removed: both are in the page's HTML, only one is
 * ever shown.
 *
 * ── How it behaves ─────────────────────────────────────────────────────────
 * All three panels sit in the same grid cell and crossfade, so the container is
 * as tall as the tallest one and nothing below it moves when the tab changes.
 * The inactive panels are `inert` and `visibility: hidden`, which takes them
 * out of the tab order and the accessibility tree; the `visibility` transition
 * keeps the outgoing panel painted until its fade has finished.
 *
 * The indicator slides with `translate`, not `transform`: Tailwind v4 compiles
 * its translate and scale utilities to the standalone CSS properties, so a
 * transition on `transform` silently does nothing (this bit CtaLink once).
 *
 * Keyboard: arrows, Home and End move between tabs and follow focus. Touch: a
 * horizontal swipe on the panel steps to the neighbour, with `touch-action:
 * pan-y` so vertical scrolling is untouched. Reduced motion turns off every
 * transition and leaves the tabs working.
 */
export interface SignatureSet {
  id: string;
  name: string;
  label: string;
  description: string;
  imageSrc: string;
}

const EASE = "ease-[cubic-bezier(0.16,1,0.3,1)]";

// "Classic Set" -> "Classic". The name comes from Services and can be anything,
// so this only trims a trailing "Set" and otherwise leaves it alone.
const shortName = (name: string) => name.replace(/\s+set$/i, "");

export function SignatureSetTabs({ sets }: { sets: SignatureSet[] }) {
  const uid = useId();
  const [index, setIndex] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const n = sets.length;

  const go = (next: number, focus = false) => {
    const i = (next + n) % n;
    setIndex(i);
    if (focus) tabRefs.current[i]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") go(index + 1, true);
    else if (e.key === "ArrowLeft") go(index - 1, true);
    else if (e.key === "Home") go(0, true);
    else if (e.key === "End") go(n - 1, true);
    else return;
    e.preventDefault();
  };

  return (
    // Capped at a phone's width and centred, so the unit keeps its proportions
    // on a wide phone or a small window instead of stretching the tab strip
    // and the button across 590px. A phone is narrower than the cap, so phones
    // are unaffected.
    <div className="mx-auto flex w-full max-w-[420px] flex-col items-center">
      {n > 1 && (
        <div
          role="tablist"
          aria-label="Choose a lash set"
          onKeyDown={onKeyDown}
          className="relative flex w-full rounded-full bg-light-tan/60 p-1"
        >
          {/* The indicator. One tab wide, moved by index. */}
          <span
            aria-hidden
            className={`absolute inset-y-1 left-1 rounded-full bg-charcoal transition-[translate] duration-300 ${EASE} motion-reduce:transition-none`}
            style={{
              width: `calc((100% - 0.5rem) / ${n})`,
              translate: `${index * 100}% 0`,
            }}
          />
          {sets.map((s, i) => {
            const active = i === index;
            return (
              <button
                key={s.id}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`${uid}-tab-${i}`}
                aria-selected={active}
                aria-controls={`${uid}-panel-${i}`}
                tabIndex={active ? 0 : -1}
                onClick={() => go(i)}
                className="relative z-10 flex-1 min-w-0 rounded-full px-2 py-2.5 text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-charcoal"
              >
                <span
                  className={`block truncate font-sans font-semibold text-[14px] leading-none transition-colors duration-300 motion-reduce:transition-none ${
                    active ? "text-cream" : "text-charcoal"
                  }`}
                >
                  {shortName(s.name)}
                </span>
                <span
                  className={`mt-1.5 block font-display font-bold text-[13px] leading-none transition-colors duration-300 motion-reduce:transition-none ${
                    active ? "text-light-tan" : "text-charcoal/75"
                  }`}
                >
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div
        className={`grid w-full touch-pan-y ${n > 1 ? "mt-9" : ""}`}
        onPointerDown={(e) => {
          swipe.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          const from = swipe.current;
          swipe.current = null;
          if (!from) return;
          const dx = e.clientX - from.x;
          const dy = e.clientY - from.y;
          // A deliberate, mostly horizontal drag — not a tap, not a scroll.
          if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
          const next = index + (dx < 0 ? 1 : -1);
          if (next >= 0 && next < n) go(next);
        }}
        onPointerCancel={() => {
          swipe.current = null;
        }}
      >
        {sets.map((s, i) => {
          const active = i === index;
          return (
            <div
              key={s.id}
              role="tabpanel"
              id={`${uid}-panel-${i}`}
              aria-labelledby={n > 1 ? `${uid}-tab-${i}` : undefined}
              inert={!active}
              className={`col-start-1 row-start-1 flex flex-col items-center text-center transition-[opacity,scale,visibility] duration-500 ${EASE} motion-reduce:transition-none ${
                active
                  ? "opacity-100 scale-100 visible"
                  : "opacity-0 scale-[0.97] invisible"
              }`}
            >
              <div className="relative shrink-0 rounded-full overflow-hidden bg-portrait-backdrop size-[min(74vw,300px)]">
                <Image
                  src={s.imageSrc}
                  /* Decorative: the set name is the heading directly below. */
                  alt=""
                  fill
                  draggable={false}
                  className="object-cover object-center select-none"
                  loading="eager"
                  unoptimized
                  sizes="300px"
                />
              </div>

              <span
                aria-hidden
                className="mt-7 font-display italic font-bold text-text-brown text-[18px]"
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-1 font-display font-bold text-charcoal text-[32px] leading-[1.1] text-balance">
                {s.name}
              </h3>
              <span className="mt-1 font-display font-bold text-muted text-[22px]">
                {s.label}
              </span>
              <p className="mt-3 max-w-[300px] font-sans text-muted text-[16px] leading-[1.6]">
                {s.description}
              </p>
              <div className="mt-6 w-full">
                <CtaLink
                  href={`/book?service=${s.id}`}
                  variant="tan"
                  size="lg"
                  font="display"
                  className="w-full"
                >
                  Book {s.name}
                </CtaLink>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";

/**
 * Real client messages and feedback (Instagram DMs, texts, Square post-sale
 * feedback) as she received them — light spelling and punctuation cleanup
 * only, no added sentiment and no added words.
 *
 * First names only, at her request. Where a quote came from is recorded per
 * entry below and deliberately NOT shown on the page — naming the platform
 * adds nothing for a reader and drags another company's brand into the middle
 * of hers.
 *
 * Her own test of a quote, applied when two of these were replaced: does it
 * show that she is good at this? "Thank you so much, I love them!" and "Great
 * experience! Beautiful work!" are warm, but any lash tech in Orlando could
 * have collected them, so they were doing nothing that the four of them
 * together could not do with three. The two that replaced them each carry
 * something specific instead — a room worth sitting in, and a set that
 * outlasted the fill it was booked for.
 *
 * Caps and spellings like "WHOLE VIBE" and "ONNNN" are how the messages
 * arrived and are the point of quoting them; do not tidy them into standard
 * English, or these stop sounding like clients and start sounding like copy.
 */
const TESTIMONIALS = [
  {
    // Square positive feedback left after a sale, tagged Environment and
    // Customer Service. "in a WHOLE VIBE" -> "is a WHOLE VIBE"; trailing
    // emoji dropped, as on every quote here.
    quote: "She is an awesome young lady. Her studio is a WHOLE VIBE.",
    name: "Kim",
  },
  {
    // Instagram DM.
    quote:
      "She walked me through the process and the environment is really relaxing.",
    name: "Gaby",
  },
  {
    // Text message.
    quote:
      "I feel so confident thanks to her. I'm keeping her card in my server book so I can send others her way.",
    name: "Mattie",
  },
  {
    // Text message, sent with a selfie. Comma after "Girl" and the closing
    // period are the only changes; the retention it describes is the whole
    // reason it is here, so it closes the list.
    quote:
      "Girl, I hate to keep rescheduling the lash fill but these lashes have stayed ONNNN.",
    name: "Valery",
  },
] as const;

/**
 * A slideshow of real client reviews, falling back to her curated quotes.
 *
 * WHERE THE QUOTES COME FROM. Reviews left through the link in the follow-up
 * email, four stars and up, which is the only kind the database will let an
 * anonymous visitor read at all. Until some have come in — and any time the
 * read fails — the four messages above stand in, so this section is never
 * empty and never a hole on the page.
 *
 * WHY A SLIDESHOW NOW. The old list printed every quote at once, which works
 * for four and stops working somewhere around eight: a page of testimonials
 * reads as a wall and gets skipped. One at a time, each quote gets the room
 * to be read.
 *
 * It advances on its own and stops the moment anyone touches it — an
 * auto-advancing panel that keeps moving while you are reading it is worse
 * than one that never moved. It also stops entirely for a visitor who has
 * asked for reduced motion, who still gets the arrows and the dots.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export interface Quote {
  quote: string;
  name: string;
}

interface TestimonialsProps {
  /** Published reviews. Empty falls back to the curated quotes above. */
  quotes?: Quote[];
}

const ADVANCE_MS = 7000;

export function Testimonials({ quotes }: TestimonialsProps) {
  const slides: Quote[] = quotes?.length ? quotes : [...TESTIMONIALS];
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const liveRef = useRef<HTMLDivElement>(null);

  const go = useCallback(
    (next: number) => setIndex((next + slides.length) % slides.length),
    [slides.length]
  );

  useEffect(() => {
    if (paused || slides.length < 2) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const timer = setTimeout(() => go(index + 1), ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [index, paused, slides.length, go]);

  const current = slides[index];

  return (
    <section className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-[120px] pb-12 sm:pb-16 lg:pb-[100px]">
      <div className="text-center mb-8 sm:mb-10 lg:mb-[56px]">
        <h2 className="font-display text-[36px] sm:text-[48px] lg:text-[56px] leading-[1.1] text-dark-brown text-balance">
          What Clients Say
        </h2>
      </div>

      <div
        className="max-w-[1000px] mx-auto"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
      >
        {/* A fixed minimum height, so a short quote followed by a long one
            does not shunt the rest of the page up and down as it advances. */}
        <div
          ref={liveRef}
          aria-live="polite"
          aria-atomic="true"
          className="min-h-[220px] sm:min-h-[200px] flex flex-col justify-center border-y border-light-tan py-8 sm:py-10"
        >
          <blockquote className="font-display text-[22px] sm:text-[28px] lg:text-[32px] leading-[1.4] text-dark-brown text-pretty text-center">
            &ldquo;{current.quote}&rdquo;
          </blockquote>
          <p className="font-sans text-[15px] font-semibold text-dark-brown text-center mt-5">
            {current.name}
          </p>
        </div>

        {slides.length > 1 && (
          <div className="flex items-center justify-center gap-4 mt-6">
            <button
              type="button"
              aria-label="Previous review"
              onClick={() => go(index - 1)}
              className="w-10 h-10 rounded-full border border-light-tan text-deep-brown hover:bg-light-tan transition-colors flex items-center justify-center"
            >
              &larr;
            </button>

            <div className="flex gap-2" role="tablist" aria-label="Reviews">
              {slides.map((slide, i) => (
                <button
                  key={`${slide.name}-${i}`}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`Review ${i + 1} of ${slides.length}`}
                  onClick={() => setIndex(i)}
                  className={`h-2 rounded-full transition-all ${
                    i === index
                      ? "w-6 bg-deep-brown"
                      : "w-2 bg-light-tan hover:bg-warm-beige"
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              aria-label="Next review"
              onClick={() => go(index + 1)}
              className="w-10 h-10 rounded-full border border-light-tan text-deep-brown hover:bg-light-tan transition-colors flex items-center justify-center"
            >
              &rarr;
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

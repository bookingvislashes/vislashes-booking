import Image from "next/image";
import { hasAsset } from "@/lib/has-asset";
import { STEPS } from "@/lib/how-to-book-steps";

/**
 * How to Book — Figma node 785:247 on the Home Page.
 *
 * The three steps are polaroids dropped on a table: white cards, each tilted a
 * few degrees, overlapping across a fixed-height box at lg. Below lg they
 * straighten out into a centred column with no overlap at all — an overlapping
 * card in a single-column stack covers the previous card's caption, which is
 * the part that has to be read.
 *
 * Step content lives in lib/how-to-book-steps.ts — see that file for why it
 * isn't declared here.
 *
 * The displayed 01 / 02 / 03 are derived at render from step.number rather
 * than stored alongside the copy. STEPS keys are "1" | "2" | "3" because they
 * are the Supabase `settings` keys (how_to_book_photo_1..3) that the admin's
 * photo uploader writes and app/page.tsx reads back — changing them to "01"
 * would silently orphan every photo she has already uploaded. The zero padding
 * is presentation, so it happens here, and the numerals are aria-hidden: they
 * are decoration on top of a list that already reads in order.
 */

/**
 * Per-card layout, indexed to match STEPS. Written out as whole class strings
 * rather than composed at runtime so Tailwind can see every utility in source.
 *
 * `left` is a percentage of the 1176px collage box, so the three cards keep
 * their spacing as the box narrows towards its max width. Card 2 is the focal
 * one at 1.15x and sits on top; it drops back to the common 340px width below
 * lg, where there is no room for a hierarchy of sizes.
 */
const POLAROIDS = [
  {
    card: "rotate-[-2deg] lg:absolute lg:left-[8%] lg:top-[70px] lg:z-10 lg:w-[340px] lg:max-w-none lg:rotate-[7deg]",
    numeral: "",
    title: "",
    body: "",
  },
  {
    card: "rotate-[2deg] lg:absolute lg:left-[33.5%] lg:top-0 lg:z-20 lg:w-[391px] lg:max-w-none lg:rotate-[-5deg] lg:p-[23px] lg:pb-[37px] lg:gap-[23px]",
    numeral: "lg:text-[25px]",
    title: "lg:text-[21px]",
    body: "lg:text-[15px]",
  },
  {
    card: "rotate-[-2deg] lg:absolute lg:left-[67.8%] lg:top-[115px] lg:z-10 lg:w-[340px] lg:max-w-none lg:rotate-[4deg]",
    numeral: "",
    title: "",
    body: "",
  },
] as const;

interface HowToBookProps {
  /** Admin-uploaded replacement for a step's photo, keyed by step number. Falls back to the default file when a step has none. */
  photoOverrides?: Partial<Record<(typeof STEPS)[number]["number"], string>>;
}

export function HowToBook({ photoOverrides }: HowToBookProps = {}) {
  return (
    // overflow-x-clip, not hidden: the tilted corners and the drop shadows sit
    // a little outside the collage box, and without this they widen the
    // document just enough to add a horizontal scrollbar on a phone. Clip only
    // constrains the x axis, so a card that runs past the box's 541px still
    // shows through into the section's bottom padding.
    <section id="how-to-book" className="bg-cream overflow-x-clip">
      <div className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-[120px] py-16 sm:py-20 lg:py-[120px]">
        <div className="flex flex-col items-center gap-6 text-center mb-10 sm:mb-14 lg:mb-[100px]">
          <h2 className="font-display font-bold text-charcoal text-[36px] sm:text-[48px] lg:text-[52px] leading-[1.1] max-w-[782px] text-balance">
            How to Book Your Lash Appointment
          </h2>
          <p className="font-sans text-muted text-[16px] leading-[1.6] max-w-[570px]">
            Three steps from choosing your set to walking into the studio —
            everything private, nothing rushed.
          </p>
        </div>

        {/* One DOM order — 1, 2, 3 — for both layouts, so the reading order
            always matches the numbering. Below lg this is a plain centred
            column; at lg it becomes the positioning context the cards are
            absolutely placed inside. */}
        <div className="flex flex-col items-center gap-8 lg:block lg:relative lg:w-full lg:max-w-[1176px] lg:mx-auto lg:h-[541px]">
          {STEPS.map((step, index) => {
            const override = photoOverrides?.[step.number];
            const src = override || step.image;
            const imageReady = Boolean(override) || hasAsset(step.image);
            const polaroid = POLAROIDS[index];

            return (
              <div
                key={step.number}
                className={`flex flex-col gap-[20px] w-full max-w-[340px] bg-white rounded-[4px] p-[20px] pb-[32px] shadow-[0_12px_12px_rgba(61,43,31,0.10)] transform-gpu ${polaroid.card}`}
              >
                {/* The source photos are 1248x832, so a square frame with
                    object-cover centre-crops them rather than letterboxing. */}
                <div className="relative aspect-square w-full overflow-hidden bg-light-tan">
                  {imageReady && (
                    <Image
                      src={src}
                      alt={step.alt}
                      fill
                      className="object-cover"
                      sizes="(min-width: 1024px) 351px, 300px"
                      loading="eager"
                      // Default files are small, unoptimised static WebPs (see
                      // below); an admin-uploaded photo comes from Supabase
                      // Storage and goes through the normal optimiser instead.
                      unoptimized={!override}
                      // These were 1.2MB PNGs — photographs in a lossless
                      // format — and are now 42-52KB WebP at the same 1248x832.
                      // At that size the optimiser has nothing left to win, and
                      // /_next/image has a cold cache after every deploy, so
                      // whoever loads the page first would wait for the
                      // transform. Unoptimised, these are served straight from
                      // the CDN as immutable static assets.
                    />
                  )}
                </div>

                <div className="flex flex-col gap-[8px]">
                  <div className="flex items-baseline gap-[8px]">
                    <span
                      aria-hidden="true"
                      className={`font-display font-bold italic text-brand-tan text-[22px] leading-none ${polaroid.numeral}`}
                    >
                      {step.number.padStart(2, "0")}
                    </span>
                    <h3
                      className={`font-display font-bold text-dark-brown text-[18px] leading-[1.2] ${polaroid.title}`}
                    >
                      {step.title}
                    </h3>
                  </div>
                  {/* 14px, where Figma says 13: the caption is set on an angle
                      and 13px is not comfortably legible rotated. */}
                  <p
                    className={`font-sans text-muted text-[14px] leading-[1.5] ${polaroid.body}`}
                  >
                    {step.body}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

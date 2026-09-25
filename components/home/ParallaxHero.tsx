import { getImageProps } from "next/image";
import { CtaLink } from "@/components/ui/CtaLink";
import { PRODUCTS_ENABLED } from "@/lib/features";

/**
 * Hero — Figma node 739:298 on the Home Page.
 *
 * One full-bleed photograph with the headline, the studio line and the booking
 * CTA sitting on top of it: a dark scrim carries the text on the left at lg and
 * along the bottom on a phone, so the copy never has to fight the photo's pale
 * upper-right corner.
 *
 * The old hero split into a text column and a photo column and painted the
 * headline with a difference blend mode, so one heading could read dark over
 * the cream page and light where it crossed the photo. That trick is gone. It
 * only worked while nothing around the heading created a stacking context,
 * which made every future z-index in this section a latent bug, and the new
 * design has no cream-to-photo boundary for the heading to cross — the text
 * sits wholly over the image, so a fixed cream is simpler and more legible.
 * With the blend gone there is no scroll maths left either: this is a plain
 * server component now.
 *
 * The filename is historical. The parallax it was named for was removed with
 * the blend; `app/page.tsx` imports `ParallaxHero`, so the name stays put
 * rather than churning an unrelated file.
 *
 * ── The copy, and why it changed ─────────────────────────────────────────
 * It used to read "Your lash appointment, without the salon." over "no
 * walk-ins, no other chairs, no rush." Both sentences describe what this is
 * *not*, and a first-time visitor who has never been to a lash salon has no
 * salon to be relieved about — the promise only lands for someone already in
 * the market. It also asked for the booking with no reason to trust her and
 * no idea what a set costs, which are the two things a cold visitor actually
 * wants before they tap.
 *
 * So the headline now leads with the result she is selling (waking up done),
 * and the studio line keeps her own "no other chairs, no rush" rhythm but
 * spends its first half on the differentiator. The second CTA goes to the
 * price list rather than off the page, because "what does it cost" is the
 * objection that otherwise sends people to Instagram to ask.
 *
 * Four elements, and no more. A version of this carried two extra lines of
 * small print — a "Lake Nona & St. Cloud · By appointment only" kicker above
 * the headline and a "certified · consultation · full sets from $85" strip
 * below the buttons — and she asked for both to go. She was right: they were
 * doing the arguing that the photograph and the headline already do, and
 * fine print stacked at both ends made a hero that had been calm look busy.
 * Everything they said still appears further down the page, where someone
 * who wants that detail is actually looking for it: the studio and the
 * booking rules in How to Book, the certification in Meet Vianney, the
 * prices on the Signature Sets the second button points at. Anything added
 * back here has to beat leaving the headline alone.
 */
export function ParallaxHero() {
  // Two crops of one photograph, chosen by the browser before it downloads
  // either. The wide frame is the desktop hero; the tall one is that same
  // frame with the flat studio wall cut away (everything left of 42%), so on a
  // phone the eye, brow and cheek fill the picture instead of the wall doing
  // it. Serving only the crop each size needs is also the reason this is a
  // <picture> and not two <Image>s — with priority set, both would download.
  //
  // fetchPriority and loading are set by hand because getImageProps does not
  // act on `priority` — <Image> is what turns that into a high-priority fetch,
  // and this is not <Image>. Left to `priority: true` the <img> came out with
  // neither attribute, for the one element on the page that is the LCP. Caught
  // by reading the rendered attributes, not by anything failing.
  //
  // There is deliberately no <link rel="preload"> as well. One was tried, with
  // media queries mirroring the <source>, and measured against none on a
  // throttled connection (1.6Mbps, 150ms, median of 9): the request started 5ms
  // earlier and LCP was 8ms later, which is noise. The <img> is server-rendered
  // at the top of the body, so the browser's own preload scanner finds it as
  // soon as the link would have; what the link added was a second copy of
  // itself in <head>.
  const common = {
    alt: "Close-up of a client's finished wispy lash set",
    fill: true,
    unoptimized: true,
    sizes: "100vw",
    loading: "eager",
    fetchPriority: "high",
  } as const;
  const { props: wide } = getImageProps({ ...common, src: "/images/hero-portrait.webp" });
  const { props: tall } = getImageProps({ ...common, src: "/images/hero-portrait-mobile.webp" });

  return (
    // The subtracted values are the measured header height at each breakpoint
    // (88px below lg, 94px at lg). They are duplicated from the header rather
    // than shared, so a change to its padding silently leaves a strip of the
    // next section showing below the fold. A height token would fix that.
    <section className="relative flex flex-col w-full overflow-hidden bg-dark-brown sm:bg-white h-[clamp(560px,calc(100svh_-_88px),760px)] lg:h-[clamp(720px,calc(100svh_-_94px),1024px)]">
      {/* Below sm (a phone) the hero is two zones, not one photograph with
          text laid on it: the picture above, the copy below, and a long fade
          so the join does not read as a seam. Laid over the picture, the
          headline sat on the eye on a short phone — measured at 375x667, its
          first line began about 70px above the bottom of the eye — and no
          scrim fixes that, because the problem is where the words are, not how
          dark they are. Here the photograph gets whatever height the copy
          leaves it, and the crop keeps the eye in the upper half of that
          whatever it turns out to be.

          From sm it is the original layout, byte for byte — checked by diffing
          screenshots against the previous build at 640, 700, 768, 940, 1024,
          1100 and 1440: the zone is absolutely positioned across the section
          again and the scrims are the ones already here. The two-zone layout
          was tried on tablets and dropped: a short, wide zone (940x480) forces
          the portrait crop into an extreme macro that softens on a retina
          screen, which is the wrong trade for a range nobody asked to change. */}
      <div className="relative min-h-0 flex-1 sm:absolute sm:inset-0 sm:flex-none">
        {/* The clip lives on this inner box, not on the zone, so the phone fade
            below can sit outside it (see there). From sm it is the same
            rectangle as the zone. */}
        <div className="absolute inset-0 overflow-hidden">
          {/* The photograph. It settles out of a 6% scale over 14s — slow enough
              to read as presence rather than motion, and it runs once so the
              page is still afterwards. Disabled outright under reduced motion.

              object-position: on a phone the crop is pinned 20% down, which
              keeps the eye in the upper half of a zone that can be anywhere from
              about 250px tall (a short phone) to 460px; from sm it is what it
              always was — 62% across on a tablet, top-centre from lg. priority + unoptimized because this is the LCP element
              and a cold /_next/image transform is the last thing it should wait
              on — getImageProps carries both through to the <img>. */}
          <picture>
            <source media="(min-width: 640px)" srcSet={wide.src} />
            <img
              {...tall}
              alt={tall.alt}
              className="object-cover object-[60%_20%] sm:object-[62%_top] lg:object-[center_top] animate-hero-drift motion-reduce:animate-none"
            />
          </picture>

          {/* Scrim, tablet: the original bottom-up one, restored for sm–lg.
              Bottom-up because the copy is anchored to the bottom edge there,
              and held stronger than the desktop ramp because at that size the
              headline sits over skin rather than the pale backdrop. */}
          <div
            aria-hidden
            className="hidden absolute inset-0 pointer-events-none sm:block lg:hidden bg-[linear-gradient(0deg,rgba(45,32,21,0.86)_0%,rgba(63,45,31,0.66)_58%,rgba(63,45,31,0)_88%)]"
          />

          {/* Scrim, lg and up.
              Shaped from the photograph rather than copied from the design. A
              horizontal luminance profile of the hero image shows a flat studio
              backdrop (luminance 199) from 0% to 42%, and the face beginning at
              43%. The text column ends at 39%. So the whole scrim can live over
              the backdrop and be gone before it reaches her.

              Figma's own stops (0.79 / 0.59 at 24.5% / 0 at 80%) were tried and
              measured 3.03:1 on the headline and 2.73:1 on the subtext — the
              design does not clear AA on its own. Holding ~0.70 across the text
              column instead brings the backdrop to roughly rgb(107,91,78), which
              measures past 4.5:1 on the subtext, while the fade completes by 60%
              so the eye and cheek are untouched.

              An earlier version instead laid a 36% brown wash over the entire
              photograph. That came from misreading node 739:299, whose brown fill
              sits *behind* the image and is invisible in the design. It is gone. */}
          <div
            aria-hidden
            className="hidden absolute inset-0 pointer-events-none lg:block bg-[linear-gradient(90deg,rgba(45,32,21,0.84)_0%,rgba(63,45,31,0.76)_26%,rgba(63,45,31,0.70)_40%,rgba(63,45,31,0)_60%)]"
          />
        </div>

        {/* Fade into the copy panel, phone only. It ends on exactly the panel's
            colour so there is no edge, and it starts high enough that the fade
            is a gradient rather than a band: the lower half of the picture is
            lips and cheek, which is the part the copy is meant to take over from.

            It is outside the clip, and runs 3px past the bottom of the zone, on
            purpose. The zone's height is whatever the copy leaves it, which is
            rarely a whole number of pixels, and the photograph's clip edge and a
            fade that stopped at that same edge each round to a device pixel on
            their own. WebKit rounded them differently, so one row of the
            photograph showed through at the join: a hairline across the face,
            found on an iPhone and reproduced in WebKit at 30 of 60 phone sizes
            (Chromium never draws it). Overshooting puts the fade's own edge over
            the section's brown, where an off-by-one row is invisible, and the
            last 3% of the ramp is solid so the photograph's clip edge sits under
            full-strength brown rather than under a still-fading gradient. */}
        <div
          aria-hidden
          className="absolute inset-x-0 -bottom-[3px] h-[calc(58%+3px)] pointer-events-none sm:hidden bg-[linear-gradient(180deg,rgba(61,43,31,0)_0%,rgba(61,43,31,0.55)_45%,rgba(61,43,31,0.94)_82%,rgb(61,43,31)_97%)]"
        />
      </div>

      <div className="relative z-10 w-full max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-[120px] flex flex-col -mt-14 pb-9 sm:mt-0 sm:h-full sm:justify-end sm:pb-12 lg:justify-center lg:pb-0">
        {/* Where and how, in one line above the headline, so the headline
            itself never has to spend words on logistics. "By appointment
            only" is the same fact the old subtext spent "no walk-ins" on. */}
        <h1 className="font-display font-bold text-cream text-[40px] sm:text-[52px] lg:text-[64px] leading-[1.04] max-w-[500px] max-sm:text-balance animate-fade-in-up">
          Wake up with your lashes already done.
        </h1>

        {/* The line used to end "— no other chairs, no rush", which is the
            last survivor of the old all-negatives hero and reads as a slogan
            rather than as her. What it was there to say is now carried by the
            two plain facts in front of it: one-on-one, and a private home
            studio. */}
        <p className="mt-5 font-sans text-light-tan text-[16px] lg:text-[17px] leading-[1.45] max-w-[440px] animate-fade-in-up [animation-delay:120ms]">
          Every set is mapped to your own eye shape and applied one-on-one in
          Vianney&apos;s private home studio.
        </p>

        {/* Two CTAs, clearly ranked. The primary is the light button so it is
            the brightest object in the text column; the second is the outlined
            `onImage` variant, which is the one already drawn for sitting on a
            photograph.

            The design's CTA is "Shop Our Collection", pointing at retail.
            Retail is off (lib/features.ts), #products does not render, and
            the rest of the site already resolves that same conflict by
            falling back to booking — see the feature panels. Copying the
            label verbatim would ship a button that scrolls nowhere. */}
        {/* max-sm:w-full on both: the two labels are 200px and 175px wide, so
            below sm they wrap onto their own lines anyway and sat at two
            different widths, which read as a mistake rather than a stack.
            Full width makes the stack deliberate and enlarges the tap target
            on the one screen size where that matters most. */}
        <div className="mt-7 flex flex-wrap items-center gap-3 animate-fade-in-up [animation-delay:180ms]">
          <CtaLink
            href={PRODUCTS_ENABLED ? "#products" : "/book"}
            variant="light"
            className="max-sm:w-full"
          >
            {PRODUCTS_ENABLED ? "Shop Our Collection" : "Book Your Appointment"}
          </CtaLink>

          {/* Price is the question that otherwise sends someone to Instagram
              to ask. This keeps them on the page and lands them on the three
              full sets, which carry their own Book buttons. */}
          <CtaLink
            href="#signature-sets"
            variant="onImage"
            className="max-sm:w-full"
          >
            See Sets &amp; Pricing
          </CtaLink>
        </div>

        {/* Proof line. Every item is a fact already established elsewhere on
            the site or read live from the database — her certification and
            the consultation are the Meet Vianney section's own words, and the
            price is the cheapest active full set. Nothing here is a claim
            that cannot be traced to something she controls. */}
      </div>
    </section>
  );
}

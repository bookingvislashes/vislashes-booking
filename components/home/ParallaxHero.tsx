import Image from "next/image";
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
  return (
    // The subtracted values are the measured header height at each breakpoint
    // (88px below lg, 94px at lg). They are duplicated from the header rather
    // than shared, so a change to its padding silently leaves a strip of the
    // next section showing below the fold. A height token would fix that.
    <section className="relative w-full overflow-hidden bg-white h-[clamp(560px,calc(100svh_-_88px),760px)] lg:h-[clamp(720px,calc(100svh_-_94px),1024px)]">
      {/* The photograph. It settles out of a 6% scale over 14s — slow enough
          to read as presence rather than motion, and it runs once so the page
          is still afterwards. Disabled outright under reduced motion. */}
      {/* The photograph. `object-position` keeps the face right of centre with
          the eye in the upper middle, clear of the text column at both ends of
          the range. priority + unoptimized because this is the LCP element and
          a cold /_next/image transform is the last thing it should wait on. */}
      <Image
        src="/images/hero-portrait.webp"
        alt="Close-up of a client's finished wispy lash set"
        fill
        priority
        unoptimized
        sizes="100vw"
        className="object-cover object-[62%_top] lg:object-[center_top] animate-hero-drift motion-reduce:animate-none"
      />


      {/* Scrim, phone and tablet: bottom-up, because the text is anchored to
          the bottom edge there. Held stronger than the desktop ramp because at
          375 the headline sits over skin rather than the pale backdrop.

          Held a little longer than the original 0.82/0.60@52%/0@85%, because
          the second CTA stacks below the first on a phone and puts the top of
          the headline about 55% of the way up rather than 46%. It is pulled
          back in again now the kicker and the proof list are gone: fading out
          by 88% rather than 96% leaves the brow and the eye untinted, which is
          the part of the photograph doing the selling. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none lg:hidden bg-[linear-gradient(0deg,rgba(45,32,21,0.86)_0%,rgba(63,45,31,0.66)_58%,rgba(63,45,31,0)_88%)]"
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
          measures past 4.5:1 on the subtext, while the fade completes by 60% so the eye
          and cheek are untouched.

          An earlier version instead laid a 36% brown wash over the entire
          photograph. That came from misreading node 739:299, whose brown fill
          sits *behind* the image and is invisible in the design. It is gone. */}
      <div
        aria-hidden
        className="hidden absolute inset-0 pointer-events-none lg:block bg-[linear-gradient(90deg,rgba(45,32,21,0.84)_0%,rgba(63,45,31,0.76)_26%,rgba(63,45,31,0.70)_40%,rgba(63,45,31,0)_60%)]"
      />

      <div className="relative z-10 h-full max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-[120px] flex flex-col justify-end pb-12 lg:justify-center lg:pb-0">
        {/* Where and how, in one line above the headline, so the headline
            itself never has to spend words on logistics. "By appointment
            only" is the same fact the old subtext spent "no walk-ins" on. */}
        <h1 className="font-display font-bold text-cream text-[40px] sm:text-[52px] lg:text-[64px] leading-[1.04] max-w-[500px] animate-fade-in-up">
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

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
 */
export function ParallaxHero() {
  return (
    // The subtracted values are the measured header height at each breakpoint
    // (88px below lg, 94px at lg). They are duplicated from the header rather
    // than shared, so a change to its padding silently leaves a strip of the
    // next section showing below the fold. A height token would fix that.
    <section className="relative w-full overflow-hidden bg-white h-[clamp(560px,calc(100svh_-_88px),760px)] lg:h-[clamp(720px,calc(100svh_-_94px),1024px)]">
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
        className="object-cover object-[65%_35%] lg:object-[60%_40%]"
      />

      {/* Tone. Warms the whole frame toward the brand brown so the photo reads
          as one surface with the scrim rather than a picture behind a panel. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-text-brown/[0.36] pointer-events-none"
      />

      {/* Scrim, phone and tablet: bottom-up, because the text is anchored to
          the bottom edge there.
          Measured, not assumed. At 375x812 the stacked headline, paragraph and
          button occupy the bottom ~55% of the hero, so the top of the headline
          sits well above a 45% via stop; against the forehead behind it the
          cream measured 2.8:1. The via is held out to 58% at /65 and the fade
          runs to 88% so the whole text column keeps a dark ground, and the eye
          still reads through the thin end of the gradient above it. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none lg:hidden bg-gradient-to-t from-dark-brown/85 from-[0%] via-dark-brown/65 via-[58%] to-transparent to-[88%]"
      />

      {/* Scrim, lg and up: left-to-right behind the text column.
          Figma puts the via stop at 24.5%. It is deliberately pushed to 40%
          here: the subtext column is 440px wide and, inside a 1440px frame
          with 120px gutters, its right edge lands near 39% of the viewport.
          At 24.5% the gradient has already faded to near-nothing by then and
          the last words of that paragraph sit on the photo's pale background,
          which is where the 4.5:1 contrast actually breaks. Holding the mid
          stop out to 40% keeps the whole column over a dark ground.
          The via is /65 rather than /60 for the same reason: at /60 the last
          words of the paragraph's second line measured 4.36:1, just under AA. */}
      <div
        aria-hidden
        className="hidden absolute inset-0 pointer-events-none lg:block bg-gradient-to-r from-dark-brown/85 from-[0%] via-dark-brown/65 via-[40%] to-transparent to-[80%]"
      />

      <div className="relative z-10 h-full max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-[120px] flex flex-col justify-end pb-12 lg:justify-center lg:pb-0">
        <h1 className="font-display font-bold text-cream text-[40px] sm:text-[52px] lg:text-[64px] leading-[1.04] max-w-[500px] animate-fade-in-up">
          Your lash appointment, without the salon.
        </h1>

        <p className="mt-6 font-sans text-light-tan text-[16px] lg:text-[17px] leading-[1.45] max-w-[440px] animate-fade-in-up [animation-delay:120ms]">
          Every set is done one-on-one in Vianney&apos;s private home studio near
          Lake Nona and St. Cloud — no walk-ins, no other chairs, no rush.
        </p>

        {/* The design's CTA is "Shop Our Collection", pointing at retail.
            Retail is off (lib/features.ts), #products does not render, and
            the rest of the site already resolves that same conflict by
            falling back to booking — see the feature panels. Copying the
            label verbatim would ship a button that scrolls nowhere. */}
        <CtaLink
          href={PRODUCTS_ENABLED ? "#products" : "/book"}
          variant="dark"
          className="mt-8 self-start animate-fade-in-up [animation-delay:240ms]"
        >
          {PRODUCTS_ENABLED ? "Shop Our Collection" : "Book Appointment"}
        </CtaLink>
      </div>
    </section>
  );
}

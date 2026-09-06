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
        className="object-cover object-[62%_top] lg:object-[center_top]"
      />


      {/* Scrim, phone and tablet: bottom-up, because the text is anchored to
          the bottom edge there. Held stronger than the desktop ramp because at
          375 the headline sits over skin rather than the pale backdrop. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none lg:hidden bg-[linear-gradient(0deg,rgba(45,32,21,0.82)_0%,rgba(63,45,31,0.60)_52%,rgba(63,45,31,0)_85%)]"
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

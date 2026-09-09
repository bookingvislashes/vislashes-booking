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
 * the studio line keeps her own "no other chairs, no rush" rhythm but spends
 * its first half on the differentiator, and a proof line under the buttons
 * carries her credential, the consultation and the real starting price. The
 * second CTA goes to the price list rather than off the page, because
 * "what does it cost" is the objection that otherwise sends people to
 * Instagram to ask.
 */
export function ParallaxHero({
  startingPrice,
}: {
  /**
   * Lowest full-set price, straight from the `services` table via
   * `app/page.tsx`. Optional and rendered only when present: an invented or
   * stale number in the first line a client reads is worse than no number,
   * and she changes prices herself in Services.
   */
  startingPrice?: number | null;
} = {}) {
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

          The hold was extended (0.88 to 70%, gone by 96%) when the kicker,
          the second button and the proof list were added: the column is about
          200px taller than it was, and the old ramp had already faded to
          nothing by the height the kicker now sits at. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none lg:hidden bg-[linear-gradient(0deg,rgba(45,32,21,0.88)_0%,rgba(63,45,31,0.72)_70%,rgba(63,45,31,0)_96%)]"
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
        {/* Set down a step with tighter tracking below sm: uppercased at
            11px/0.18em this runs to roughly 378px, which is wider than the
            342px a 390px phone leaves inside the gutters, and it broke with
            "ONLY" alone on a second line. */}
        <p className="font-sans text-warm-beige text-[10px] sm:text-[12px] font-semibold uppercase tracking-[0.12em] sm:tracking-[0.18em] animate-fade-in-up">
          Lake Nona &amp; St. Cloud · By appointment only
        </p>

        <h1 className="mt-3 font-display font-bold text-cream text-[40px] sm:text-[52px] lg:text-[64px] leading-[1.04] max-w-[500px] animate-fade-in-up [animation-delay:60ms]">
          Wake up with your lashes already done.
        </h1>

        <p className="mt-5 font-sans text-light-tan text-[16px] lg:text-[17px] leading-[1.45] max-w-[440px] animate-fade-in-up [animation-delay:120ms]">
          Every set is mapped to your own eye shape and applied one-on-one in
          Vianney&apos;s private home studio — no other chairs, no rush.
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
        {/* One item per line below sm, a separated row from sm up.
            The three items are ~540px on one line, so a phone always has to
            break them somewhere, and every inline arrangement breaks badly:
            separators between the items leave a dot stranded at the end of a
            line, and moving them onto the following item (::before) starts
            the second line with one instead. Stacking sidesteps the choice —
            and a short vertical list is the easier thing to scan on a phone
            anyway. The separators only exist from sm up, where all three fit
            on a single line and can never wrap. */}
        <ul className="mt-6 flex flex-col items-start gap-y-1 sm:flex-row sm:flex-wrap sm:items-center font-sans text-light-tan text-[13px] sm:text-[14px] max-w-[540px] animate-fade-in-up [animation-delay:240ms] sm:[&>li+li]:before:content-['·'] sm:[&>li+li]:before:mx-[10px] sm:[&>li+li]:before:text-warm-beige/60">
          <li>Certified lash tech, 3+ years</li>
          <li>Consultation with every set</li>
          {startingPrice != null && <li>Full sets from ${startingPrice}</li>}
        </ul>
      </div>
    </section>
  );
}

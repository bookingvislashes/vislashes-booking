import Image from "next/image";
import { hasAsset } from "@/lib/has-asset";

// A photograph, so it stays a JPEG — the same call as hero-photo.jpg. Next's
// image optimiser re-encodes to WebP/AVIF on delivery either way.
const PORTRAIT = "/images/vianney-portrait.jpg";

/**
 * Founder intro — Figma node 516:123 on the Home Page.
 *
 * Copy is taken verbatim from the design. It states the studio location and
 * what is included in a service, so it is business fact rather than filler and
 * is not paraphrased.
 */
export function FounderIntro() {
  const portraitReady = hasAsset(PORTRAIT);

  return (
    // Top and bottom are set separately, and the top is much larger at lg. The
    // hero's photo is absolutely positioned at top-[134px] with h-[677px] —
    // 811px inside a min-h-[720px] container — so overflow-hidden crops it
    // flush against the hero's bottom edge on desktop. The Figma padding of
    // 45px was measured against a mockup where the photo ended higher, and
    // read as almost no gap at all. Bottom padding stays as designed so the
    // spacing to How to Book is unchanged.
    <section className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-[120px] pt-19 sm:pt-24 lg:pt-[120px] pb-12 sm:pb-14 lg:pb-[45px]">
      <div className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-12 lg:gap-[77px]">
        {/* The design uses a tall rounded oval rather than a circle — the
            radius is half the width, not half the height. */}
        <div className="relative w-[200px] h-[252px] sm:w-[251px] sm:h-[316px] shrink-0 rounded-[125px] overflow-hidden bg-light-tan">
          {portraitReady && (
            <Image
              src={PORTRAIT}
              alt="Vianney, founder of VIS Lashes"
              fill
              className="object-cover"
              sizes="(max-width: 640px) 200px, 251px"
              quality={90}
              // Sits just under the hero, so it is on screen within a scroll or
              // two. Lazy loading only started the download once she got there.
              loading="eager"
            />
          )}
        </div>

        <div className="max-w-[380px] flex flex-col gap-4 text-center sm:text-left">
          <p className="font-sans text-[16px] sm:text-[18px] text-charcoal leading-[1.445]">
            Hi, I&apos;m Vianney — certified lash tech and founder of VISLashes.
          </p>
          <p className="font-sans text-[16px] sm:text-[18px] text-charcoal leading-[1.445]">
            I work out of my private home studio in Saint Cloud, FL, and every
            appointment is just the two of us — no distractions, no rushing, no
            salon chaos.
          </p>
          <p className="font-sans text-[16px] sm:text-[18px] text-charcoal leading-[1.445]">
            Every service includes a complimentary lash bath to keep your
            extensions healthy and full between appointments.
          </p>
        </div>
      </div>
    </section>
  );
}

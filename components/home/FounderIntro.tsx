import Image from "next/image";
import { hasAsset } from "@/lib/has-asset";

// WebP at 1000x1258, down from an 841KB JPEG straight off a phone. Served
// unoptimised below, so this file is exactly what the browser receives.
const PORTRAIT = "/images/vianney-portrait.webp";

/**
 * Founder intro — Figma node 516:123 on the Home Page.
 *
 * Trimmed from three paragraphs to one on request — every fact from the
 * original design survives (private home studio, Saint Cloud FL, one-on-one,
 * no rushing, the complimentary lash bath), just without three sentences of
 * connective tissue between them.
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
    <section id="about" className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-[120px] pt-19 sm:pt-24 lg:pt-[120px] pb-12 sm:pb-14 lg:pb-[45px]">
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
              // Sits just under the hero, so it is on screen within a scroll or
              // two. Lazy loading only started the download once she got there.
              loading="eager"
              // See HowToBook: at 112KB the optimiser has nothing left to win,
              // and its cache is cold after every deploy.
              unoptimized
            />
          )}
        </div>

        <div className="max-w-[380px] flex flex-col gap-3 text-center sm:text-left">
          <p className="font-sans text-[16px] sm:text-[18px] text-charcoal leading-[1.445]">
            Hi, I&apos;m Vianney — certified lash tech and founder of VISLashes.
          </p>
          <p className="font-sans text-[16px] sm:text-[18px] text-charcoal leading-[1.445]">
            Every appointment is just the two of us in my private home studio
            in Saint Cloud, FL — no rushing, no salon chaos, and a
            complimentary lash bath included every time.
          </p>
        </div>
      </div>
    </section>
  );
}

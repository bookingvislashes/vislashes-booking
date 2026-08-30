"use client";

import Image from "next/image";
import { useRef, useEffect } from "react";
import { CtaLink } from "@/components/ui/CtaLink";
import { PRODUCTS_ENABLED } from "@/lib/features";

/**
 * Hero — Figma node 484:183 on the Home Page.
 *
 * Two columns: the headline and its CTA on the left, a large landscape photo
 * filling the right. The headline runs wide enough to cross the photo's left
 * edge, and `mix-blend-difference` is what makes that work — white text
 * differenced against the cream page reads as near-black, and against the dark
 * photo it stays light. It is one heading that changes colour where it
 * overlaps, not two pieces of text.
 *
 * That blend is fragile in one specific way: an element only blends with the
 * backdrop inside its own stacking context. If the wrapper around the heading
 * took a z-index it would become that context, the heading would blend against
 * nothing, and white-on-cream would go invisible. So the wrapper is `relative`
 * with no z-index, and the heading and the photo take z-10 and z-0 themselves.
 */
export function ParallaxHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let rafId: number;

    const handleScroll = () => {
      rafId = requestAnimationFrame(() => {
        if (!sectionRef.current) return;
        const rect = sectionRef.current.getBoundingClientRect();
        const windowH = window.innerHeight;
        if (rect.bottom > 0 && rect.top < windowH) {
          const scrollY = -rect.top;
          const imageOffset = scrollY * -0.08;

          if (imageRef.current)
            imageRef.current.style.transform = `translate3d(0,${imageOffset}px,0)`;
        }
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener("scroll", handleScroll);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-[120px] pt-10 sm:pt-14 lg:pt-[101px] pb-14 sm:pb-20 lg:pb-[150px]"
    >
      {/* min-h reserves the photo's height at lg, where the photo is taken out
          of flow. Without it the section would collapse to the text and the
          photo would hang over whatever follows. */}
      <div className="relative lg:min-h-[603px]">
        {/* Headline and CTA. First in the DOM so they stack above the photo on
            a phone, which is the reading order the design implies. */}
        <div className="relative lg:max-w-[594px]">
          <h1 className="relative z-10 font-display font-bold sm:font-normal text-[52px] sm:text-[72px] lg:text-[98px] leading-[0.95] tracking-[-0.5px] sm:tracking-normal text-white mix-blend-difference animate-fade-in-up">
            Unlock Mesmerizing Beauty
          </h1>

          {/* The design's CTA is "Shop Our Collection", pointing at retail.
              Retail is off (lib/features.ts), #products does not render, and
              the rest of the site already resolves that same conflict by
              falling back to booking — see the feature panels. Copying the
              label verbatim would ship a button that scrolls nowhere. */}
          <CtaLink
            href={PRODUCTS_ENABLED ? "#products" : "/book"}
            className="relative z-10 mt-4 sm:mt-5 lg:mt-[16px] animate-fade-in-up [animation-delay:200ms]"
          >
            {PRODUCTS_ENABLED ? "Shop Our Collection" : "Book an Appointment"}
          </CtaLink>
        </div>

        {/* Photo. In flow beneath the text on a phone; pinned to the right at
            lg, where the heading crosses it. overflow-hidden clips the parallax
            shift so the photo's own edges stay put. */}
        <div className="relative z-0 w-full h-[280px] sm:h-[380px] mt-8 lg:mt-0 lg:absolute lg:top-[45px] lg:right-0 lg:w-[65%] lg:h-[603px] overflow-hidden">
          <div ref={imageRef} className="absolute inset-0 will-change-transform">
            <Image
              src="/images/hero-photo.webp"
              alt="Beautiful lash models"
              fill
              className="object-cover"
              priority
              // Finally shown in the orientation it was shot in. The old hero
              // cropped this 1200x901 landscape into a 509x677 portrait box and
              // scaled it up by half; here it is close to its native ratio.
              sizes="(max-width: 1024px) 100vw, 780px"
              // 34KB, and served straight from the CDN like the rest of the
              // page — this is the LCP image, so a cold /_next/image transform
              // is the last thing it should be waiting on.
              unoptimized
            />
          </div>
        </div>
      </div>
    </section>
  );
}

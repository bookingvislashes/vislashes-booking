"use client";

import Image from "next/image";
import { useRef, useEffect } from "react";
import { CtaLink } from "@/components/ui/CtaLink";
import { PRODUCTS_ENABLED } from "@/lib/features";

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
      className="relative max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-[120px] pt-6 sm:pt-10 lg:pt-[53px] pb-12 sm:pb-16 lg:pb-[80px] overflow-hidden"
    >
      <div className="flex flex-col lg:flex-row items-start lg:justify-between lg:min-h-[720px]">
        {/* Left: Headline + CTA — h1 must NOT be in a stacking context for blend to work */}
        <div className="relative max-w-full lg:max-w-[562px] pt-2 sm:pt-4 lg:pt-[3px]">
          {/* Heavier and larger on phones only. At 48px in the regular weight
              a display serif's thin strokes were losing the fight with the
              photo underneath it through mix-blend-difference; the desktop
              sizes keep the lighter setting, which has room to breathe. */}
          <h1
            className="relative z-10 font-display font-bold sm:font-normal text-[60px] sm:text-[72px] lg:text-[98px] leading-[0.92] sm:leading-[0.95] tracking-[-0.5px] sm:tracking-normal text-white mix-blend-difference animate-fade-in-up"
          >
            Unlock Mesmerizing Beauty
          </h1>
          <CtaLink
            href="/book"
            className="relative z-10 mt-4 sm:mt-5 lg:mt-[24px] animate-fade-in-up [animation-delay:200ms]"
          >
            Book an Appointment
          </CtaLink>
        </div>

        {/* Center: Hero Photo — moves slower on scroll (parallax) */}
        <div className="relative lg:absolute lg:left-1/2 lg:-translate-x-1/2 lg:top-[134px] w-full sm:w-[360px] lg:w-[509px] h-[420px] sm:h-[500px] lg:h-[677px] z-0 mt-6 lg:mt-0 mx-auto lg:mx-0">
          <div
            ref={imageRef}
            className="absolute inset-0 will-change-transform"
          >
            <Image
              src="/images/hero-photo.jpg"
              alt="Beautiful lash models"
              fill
              className="object-cover"
              priority
              // Deliberately overstated. `sizes` can only describe WIDTH, but
              // this box is portrait (509x677) and the source is landscape
              // (1200x901), so under object-cover the binding dimension is
              // height. Declaring the true 509px makes the browser pick the
              // 1080w candidate, which is only 811px tall and has to be scaled
              // up 1.67x. Asking for 600px selects the 1200w candidate — the
              // full source, 901px tall — cutting the upscale to 1.50x.
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 420px, 600px"
              quality={90}
            />
          </div>
        </div>

        {/* Right: retail prompt. Hidden with the rest of the shop — it invited
            customers to "take lashes home" and pointed at #products, a section
            that no longer renders, so the button scrolled nowhere. */}
        {PRODUCTS_ENABLED && (
          <div
            className="relative z-10 text-left lg:text-right pt-6 sm:pt-10 lg:pt-[268px] animate-fade-in-up [animation-delay:300ms]"
          >
            <p className="font-sans font-light italic text-[14px] sm:text-[16px] text-dark-brown mb-3">
              Looking for lashes to take home?
            </p>
            <CtaLink href="#products" variant="outline">
              Shop Our Collection
            </CtaLink>
          </div>
        )}
      </div>
    </section>
  );
}

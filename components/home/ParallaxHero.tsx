"use client";

import Image from "next/image";
import { useRef, useEffect } from "react";
import { CtaLink } from "@/components/ui/CtaLink";

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
          <h1
            className="relative z-10 font-display text-[48px] sm:text-[72px] lg:text-[98px] leading-[0.95] text-white mix-blend-difference animate-fade-in-up"
          >
            Unlock Mesmerizing Beauty
          </h1>
          <CtaLink
            href="/book"
            className="relative z-10 mt-4 sm:mt-5 lg:mt-[24px] animate-fade-in-up animation-delay-200"
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
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 360px, 509px"
              quality={90}
            />
          </div>
        </div>

        {/* Right: Book CTA */}
        <div
          className="relative z-10 text-left lg:text-right pt-6 sm:pt-10 lg:pt-[268px] animate-fade-in-up animation-delay-300"
        >
          <p className="font-sans font-light italic text-[14px] sm:text-[16px] text-[#5B2121] mb-3">
            Looking for lashes to take home?
          </p>
          <CtaLink href="#products" variant="outline">
            Shop Our Collection
          </CtaLink>
        </div>
      </div>
    </section>
  );
}

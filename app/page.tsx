import Image from "next/image";
import { CtaLink } from "@/components/ui/CtaLink";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ProductCards } from "@/components/home/ProductCards";
import { ParallaxHero } from "@/components/home/ParallaxHero";
import { FounderIntro } from "@/components/home/FounderIntro";
import { HowToBook } from "@/components/home/HowToBook";
import { PRODUCTS_ENABLED } from "@/lib/features";

const featureSections = [
  {
    label: "Embrace",
    name: "Connection",
    description:
      "Elevate your look with 'Connection' – designed for the bold and confident.",
    buttonText: "Shop Connection",
    gradient: "linear-gradient(270deg, #A4846A 3.5%, rgba(180,149,124,0.39) 124%)",
    imageSrc: "/images/connection-photo.webp",
    imagePosition: "right" as const,
    imageWidth: "50%",
    imageEdgeOffset: "-8%",
    flipImage: true,
  },
  {
    label: "Ignite",
    name: "Passion",
    description:
      "Elevate your look with 'Passion' – designed for the bold and confident.",
    buttonText: "Shop Passion",
    gradient: "linear-gradient(271deg, #9D7859 8%, #E0C7B3 102%)",
    imageSrc: "/images/passion-photo.webp",
    imagePosition: "left" as const,
    imageWidth: "42.5%",
    imageEdgeOffset: "-5%",
    flipImage: true,
  },
  {
    label: "Unlock",
    name: "Chemistry",
    description:
      "Elevate your look with 'Chemistry' – designed for the bold and confident.",
    buttonText: "Shop Chemistry",
    gradient: "linear-gradient(95deg, #B4957C 7%, #3F2D1F 96%)",
    imageSrc: "/images/chemistry-photo.webp",
    imagePosition: "right" as const,
    imageWidth: "46%",
    imageEdgeOffset: "-10%",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-[100dvh] bg-cream">
      <Header />

      {/* Hero Section — parallax + mix-blend-difference */}
      <ParallaxHero />

      {/* Founder intro, then How to Book — in the order they sit on the Figma
          Home Page: hero, founder, how-to-book, then the feature sections.

          Nothing on this page fades in on scroll any more. Every section used
          to be wrapped in an AnimateOnScroll that held it at opacity 0 until an
          IntersectionObserver fired, and its photos were lazy on top of that —
          so the download only began once the reveal did. In practice that was a
          blank gap where the section should be, for seconds at a time. The
          whole page is drawn once now, and stays drawn. */}
      <FounderIntro />

      <HowToBook />

      {/* Product Cards Section — retail is off, see lib/features.ts */}
      {PRODUCTS_ENABLED && (
        <section id="products" className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-[120px] py-12 sm:py-16 lg:py-[100px]">
          <ProductCards />
        </section>
      )}

      {/* Feature Sections. Like the two above, these render with the page
          rather than fading in on scroll — the reveal held them at opacity 0
          until the observer fired, which read as a blank panel on the way
          down. Their photos are eager, so the whole page is drawn once and
          stays drawn. */}
      {featureSections.map((section) => (
          <section
            key={section.name}
            className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-[120px] mb-8 sm:mb-10 lg:mb-[96px]"
          >
            <div
              className="relative rounded-surface overflow-hidden min-h-[360px] sm:min-h-[460px] lg:h-[641px]"
              style={{ background: section.gradient }}
            >
              {/* Photo — on desktop it sits absolutely and bleeds past the
                  edge, clipped by overflow:hidden. Below lg it is a normal
                  full-width block stacked above the text.

                  The per-section width and edge offset are passed as CSS
                  variables and only consumed by `lg:` utilities. They used to
                  be plain inline styles, which beat Tailwind at every
                  breakpoint — so on tablet the photos rendered at 50% width
                  and were shoved sideways by a `right: -8%` meant only for the
                  desktop absolute layout. */}
              <div
                className={`
                  relative lg:absolute lg:top-0 lg:bottom-0
                  w-full h-[240px] sm:h-[300px] lg:h-auto
                  lg:w-[var(--img-w,40%)]
                  ${
                    section.imagePosition === "left"
                      ? "lg:left-[var(--img-offset,0px)]"
                      : "lg:right-[var(--img-offset,0px)]"
                  }
                `}
                style={
                  {
                    "--img-w": section.imageWidth,
                    "--img-offset": section.imageEdgeOffset,
                  } as React.CSSProperties
                }
              >
                <Image
                  src={section.imageSrc}
                  alt={section.name}
                  fill
                  className="object-cover"
                  // Eager rather than priority on purpose: priority also emits
                  // a preload link, and three of those would compete with the
                  // hero photo, which is the LCP element and the one image that
                  // genuinely needs to win. All three together are now 49KB.
                  loading="eager"
                  // See HowToBook for why these bypass /_next/image.
                  unoptimized
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  style={{
                    ...(section.flipImage ? { transform: "scaleX(-1)" } : {}),
                  }}
                />
              </div>

              {/* Text Content — tightly grouped */}
              <div
                className={`
                  relative lg:absolute lg:top-1/2 lg:-translate-y-1/2
                  flex flex-col
                  p-6 sm:p-10 lg:p-0
                  ${section.imagePosition === "left"
                    ? "lg:right-[120px] items-start"
                    : "lg:left-[100px] items-start"
                  }
                `}
              >
                <p className="font-sans font-light text-[14px] sm:text-[17px] lg:text-[20px] text-white tracking-[5px] sm:tracking-[6px] lg:tracking-[7.5px] -mb-1 lg:-mb-2">
                  {section.label}
                </p>
                <h2 className="font-display text-[36px] sm:text-[48px] lg:text-[60px] text-white tracking-[3px] sm:tracking-[5px] lg:tracking-[6.5px] leading-none mb-0">
                  {section.name}
                </h2>
                <p className="font-sans font-light text-[15px] sm:text-[16px] lg:text-[18px] text-white leading-[1.445] max-w-[320px] sm:max-w-[340px] lg:max-w-[360px] mt-2 mb-4 lg:mb-5">
                  {section.description}
                </p>
                {/* These pointed at #connection / #passion / #chemistry —
                    anchors that were never rendered anywhere on the page, so
                    the buttons scrolled nowhere even while retail was on. With
                    products archived, booking is the live action. */}
                <CtaLink
                  href={PRODUCTS_ENABLED ? "#products" : "/book"}
                  variant="onImage"
                >
                  {PRODUCTS_ENABLED ? section.buttonText : "Book Appointment"}
                </CtaLink>
              </div>
            </div>
          </section>
      ))}

      {/* Stay Lashed In Section */}
      <section id="contact" className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-[120px] pt-12 sm:pt-16 lg:pt-[100px] pb-10 sm:pb-14 lg:pb-[80px]">
        {/* Two-column layout */}
        <div className="relative flex flex-col lg:flex-row items-start gap-8 sm:gap-10 lg:gap-[60px]">
          {/* Left Content */}
          <div className="w-full lg:w-[380px] shrink-0 pt-0 lg:pt-[20px]">
            {/* Stay Lashed in heading */}
            <h2 className="font-display text-[56px] sm:text-[72px] lg:text-[98px] leading-[0.97] text-dark-brown mb-8 sm:mb-10 lg:mb-[50px]">
              Stay<br />Lashed in
            </h2>

            {/* Social Media */}
            <div className="flex flex-col gap-[14px] mb-8 sm:mb-10 lg:mb-[40px]">
              <p className="font-sans text-[14px] text-charcoal leading-[24px]">
                Follow us on social media for the latest news!
              </p>
              <div className="flex items-center gap-8 sm:gap-10 lg:gap-[40px]">
                {/* Facebook */}
                <a href="#" aria-label="Facebook" className="text-charcoal hover:text-brand-brown transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
                  </svg>
                </a>
                {/* Instagram */}
                <a href="https://instagram.com/vislashesbooking" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="text-charcoal hover:text-brand-brown transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="5" />
                    <circle cx="12" cy="12" r="5" />
                    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                  </svg>
                </a>
                {/* Twitter / X */}
                <a href="#" aria-label="Twitter" className="text-charcoal hover:text-brand-brown transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z" />
                  </svg>
                </a>
                {/* Behance */}
                <a href="#" aria-label="Behance" className="text-charcoal hover:text-brand-brown transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22 7h-7V5h7v2zm1.726 10c-.442 1.297-2.029 3-5.101 3-3.074 0-5.564-1.729-5.564-5.675 0-3.91 2.325-5.92 5.466-5.92 3.082 0 4.964 1.782 5.375 4.426.078.506.109 1.188.095 2.14H15.97c.13 3.211 3.483 3.312 4.588 2.029h3.168zm-7.686-4h4.965c-.105-1.547-1.136-2.219-2.477-2.219-1.466 0-2.277.768-2.488 2.219zm-9.574 6.988H0V5.021h6.953c5.476.081 5.58 5.444 2.72 6.906 3.461 1.26 3.577 8.061-3.207 8.061zM3 11h3.584c2.508 0 2.906-3-.312-3H3v3zm3.391 3H3v3.016h3.341c3.055 0 2.868-3.016.05-3.016z" />
                  </svg>
                </a>
              </div>
            </div>

            {/* Email Signup */}
            <div className="relative max-w-[327px]">
              <label htmlFor="newsletter-email" className="sr-only">
                Email Address
              </label>
              <input
                id="newsletter-email"
                type="email"
                placeholder="Email Address"
                className="w-full h-control box-border px-4 pr-[72px] border border-charcoal rounded-control font-sans text-[14px] text-charcoal leading-[24px] bg-transparent focus:outline-none focus:border-brand-brown"
              />
              <button
                aria-label="Submit email"
                className="absolute right-0 inset-y-0 w-[63px] bg-brand-brown rounded-r-control flex items-center justify-center hover:bg-text-brown transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="rotate-90">
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Right: Photo */}
          <div className="w-full lg:flex-1 relative h-[300px] sm:h-[420px] lg:h-[582px] rounded-surface overflow-hidden">
            <video
              src="/images/stay-lashed-photo.mp4"
              autoPlay
              loop
              muted
              playsInline
              preload="none"
              className="absolute inset-0 w-full h-full object-cover rounded-surface"
            />
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

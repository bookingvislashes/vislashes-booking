import Image from "next/image";
import { CtaLink } from "@/components/ui/CtaLink";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ProductCards } from "@/components/home/ProductCards";
import { ParallaxHero } from "@/components/home/ParallaxHero";
import { FounderIntro } from "@/components/home/FounderIntro";
import { HowToBook } from "@/components/home/HowToBook";
import { Testimonials } from "@/components/home/Testimonials";
import { Reveal } from "@/components/home/Reveal";
import { PRODUCTS_ENABLED } from "@/lib/features";
import { createPublicClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// Re-read the menu at most once a minute, same as /book — so a price change
// made in Services shows up here without waiting on a redeploy.
export const revalidate = 60;

// These three boxes used to be retail banners ("Connection" / "Passion" /
// "Chemistry") from when the studio also sold lash products — same copy
// three times over, and a "Shop" button that pointed at a shop this site no
// longer has. Now that the site is booking-only, they carry the three
// full-set services instead: real name, real starting price, and a Book
// button that actually goes somewhere. The photos, gradient and layout are
// unchanged — those were never the problem.
const sectionVisuals = [
  {
    gradient: "linear-gradient(270deg, #A4846A 3.5%, rgba(180,149,124,0.39) 124%)",
    imageSrc: "/images/connection-photo.webp",
    imagePosition: "right" as const,
    imageWidth: "50%",
    imageEdgeOffset: "-8%",
    flipImage: true,
  },
  {
    gradient: "linear-gradient(271deg, #9D7859 8%, #E0C7B3 102%)",
    imageSrc: "/images/passion-photo.webp",
    imagePosition: "left" as const,
    imageWidth: "42.5%",
    imageEdgeOffset: "-5%",
    flipImage: true,
  },
  {
    gradient: "linear-gradient(95deg, #B4957C 7%, #3F2D1F 96%)",
    imageSrc: "/images/chemistry-photo.webp",
    imagePosition: "right" as const,
    imageWidth: "46%",
    imageEdgeOffset: "-10%",
  },
];

// Matches the three full sets seeded by supabase/migrations/004_real_service_menu.sql,
// used only while Supabase is unconfigured — same reasoning as the fallback
// in app/book/page.tsx.
const fallbackFeaturedServices = [
  {
    // Matches the fallback ids in app/book/page.tsx, so the "Book" button
    // still preselects the right set when Supabase isn't configured.
    id: "svc-classic",
    name: "Classic Set",
    price: 85,
    description:
      "Wake up to naturally defined lashes every day. Clean, flutter-worthy, and never overdone. Perfect for first-timers or anyone wanting effortless polish without the drama. One extension per natural lash — your eyes, enhanced.",
  },
  {
    id: "svc-wispy",
    name: "Wispy Set",
    price: 100,
    description:
      "Feathery, dimensional, and a little bit editorial. The \"I woke up like this\" lash — fluffy enough to be noticed, soft enough to be effortless. If you want lashes that photograph beautifully, this is your style.",
  },
  {
    id: "svc-hybrid",
    name: "Hybrid Set",
    price: 110,
    description:
      "Our most-requested style. Fuller than Classic, softer than full Volume — the sweet spot. Half classic extensions, half wispy fans, all gorgeous. Looks just as good in real life as it does in photos.",
  },
];

async function getFeaturedServices() {
  if (!isSupabaseConfigured()) return fallbackFeaturedServices;

  try {
    const supabase = await createPublicClient();
    const { data, error } = await supabase
      .from("services")
      .select("id, name, price, description")
      .eq("category", "full_set")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .limit(3);

    if (error) {
      console.error("getFeaturedServices: real fetch failed, serving fallback:", error);
      return fallbackFeaturedServices;
    }
    if (!data?.length) return fallbackFeaturedServices;

    // Postgres `numeric` arrives as a string over PostgREST.
    return data.map((s) => ({ ...s, price: Number(s.price) }));
  } catch (err) {
    console.error("getFeaturedServices: threw, serving fallback:", err);
    return fallbackFeaturedServices;
  }
}

function formatPrice(price: number) {
  return Number.isInteger(price) ? `$${price}` : `$${price.toFixed(2)}`;
}

const HOW_TO_BOOK_PHOTO_KEYS = {
  how_to_book_photo_1: "1",
  how_to_book_photo_2: "2",
  how_to_book_photo_3: "3",
} as const;

async function getHowToBookPhotos() {
  const empty: Partial<Record<"1" | "2" | "3", string>> = {};
  if (!isSupabaseConfigured()) return empty;

  try {
    const supabase = await createPublicClient();
    const { data, error } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", Object.keys(HOW_TO_BOOK_PHOTO_KEYS));

    if (error) {
      console.error("getHowToBookPhotos: fetch failed, using defaults:", error);
      return empty;
    }

    const result = { ...empty };
    for (const row of data || []) {
      const step = HOW_TO_BOOK_PHOTO_KEYS[row.key as keyof typeof HOW_TO_BOOK_PHOTO_KEYS];
      if (step && row.value) result[step] = row.value;
    }
    return result;
  } catch (err) {
    console.error("getHowToBookPhotos: threw, using defaults:", err);
    return empty;
  }
}

// The DB description is a full paragraph, written for the booking page's
// service cards — too long for a banner. The first sentence is real copy she
// already wrote for this exact service, just excerpted rather than replaced.
function leadSentence(description: string) {
  const match = description.match(/^[^.]+\./);
  return match ? match[0] : description;
}

export default async function HomePage() {
  const [featuredServices, howToBookPhotos] = await Promise.all([
    getFeaturedServices(),
    getHowToBookPhotos(),
  ]);
  const featureSections = featuredServices.map((service, i) => ({
    ...sectionVisuals[i],
    id: service.id,
    name: service.name,
    label: formatPrice(service.price),
    description: leadSentence(service.description),
    buttonText: `Book ${service.name}`,
  }));

  return (
    <div className="min-h-[100dvh] bg-cream">
      <Header />

      {/* Hero Section — parallax + mix-blend-difference */}
      <ParallaxHero />

      {/* Founder intro, then How to Book — in the order they sit on the Figma
          Home Page: hero, founder, how-to-book, then the feature sections.

          Each section fades up as it is approached. See Reveal for why this is
          safe now and was not before: every photo below is eager, small and
          served straight from the CDN, so it has arrived long before its
          section is reached. The animation moves content that is already there
          rather than standing in front of a download. */}
      <Reveal>
        <FounderIntro />
      </Reveal>

      <Reveal>
        <HowToBook photoOverrides={howToBookPhotos} />
      </Reveal>

      {/* Product Cards Section — retail is off, see lib/features.ts */}
      {PRODUCTS_ENABLED && (
        <section id="products" className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-[120px] py-12 sm:py-16 lg:py-[100px]">
          <ProductCards />
        </section>
      )}

      {/* Signature Sets. A short intro so the three don't just start cold —
          then a short stagger so they read as a sequence rather than one
          block, 80ms, small enough that the last one is not noticeably
          behind the first. */}
      {featureSections.length > 0 && (
        <Reveal>
          <div className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-[120px] text-center mb-8 sm:mb-10 lg:mb-[56px]">
            <h2 className="font-display text-[36px] sm:text-[48px] lg:text-[56px] leading-[1.1] text-dark-brown text-balance">
              Find Your Signature Set
            </h2>
            <p className="font-sans font-light text-[16px] sm:text-[18px] text-charcoal leading-[1.45] max-w-[560px] mx-auto mt-3">
              Every set is tailored to your eye shape and desired fullness at
              your appointment — here&apos;s where most clients start.
            </p>
          </div>
        </Reveal>
      )}
      {featureSections.map((section, index) => (
        <Reveal key={section.name} delay={index * 80}>
          <section
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
                <CtaLink href={`/book?service=${section.id}`} variant="onImage">
                  {section.buttonText}
                </CtaLink>
              </div>
            </div>
          </section>
        </Reveal>
      ))}

      <Reveal>
        <Testimonials />
      </Reveal>

      {/* Stay Lashed In Section */}
      <Reveal>
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
                {/* Instagram */}
                <a href="https://www.instagram.com/vislashesbooking" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="text-charcoal hover:text-brand-brown transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="5" />
                    <circle cx="12" cy="12" r="5" />
                    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                  </svg>
                </a>
                {/* Facebook */}
                <a href="https://www.facebook.com/profile.php?id=100090403301732" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="text-charcoal hover:text-brand-brown transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
                  </svg>
                </a>
                {/* TikTok */}
                <a href="https://www.tiktok.com/@vislashes" target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="text-charcoal hover:text-brand-brown transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16.5 2h-3.2v13.6c0 1.5-1.2 2.75-2.75 2.75a2.75 2.75 0 01-2.75-2.75 2.75 2.75 0 012.75-2.75c.3 0 .6.05.87.14V9.7a6 6 0 00-.87-.06 5.95 5.95 0 00-5.95 5.95A5.95 5.95 0 0010.55 21.5a5.95 5.95 0 005.95-5.95V8.6a8.2 8.2 0 004.6 1.4V6.75c-1.9 0-3.55-1.15-4.25-2.8A5.3 5.3 0 0116.5 2z" />
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
      </Reveal>

      <Footer />
    </div>
  );
}

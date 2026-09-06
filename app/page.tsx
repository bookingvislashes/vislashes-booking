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

// Signature Set rows — three real full-set services with a circular photo on
// alternating sides (Figma: row 1 image left, row 2 right, row 3 left). Name,
// price and description all come from `featuredServices` below; only the
// photo and its side are fixed here.
//
// Row 2 uses the real Wispy Set service photo rather than the historical
// passion-photo.webp — that photo is the same photograph now used full-bleed
// in the hero, so keeping it here would put the same face on the page twice.
// Unlike the other two (alpha cut-outs that let card-beige show through),
// this one is a full rectangular photo and fills its circle edge to edge —
// expected and approved.
const sectionVisuals: { imageSrc: string; imagePosition: "left" | "right" }[] = [
  { imageSrc: "/images/connection-photo.webp", imagePosition: "left" },
  { imageSrc: "/images/wispy-set-photo.webp", imagePosition: "right" },
  { imageSrc: "/images/chemistry-photo.webp", imagePosition: "left" },
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
          <div className="max-w-[720px] mx-auto px-6 sm:px-12 lg:px-0 flex flex-col items-center gap-4 text-center pt-8 sm:pt-12 lg:pt-[100px] mb-10 sm:mb-12 lg:mb-[80px]">
            <h2 className="font-display font-bold text-[36px] sm:text-[44px] lg:text-[48px] leading-[1.15] text-charcoal text-balance">
              Find Your Signature Set
            </h2>
            <p className="font-sans text-muted text-[16px] leading-[1.6]">
              Three full sets, each one applied by me, one client at a time. Not
              sure which is yours? Book the closest fit — we&rsquo;ll settle the
              final look together at your appointment.
            </p>
          </div>
        </Reveal>
      )}
      {featureSections.length > 0 && (
        <div className="w-full max-w-[960px] mx-auto px-6 lg:px-0 mb-8 sm:mb-10 lg:mb-[96px]">
          {featureSections.map((section, index) => (
            <Reveal key={section.name} delay={index * 80}>
              <div
                className={`flex flex-col items-center gap-6 mb-14 last:mb-0 md:mb-0 md:items-center md:justify-between md:py-8 lg:py-[48px] ${
                  section.imagePosition === "right" ? "md:flex-row-reverse" : "md:flex-row"
                }`}
              >
                <div className="relative shrink-0 rounded-full overflow-hidden bg-card-beige size-[240px] lg:size-[320px]">
                  <Image
                    src={section.imageSrc}
                    /* Decorative: the set name is announced by the <h3> directly
                       beside this image, so alt text would just repeat it. */
                    alt=""
                    fill
                    className="object-cover object-top"
                    loading="eager"
                    unoptimized
                    sizes="(max-width: 640px) 240px, 320px"
                  />
                </div>

                <div className="w-full max-w-[420px] md:max-w-none md:flex-1 lg:w-[480px] lg:flex-none flex flex-col gap-4 text-left">
                  <span aria-hidden className="font-display font-bold italic text-text-brown text-[24px]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="flex items-baseline justify-between gap-4">
                    <h3 className="font-display font-bold text-charcoal text-[36px]">
                      {section.name}
                    </h3>
                    <span className="font-display font-bold text-muted text-[24px]">
                      {section.label}
                    </span>
                  </div>
                  <p className="font-sans text-muted text-[15px] leading-[1.6]">
                    {section.description}
                  </p>
                  <div className="pt-[8px]">
                    <CtaLink
                      href={`/book?service=${section.id}`}
                      variant="outlineDark"
                      size="sm"
                      font="display"
                    >
                      Book {section.name}
                    </CtaLink>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      )}

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

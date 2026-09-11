import Image from "next/image";
import { CtaLink } from "@/components/ui/CtaLink";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ProductCards } from "@/components/home/ProductCards";
import { ParallaxHero } from "@/components/home/ParallaxHero";
import { FounderIntro } from "@/components/home/FounderIntro";
import { HowToBook } from "@/components/home/HowToBook";
import { Testimonials } from "@/components/home/Testimonials";
import { Faq } from "@/components/home/Faq";
import { ContactSection } from "@/components/home/ContactSection";
import { Reveal } from "@/components/home/Reveal";
import { PRODUCTS_ENABLED } from "@/lib/features";
import { createPublicClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getContactDetails } from "@/lib/contact";
import { buildFaq, summariseTimings, EMPTY_FACTS, type ServiceTiming } from "@/lib/faq";

// Re-read the menu at most once a minute, same as /book — so a price change
// made in Services shows up here without waiting on a redeploy.
export const revalidate = 60;

// Signature Set rows — three real full-set services with a circular photo on
// alternating sides (Figma: row 1 image left, row 2 right, row 3 left). Name,
// price and description all come from `featuredServices` below; only the
// photo and its side are fixed here.
//
// Row 2 is the same photograph now used full-bleed in the hero. That repetition
// is deliberate: it is what the Figma design does, and it was tried the other
// way. Substituting the service photo from Admin removed the repeat but the
// only copy of it is 711x550, which upscaled into a 320px circle at 2x read as
// visibly soft beside two sharp studio cut-outs. The repeat is the better of
// the two flaws.
const sectionVisuals: { imageSrc: string; imagePosition: "left" | "right" }[] = [
  { imageSrc: "/images/connection-photo.webp", imagePosition: "left" },
  { imageSrc: "/images/passion-photo.webp", imagePosition: "right" },
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

/**
 * Duration and deposit for every active service, for the FAQ's answers.
 *
 * Separate from getFeaturedServices because that one is limited to the three
 * full sets shown as Signature Sets; the FAQ answers for refills and the lash
 * lift too, so it needs the whole active menu. No fallback: with Supabase
 * unconfigured there are no real figures to quote, and buildFaq drops the
 * questions it cannot answer rather than inventing a number.
 */
async function getServiceTimings(): Promise<ServiceTiming[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createPublicClient();
    const { data, error } = await supabase
      .from("services")
      .select("category, duration_minutes, deposit_amount")
      .eq("is_active", true);

    if (error) {
      console.error("getServiceTimings: fetch failed, FAQ omits figures:", error);
      return [];
    }

    // Postgres `numeric` arrives as a string over PostgREST.
    return (data || []).map((s) => ({
      category: s.category,
      duration_minutes: Number(s.duration_minutes),
      deposit_amount: Number(s.deposit_amount),
    }));
  } catch (err) {
    console.error("getServiceTimings: threw, FAQ omits figures:", err);
    return [];
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
  const [featuredServices, howToBookPhotos, serviceTimings, contact] =
    await Promise.all([
      getFeaturedServices(),
      getHowToBookPhotos(),
      getServiceTimings(),
      getContactDetails(),
    ]);
  const faqItems = buildFaq(
    serviceTimings.length > 0 ? summariseTimings(serviceTimings) : EMPTY_FACTS
  );
  const featureSections = featuredServices.map((service, i) => ({
    ...sectionVisuals[i],
    id: service.id,
    name: service.name,
    label: formatPrice(service.price),
    description: leadSentence(service.description),
  }));

  return (
    <div className="min-h-[100dvh] bg-cream">
      <Header tone="dark" />

      {/* Hero Section */}
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
          {/* The hero's second CTA lands here. scroll-mt clears the section's
              own top padding so the heading isn't left flush against the top
              of the viewport. The id is on the intro rather than on <Reveal>,
              which takes no props. */}
          <div
            id="signature-sets"
            className="scroll-mt-8 max-w-[720px] mx-auto px-6 sm:px-12 lg:px-0 flex flex-col items-center gap-4 text-center pt-8 sm:pt-12 lg:pt-[100px] mb-10 sm:mb-12 lg:mb-[80px]"
          >
            <h2 className="font-display font-bold text-[36px] sm:text-[44px] lg:text-[48px] leading-[1.15] text-charcoal text-balance">
              Find Your Signature Set
            </h2>
            <p className="font-sans text-muted text-[16px] leading-[1.6]">
              A slow-paced, intimate studio experience. Every set is tailored to
              the quiet poetry of your unique bone structure. No rushes, no
              distractions—just pure, restorative detail.
            </p>
          </div>
        </Reveal>
      )}
      {/* Row spacing lives on this container, not on the rows. Each row sits
          inside its own <Reveal>, so every row is its parent's only child and
          the `last:mb-0` this used to carry matched all three of them — which
          left the phone layout with the sets touching. From md up the rows
          have their own vertical padding, so the gap hands off to that. */}
      {featureSections.length > 0 && (
        <div className="w-full max-w-[960px] mx-auto px-6 lg:px-0 mb-8 sm:mb-10 lg:mb-[90px] flex flex-col gap-14 md:gap-0">
          {featureSections.map((section, index) => (
            <Reveal key={section.name} delay={index * 80}>
              <div
                className={`group flex flex-col items-center gap-6 md:items-center md:justify-between md:py-8 lg:py-[48px] ${
                  section.imagePosition === "right" ? "md:flex-row-reverse" : "md:flex-row"
                }`}
              >
                <div className="relative shrink-0 rounded-full overflow-hidden bg-portrait-backdrop size-[240px] lg:size-[320px]">
                  <Image
                    src={section.imageSrc}
                    /* Decorative: the set name is announced by the <h3> directly
                       beside this image, so alt text would just repeat it. */
                    alt=""
                    fill
                    className="object-cover object-center transition-[scale] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.06] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                    loading="eager"
                    unoptimized
                    sizes="(max-width: 640px) 240px, 320px"
                  />
                </div>

                <div className="w-full max-w-[420px] md:max-w-none md:flex-1 lg:w-[480px] lg:flex-none flex flex-col gap-[6px] text-left">
                  <span aria-hidden className="font-display font-bold italic text-text-brown text-[24px]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {/* Name and price sit together rather than at opposite ends
                      of the 480px column, which is what the Figma frame does —
                      at that width the price read as belonging to nothing.
                      Wraps rather than overflows: the name comes from Services
                      and can be any length. */}
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
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
                      variant="tan"
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

      {/* Answers the questions that otherwise arrive as a DM and hold up a
          booking — and sits directly above Contact, so anything it does not
          cover is one scroll from the way to ask. */}
      <Reveal>
        <Faq items={faqItems} />
      </Reveal>

      <Reveal>
        <ContactSection contact={contact} />
      </Reveal>

      <Footer />
    </div>
  );
}

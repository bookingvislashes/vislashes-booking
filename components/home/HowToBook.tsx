import Image from "next/image";
import { hasAsset } from "@/lib/has-asset";

/**
 * How to Book — Figma node 513:121 on the Home Page.
 *
 * The deposit figure in step 2 is stated in the design as $25, which matches
 * the services table. It is intentionally NOT read from the database here:
 * this is marketing copy on a static page, and a per-service deposit has no
 * single value to quote. If the deposit changes, this line changes with it.
 */
const STEPS = [
  {
    number: "1",
    title: "Choose Your Look",
    body: "Pick from classic, hybrid, or volume lash sets tailored to your eye shape and desired fullness.",
    image: "/images/howtobook-choose.webp",
    alt: "Close-up of finished lash extensions",
  },
  {
    number: "2",
    title: "Book & Deposit",
    body: "Secure your private studio session with a $25 deposit - just you and your lash artist, no salon chaos.",
    image: "/images/howtobook-deposit.webp",
    alt: "The private lash studio",
  },
  {
    number: "3",
    title: "Confirm & Arrive",
    body: "Check your email for appointment details, studio address, and pre-care tips for lasting results.",
    image: "/images/howtobook-arrive.webp",
    alt: "Client being prepared for a lash appointment",
  },
] as const;

export function HowToBook() {
  return (
    <section id="how-to-book" className="bg-cream">
      <div className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-[120px] py-16 sm:py-20 lg:py-[120px]">
        <div className="flex flex-col items-center gap-4 text-center mb-10 sm:mb-14">
          <h2 className="font-display text-[36px] sm:text-[48px] lg:text-[64px] leading-[1.1] text-dark-brown text-balance">
            How to Book Your Lash Appointment
          </h2>
          <p className="font-sans font-light text-[16px] sm:text-[18px] text-charcoal leading-[1.45] max-w-[760px]">
            A seamless, private experience from selection to studio arrival —
            designed for calm, confident beauty.
          </p>
        </div>

        {/* Three cards, so a 2-column tablet grid would orphan one on its own
            row — the same reason the product grid goes straight to 3 at md. */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-[24px]">
          {STEPS.map((step) => {
            const imageReady = hasAsset(step.image);

            return (
              <div
                key={step.number}
                className="flex flex-col gap-4 bg-white rounded-surface p-6 shadow-[0_10px_14px_rgba(0,0,0,0.07)]"
              >
                <div className="flex flex-col gap-3">
                  <span
                    aria-hidden="true"
                    className="font-sans font-bold text-[31px] leading-none text-brand-tan"
                  >
                    {step.number}
                  </span>
                  <h3 className="font-display text-[24px] sm:text-[28px] leading-[1.2] text-dark-brown">
                    {step.title}
                  </h3>
                  <p className="font-sans font-light text-[16px] text-charcoal leading-[1.45]">
                    {step.body}
                  </p>
                </div>

                {/* mt-auto pins the photo to the bottom edge, so cards with
                    shorter copy still line their images up across the row. */}
                <div className="relative w-full h-[220px] mt-auto rounded-surface overflow-hidden bg-light-tan">
                  {imageReady && (
                    <Image
                      src={step.image}
                      alt={step.alt}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 336px"
                      loading="eager"
                      // These were 1.2MB PNGs — photographs in a lossless
                      // format — and are now 42-52KB WebP at the same 1248x832.
                      //
                      // At that size the optimiser has nothing left to win, and
                      // it costs something real: /_next/image renders each
                      // width on demand and its cache is cold after every
                      // deploy, so whoever loads the page first waits for the
                      // transform. Unoptimised, the file is served straight
                      // from the CDN as an immutable static asset — the same
                      // bytes every time, fast on the first request as well as
                      // the hundredth.
                      unoptimized
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

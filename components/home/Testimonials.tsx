/**
 * Real client messages and reviews (Instagram DMs, texts, a Facebook
 * review) as she received them — light spelling/grammar cleanup only, no
 * added sentiment. First names only for the ones that came from a private
 * DM or text; the Facebook review carries a full name because it's already
 * public under one.
 */
const TESTIMONIALS = [
  {
    quote: "Thank you so much, I love them!",
    name: "Dayanara",
  },
  {
    quote:
      "She walked me through the process and the environment is really relaxing.",
    name: "Gaby",
  },
  {
    quote:
      "I feel so confident thanks to her. I'm keeping her card in my server book so I can send others her way.",
    name: "Mattie",
  },
  {
    quote: "Great experience! Beautiful work!",
    name: "Charlene Castro",
    source: "Facebook review",
  },
] as const;

/**
 * An editorial list rather than a card grid.
 *
 * These quotes are real messages and several are very short — "Thank you so
 * much, I love them!" is the whole thing. In equal-height cards a line that
 * short leaves most of the box empty and reads like something failed to load.
 * Set large in the display face, on its own row, the same words read as
 * deliberate. Rows also let each quote take the height it needs instead of
 * being padded out to match its neighbours.
 *
 * No avatars, and none should be added: these came from private DMs and texts,
 * which is also why most carry a first name only.
 */
export function Testimonials() {
  return (
    <section className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-[120px] pb-12 sm:pb-16 lg:pb-[100px]">
      {/* Matches the scale of "Find Your Signature Set" and "How to Book"
          above it — this heading used to be several steps smaller than both,
          which made the section read as a footnote to them. */}
      <div className="text-center mb-8 sm:mb-10 lg:mb-[56px]">
        <h2 className="font-display text-[36px] sm:text-[48px] lg:text-[56px] leading-[1.1] text-dark-brown text-balance">
          What Clients Say
        </h2>
      </div>

      {/* Narrower than the page gutter on purpose: a quote set this large runs
          to an uncomfortable line length across the full 1200px content width. */}
      <div className="max-w-[1000px] mx-auto">
        {TESTIMONIALS.map((t) => (
          <figure
            key={t.name}
            className="grid gap-2 sm:grid-cols-[minmax(120px,180px)_1fr] sm:gap-10 lg:gap-[64px] items-baseline border-t border-light-tan py-7 sm:py-9 lg:py-10 last:border-b"
          >
            {/* Attribution sits in the left column on a wide screen, but below
                the quote on a phone, where a name arriving before the words it
                belongs to reads backwards. */}
            <figcaption className="order-2 sm:order-none">
              <span className="block font-sans text-[15px] font-semibold text-dark-brown">
                {t.name}
              </span>
              {"source" in t && (
                <span className="block font-sans text-[13px] text-muted mt-0.5">
                  {t.source}
                </span>
              )}
            </figcaption>

            <blockquote className="order-1 sm:order-none font-display text-[22px] sm:text-[26px] lg:text-[30px] leading-[1.4] text-dark-brown text-pretty">
              &ldquo;{t.quote}&rdquo;
            </blockquote>
          </figure>
        ))}
      </div>
    </section>
  );
}

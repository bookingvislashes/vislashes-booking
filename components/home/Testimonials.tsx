/**
 * Real client messages and feedback (Instagram DMs, texts, Square post-sale
 * feedback) as she received them — light spelling and punctuation cleanup
 * only, no added sentiment and no added words.
 *
 * First names only, at her request. Where a quote came from is recorded per
 * entry below and deliberately NOT shown on the page — naming the platform
 * adds nothing for a reader and drags another company's brand into the middle
 * of hers.
 *
 * Her own test of a quote, applied when two of these were replaced: does it
 * show that she is good at this? "Thank you so much, I love them!" and "Great
 * experience! Beautiful work!" are warm, but any lash tech in Orlando could
 * have collected them, so they were doing nothing that the four of them
 * together could not do with three. The two that replaced them each carry
 * something specific instead — a room worth sitting in, and a set that
 * outlasted the fill it was booked for.
 *
 * Caps and spellings like "WHOLE VIBE" and "ONNNN" are how the messages
 * arrived and are the point of quoting them; do not tidy them into standard
 * English, or these stop sounding like clients and start sounding like copy.
 */
const TESTIMONIALS = [
  {
    // Square positive feedback left after a sale, tagged Environment and
    // Customer Service. "in a WHOLE VIBE" -> "is a WHOLE VIBE"; trailing
    // emoji dropped, as on every quote here.
    quote: "She is an awesome young lady. Her studio is a WHOLE VIBE.",
    name: "Kim",
  },
  {
    // Instagram DM.
    quote:
      "She walked me through the process and the environment is really relaxing.",
    name: "Gaby",
  },
  {
    // Text message.
    quote:
      "I feel so confident thanks to her. I'm keeping her card in my server book so I can send others her way.",
    name: "Mattie",
  },
  {
    // Text message, sent with a selfie. Comma after "Girl" and the closing
    // period are the only changes; the retention it describes is the whole
    // reason it is here, so it closes the list.
    quote:
      "Girl, I hate to keep rescheduling the lash fill but these lashes have stayed ONNNN.",
    name: "Valery",
  },
] as const;

/**
 * An editorial list rather than a card grid.
 *
 * These quotes are real messages, so they run to whatever length they ran to
 * — the shortest here is nine words and earlier versions of this list held
 * quotes half that. In equal-height cards a line that short leaves most of
 * the box empty and reads like something failed to load. Set large in the
 * display face, on its own row, the same words read as deliberate. Rows also
 * let each quote take the height it needs instead of being padded out to
 * match its neighbours, which is what keeps this safe as she swaps quotes in
 * and out.
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
            <figcaption className="order-2 sm:order-none font-sans text-[15px] font-semibold text-dark-brown">
              {t.name}
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

/**
 * Real client messages and reviews (Instagram DMs, texts, a Facebook
 * review) as she received them — light spelling/grammar cleanup only, no
 * added sentiment. First names only, at her request — including for the
 * Facebook review, which is public under a full name but is shown here
 * the same way as the others.
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
    name: "Charlene",
    source: "Facebook review",
  },
] as const;

export function Testimonials() {
  return (
    <section className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-[120px] pb-12 sm:pb-16 lg:pb-[100px]">
      <h2 className="font-display text-[32px] sm:text-[40px] text-dark-brown text-center mb-8 sm:mb-10">
        What Clients Say
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {TESTIMONIALS.map((t) => (
          <div
            key={t.name}
            className="flex flex-col gap-3 bg-white rounded-surface p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
          >
            <p aria-hidden="true" className="font-display text-[32px] leading-none text-brand-tan">
              &ldquo;
            </p>
            <p className="font-sans text-[15px] text-charcoal leading-[1.5] flex-1">
              {t.quote}
            </p>
            <div>
              <p className="font-sans text-[14px] font-semibold text-dark-brown">
                {t.name}
              </p>
              {"source" in t && (
                <p className="font-sans text-[12px] text-muted">{t.source}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

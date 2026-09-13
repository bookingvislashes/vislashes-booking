import type { FaqItem } from "@/lib/faq";

/**
 * The questions clients ask before booking, answered on the page.
 *
 * Built on <details>/<summary> rather than React state, for three reasons that
 * all matter here: it needs no client bundle at all on a page that is otherwise
 * fully server-rendered, the browser gives us the open/close behaviour and the
 * keyboard and screen-reader semantics for free, and — unlike a JS accordion —
 * every answer is in the HTML whether or not it is open, so Google indexes the
 * text and a visitor using Find-in-page can still hit it.
 *
 * The FAQPage JSON-LD below is the reason this is worth doing for reach and not
 * only for the client reading it: it is what lets these questions and answers
 * appear directly under the listing in Google, where someone searching "how
 * long do lash extensions take" can be answered before they have chosen whose
 * site to open.
 *
 * Content and its sourcing live in lib/faq.ts.
 */
export function Faq({ items }: { items: FaqItem[] }) {
  if (items.length === 0) return null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  return (
    <section id="faq" className="bg-cream scroll-mt-8">
      <div className="max-w-[860px] mx-auto px-6 sm:px-12 lg:px-0 py-12 sm:py-16 lg:py-[100px]">
        <div className="flex flex-col items-center gap-4 text-center mb-10 sm:mb-12 lg:mb-[60px]">
          <h2 className="font-display font-bold text-[36px] sm:text-[44px] lg:text-[48px] leading-[1.15] text-charcoal text-balance">
            Before You Book
          </h2>
          <p className="font-sans text-muted text-[16px] leading-[1.6] max-w-[560px]">
            The things clients ask most. If yours is not here, text me — the
            number is just below.
          </p>
        </div>

        <div className="border-t border-light-tan">
          {items.map((item) => (
            <details
              key={item.question}
              className="group border-b border-light-tan"
            >
              {/* list-none plus the webkit selector removes the default
                  disclosure triangle in both engines; without the second one
                  Safari keeps drawing its own marker beside ours. */}
              <summary className="flex items-center justify-between gap-4 cursor-pointer list-none py-5 [&::-webkit-details-marker]:hidden">
                <h3 className="font-display text-[19px] sm:text-[21px] leading-[1.3] text-dark-brown text-pretty">
                  {item.question}
                </h3>
                <span
                  aria-hidden="true"
                  className="shrink-0 text-brand-brown transition-transform duration-200 group-open:rotate-45 motion-reduce:transition-none"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </span>
              </summary>
              <p className="font-sans text-[15px] leading-[1.7] text-muted pb-5 pr-8 max-w-[680px]">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>

      <script
        type="application/ld+json"
        // The answers are our own copy, not user input, but escaping the angle
        // bracket is the standard guard against a future edit closing this
        // script tag from inside the JSON.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
    </section>
  );
}

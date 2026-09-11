/**
 * The shared frame for /privacy, /terms and /sms.
 *
 * All three are plain documents: the job is that they are readable on a phone
 * and openable by anyone — including a carrier reviewing the messaging
 * campaign — without starting a booking. Deliberately quiet, and deliberately using the
 * same tokens as the rest of the site so they still feel like VIS Lashes.
 */
import Link from "next/link";

interface LegalPageProps {
  title: string;
  updated: string;
  /** Plain text. Lines in CAPS become headings; everything else is a
   *  paragraph. **Double asterisks** render bold — the carriers require the
   *  STOP and HELP instructions in the messaging terms to be shown in bold. */
  sections: string[];
}

export function LegalPage({ title, updated, sections }: LegalPageProps) {
  return (
    <div className="min-h-[100dvh] bg-cream px-6 py-12 sm:py-16">
      <div className="max-w-[680px] mx-auto">
        <Link
          href="/"
          className="inline-flex items-baseline gap-0.5 mb-10 no-underline"
        >
          <span className="font-display text-[14px] font-bold text-dark-brown tracking-[4px] uppercase">
            VIS
          </span>
          <span className="font-display text-[14px] font-bold text-dark-brown tracking-[4px] uppercase italic">
            LASHES
          </span>
        </Link>

        <h1 className="font-display text-[32px] sm:text-[40px] leading-[1.15] font-bold text-dark-brown">
          {title}
        </h1>
        <p className="font-sans text-[13px] text-muted mt-2 mb-8">
          Last updated {updated}
        </p>

        <div className="bg-white rounded-surface p-6 sm:p-8 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          {sections.map((block) =>
            block.split("\n").map((line, i) => {
              const trimmed = line.trim();
              if (!trimmed) return null;
              // A line in caps is a heading. Cheap, and it keeps the source
              // text readable as plain text in the booking flow too.
              const isHeading =
                trimmed === trimmed.toUpperCase() &&
                /[A-Z]/.test(trimmed) &&
                trimmed.length < 60;
              // **bold** segments. Split on the delimiter and emphasise the
              // odd-indexed pieces, which are the ones that were wrapped.
              const render = (text: string) =>
                text.split("**").map((part, j) =>
                  j % 2 === 1 ? <strong key={j}>{part}</strong> : part
                );
              return isHeading ? (
                <h2
                  key={`${block.slice(0, 12)}-${i}`}
                  className="font-display text-[17px] font-bold text-dark-brown mt-7 first:mt-0 mb-2"
                >
                  {trimmed}
                </h2>
              ) : (
                <p
                  key={`${block.slice(0, 12)}-${i}`}
                  className="font-sans text-[15px] leading-[1.7] text-charcoal mb-3"
                >
                  {render(trimmed)}
                </p>
              );
            })
          )}
        </div>

        <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/terms" className="font-sans text-[14px] text-deep-brown underline">
            Terms &amp; Conditions
          </Link>
          <Link href="/privacy" className="font-sans text-[14px] text-deep-brown underline">
            Privacy Policy
          </Link>
          <Link href="/sms" className="font-sans text-[14px] text-deep-brown underline">
            Text Message Policy
          </Link>
          <Link href="/book" className="font-sans text-[14px] text-deep-brown underline">
            Book an appointment
          </Link>
        </div>
      </div>
    </div>
  );
}

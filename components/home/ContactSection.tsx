import type { ContactDetails } from "@/lib/contact";

/**
 * "Stay Lashed in" — the section the header's Contact link scrolls to.
 *
 * It is the heading, one question, the two ways to ask it, and the studio's
 * three social links. Everything else that used to live here is gone at the
 * owner's direction — the "quickest way to reach me" line, the reply-time note
 * under the buttons, the "Or send a DM" caption, and the Book Your Appointment
 * button. Each was defensible on its own and the pile of them was not: by the
 * last screen of the page there were seven things to read and four things to
 * press, and it read as clutter rather than as an invitation. Please do not
 * add to it without her asking.
 *
 * The icons kept their links and lost their caption — she asked for them back
 * by name after the first pass took the whole block. They are the studio's
 * accounts, which is reason enough; each carries its own aria-label, so
 * nothing about dropping the caption costs a screen reader the names.
 *
 * Nothing is lost by the removals. The booking CTA is in the header on every
 * screen and at the top of the page.
 *
 * TEXT IS THE PRIMARY ACTION, deliberately. Vianney is a solo artist with both
 * hands on a client for most of the working day; anything that implies an
 * answer *right now* (a live chat bubble, a phone call) is a promise the
 * studio cannot keep from inside an appointment, and an ignored chat reads as
 * being ignored by the business. A text sets no such expectation, opens in the
 * client's own Messages app, and lands somewhere she can answer between sets
 * from her phone without another app or a monthly bill.
 *
 * Both methods render only if their value is present in Settings — see
 * lib/contact.ts. A contact link is worth nothing if it goes to the wrong
 * number, so a missing value renders nothing rather than a placeholder.
 */

/** A little breathing room in the client's compose box, so she isn't starting from a blank screen. */
const SMS_PREFILL = encodeURIComponent("Hi! I have a question about lash extensions.");

/**
 * The one measure the column is built on: the question wraps to it and both
 * buttons fill it, so the stack has a single left and right edge.
 */
const COLUMN = "w-full max-w-[327px]";

/** `h-control-lg` is the 52px the site's marketing CTAs use, so the two buttons are one control size. */
const actionClass =
  `inline-flex items-center justify-center gap-2.5 box-border ${COLUMN} ` +
  "h-control-lg px-5 rounded-control border-2 font-sans font-semibold text-[15px] " +
  "transition-[background-color,color,scale] duration-200 hover:scale-[1.02] active:scale-[0.98] " +
  "motion-reduce:transition-none motion-reduce:hover:scale-100";

export function ContactSection({ contact }: { contact: ContactDetails }) {
  const hasAnyMethod = Boolean(contact.phoneE164 || contact.email);

  return (
    <section
      id="contact"
      className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-[120px] pt-12 sm:pt-16 lg:pt-[100px] pb-10 sm:pb-14 lg:pb-[80px]"
    >
      {/* Centred against the photograph rather than top-aligned to it: the
          column is well short of the 582px frame now, and hung from the top it
          would leave the whole lower half of the section empty. */}
      <div className="relative flex flex-col lg:flex-row items-start lg:items-center gap-8 sm:gap-10 lg:gap-[60px]">
        <div className="w-full lg:w-[420px] shrink-0 flex flex-col gap-8 sm:gap-9 lg:gap-10">
          {/* Heading + question: one block, spaced tighter inside than the gap
              to the buttons, so the question reads as part of the heading and
              the buttons read as the answer to it. */}
          <div className="flex flex-col gap-5">
            <h2 className="font-display text-[56px] sm:text-[72px] lg:text-[88px] leading-[0.97] text-dark-brown">
              Stay<br />Lashed in
            </h2>

            {hasAnyMethod && (
              <p className={`font-sans text-[15px] leading-[1.6] text-charcoal ${COLUMN}`}>
                Question before you book?
              </p>
            )}
          </div>

          {hasAnyMethod && (
            <div className="flex flex-col gap-3">
              {contact.phoneE164 && contact.phoneDisplay && (
                // `?&body=` rather than `?body=`: iOS and Android disagree on
                // the separator and this form is understood by both. If a
                // browser does ignore it the worst case is an empty compose
                // box addressed to the right number, which is still the
                // action we wanted.
                <a
                  href={`sms:${contact.phoneE164}?&body=${SMS_PREFILL}`}
                  className={`${actionClass} bg-brand-brown text-white border-transparent hover:bg-text-brown`}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
                  </svg>
                  Text {contact.phoneDisplay}
                </a>
              )}

              {contact.email && (
                <a
                  href={`mailto:${contact.email}`}
                  className={`${actionClass} bg-transparent border-brand-brown text-text-brown hover:bg-brand-brown hover:text-white`}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <polyline points="2,6 12,13 22,6" />
                  </svg>
                  <span className="min-w-0 truncate">{contact.email}</span>
                </a>
              )}
            </div>
          )}

          {/* Her Instagram, Facebook and TikTok. The "Or send a DM" caption
              above these is gone; the icons are not, and they read fine
              unlabelled — three marks everyone recognises, in the same
              charcoal as the copy, on the column's left edge at the same 24px
              rhythm as everything else in the stack. */}
          <div className="flex items-center gap-6">
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
  );
}

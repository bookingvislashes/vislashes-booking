import Link from "next/link";
import {
  CONSENT_DISCLOSURE,
  CONSENT_LABEL,
  LANGUAGE_HINT,
  LANGUAGE_LABEL,
} from "@/lib/legal";

interface SmsConsentBlockProps {
  /**
   * The react-hook-form registration for the real checkbox on the booking
   * form. Omitted on the public copy at /sms, which renders the same markup
   * with the box disabled — it is there to be read, not ticked.
   */
  register?: Record<string, unknown>;
  /** Distinct id so the two copies never collide if both are ever on a page. */
  id?: string;
  /** Registration for the Spanish checkbox. Omitted on the public copy. */
  languageRegister?: Record<string, unknown>;
  /** Distinct id for the language checkbox, for the same reason as above. */
  languageId?: string;
}

/**
 * The SMS consent control: an unticked checkbox, its label, and the
 * disclosure beneath it.
 *
 * This exists as a component rather than markup inside CustomerForm because
 * two places have to show it and they must be identical. The booking form is
 * the real one. The copy on /sms is there because Twilio's automated opt-in
 * check fetches a URL and reads the HTML that comes back, and the real control
 * is on step 3 of a 7-step wizard: a crawler asking for /book gets the service
 * picker and never reaches the phone field. Their checker's words were that it
 * "couldn't automatically check your opt-in because consent is collected
 * inside a chat widget or pop-up we can't read" — the wizard looks exactly
 * like that from outside.
 *
 * So /sms serves the same control, server-rendered, at a URL with no steps in
 * front of it. Clearly marked as a copy: a reviewer must not mistake it for a
 * second place to opt in, and nobody is subscribed by it.
 *
 * Both copies read the label and disclosure from lib/legal.ts, so the example
 * cannot drift from the real thing.
 */
export function SmsConsentBlock({
  register,
  id = "smsConsent",
  languageRegister,
  languageId = "prefersSpanish",
}: SmsConsentBlockProps) {
  const interactive = Boolean(register);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-3">
      <input
        id={id}
        type="checkbox"
        className="mt-[3px] h-4 w-4 flex-none accent-deep-brown"
        {...(interactive
          ? register
          : { disabled: true, checked: false, readOnly: true, "aria-label": CONSENT_LABEL })}
      />
      <div>
        <label htmlFor={id} className="font-sans text-[14px] text-charcoal">
          {CONSENT_LABEL}
        </label>
        <p className="font-sans text-[12px] text-muted leading-[1.6] mt-1">
          {CONSENT_DISCLOSURE} See our{" "}
          <Link href="/terms" className="underline">
            Terms
          </Link>
          ,{" "}
          <Link href="/privacy" className="underline">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link href="/sms" className="underline">
            Text Message Policy
          </Link>
          .
        </p>
      </div>
      </div>

      {/* Language, nested under the consent block because it only decides how
          those texts are written — there is nothing to choose if she is not
          being texted. Written in Spanish: someone who needs it can read it,
          and someone who does not has no reason to look. Shown on the public
          copy too, so /sms is a faithful picture of the step. */}
      <div className="flex gap-3 pl-7">
        <input
          id={languageId}
          type="checkbox"
          className="mt-[3px] h-4 w-4 flex-none accent-deep-brown"
          {...(languageRegister
            ? languageRegister
            : { disabled: true, checked: false, readOnly: true, "aria-label": LANGUAGE_LABEL })}
        />
        <div>
          <label htmlFor={languageId} className="font-sans text-[14px] text-charcoal">
            {LANGUAGE_LABEL}
          </label>
          <p className="font-sans text-[12px] text-muted leading-[1.6] mt-1">
            {LANGUAGE_HINT}
          </p>
        </div>
      </div>
    </div>
  );
}

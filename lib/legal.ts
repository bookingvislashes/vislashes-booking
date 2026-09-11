/**
 * The agreements a client signs, and the two public policies.
 *
 * These used to live inside AgreementForm, which meant the only way to read
 * them was to start a booking. US carriers reviewing an A2P 10DLC campaign
 * need a privacy policy and terms at public URLs they can open without one, so
 * the text now lives here and is rendered both in the booking flow and at
 * /terms and /privacy. One source, so the page a client signs and the page a
 * reviewer reads cannot drift apart.
 *
 * Business details are read from Settings by the callers rather than written
 * in here — the address in particular belongs to the salon, not to this file.
 */

export const WAIVER_TEXT = `LASH CONSENTS, RELEASE, AND WAIVER OF LIABILITY AGREEMENT

By signing this agreement, I acknowledge that I have been informed of the potential risks associated with eyelash extension application, including but not limited to: allergic reactions to adhesive or other products, eye irritation, temporary or permanent loss of natural eyelashes, and eye infections.

I confirm that I have disclosed all relevant medical conditions and allergies. I understand that the lash artist is not a medical professional and cannot provide medical advice.

I release VIS Lashes, its owner, and its employees from any liability for injury or damage that may result from the application of eyelash extensions.

I understand that results may vary and that VIS Lashes does not guarantee specific outcomes.`;

// Clause 6 previously promised PayPal, which does not exist anywhere in the
// codebase and is not even a permitted value of bookings.payment_method — while
// omitting Google Pay, which is offered. Clause 7 charged a $3 cash fee that
// nothing collects and no column records.
/**
 * `depositAmount` is null when the services table could not be read. The clause
 * then omits the figure rather than printing a guess — a terms page stating
 * the wrong deposit is worse than one stating none, and the real amount is
 * always shown at checkout before anyone is charged.
 */
export const buildTerms = (depositAmount: number | null) => `TERMS AND CONDITIONS

1. ${
  depositAmount === null
    ? "A non-refundable deposit is required to secure your appointment. The amount is shown before you pay."
    : `A $${depositAmount.toFixed(2)} non-refundable deposit is required to secure your appointment.`
}
2. Cancellations must be made at least 24 hours before the scheduled appointment.
3. Late cancellations or no-shows may forfeit the deposit.
4. Please arrive with clean, makeup-free eyes.
5. The deposit is paid at the time of booking by card, Apple Pay, or Google Pay.
6. The remaining balance is due at your appointment and may be paid by cash or card.
7. Refills are recommended every 2-3 weeks.
8. VIS Lashes is not responsible for improper aftercare by the client.
9. By booking an appointment, you agree to these terms and conditions.`;

/**
 * The messaging clauses, kept separate so the booking terms stay about the
 * appointment. Twilio's own campaign guide lists what these have to carry:
 * programme name, description, the rates and frequency disclosures, a support
 * contact, STOP and HELP in bold, a link to the privacy policy, and the
 * carrier-liability line. Each numbered clause below is one of those, so
 * deleting one is deleting a requirement. Every claim here has to stay true of what the site actually
 * sends: the three in lib/sms.ts plus the cancellation notice, transactional
 * only, and STOP honoured automatically. If the messages change, this changes
 * with them — a carrier does compare this page against the samples on the
 * campaign registration, and a fourth message the policy never mentioned is
 * read as conflicting information and rejected.
 */
export function buildSmsTerms(details: {
  businessName: string;
  email: string | null;
  phone: string | null;
}) {
  const support = [details.email, details.phone].filter(Boolean).join(" or ");

  return `TEXT MESSAGE TERMS

1. Programme name: ${details.businessName} appointment texts.
2. By entering your mobile number when you book, you agree to receive appointment text messages from ${details.businessName} at that number. This is how you opt in; we never add a number from any other source and we never buy or import phone lists.
3. You will receive up to three messages per appointment - a booking confirmation, a reminder two days before, and a reminder two hours before - plus one message if ${details.businessName} has to cancel your appointment.
4. These messages are transactional and relate only to your own appointment. ${details.businessName} does not send marketing or promotional text messages.
5. Message frequency varies with how often you book. Message and data rates may apply.
6. **Reply STOP at any time to stop receiving text messages.** Your appointment is unaffected, and you will continue to receive email confirmations and reminders. Reply START to begin receiving them again.
7. **Reply HELP for help.**${support ? ` You can also reach us at ${support}.` : ""}
8. All the above categories exclude text messaging originator opt-in data and consent; this information won't be shared with any third parties. See our Privacy Policy, linked below.
9. Carriers are not liable for any delayed or undelivered messages.`;
}

/**
 * The privacy policy.
 *
 * The mobile-number clause is not boilerplate: US carriers require an explicit
 * statement that phone numbers collected for messaging are not sold or shared,
 * and a campaign is rejected without one. The vetting is partly a string
 * match, so the words "affiliates" and "text messaging originator opt-in data
 * and consent" are there deliberately — keep them. The processor list needs
 * its carve-out for the same reason: naming Twilio and Square without it reads
 * as sharing and contradicts the clause above.
 *
 * Everything else describes what the site genuinely does — the processors
 * named are the ones actually in use.
 */
export function buildPrivacyPolicy(details: {
  businessName: string;
  email: string | null;
  phone: string | null;
}) {
  // The studio address is deliberately excluded from this page. It is a home
  // studio, this page is public and indexable, and the address only belongs
  // in front of someone who has already booked and paid a deposit — the
  // confirmation email and text, not a document anyone can open.
  const contact = [details.businessName, details.email, details.phone]
    .filter(Boolean)
    .join("\n");

  return `PRIVACY POLICY

WHAT WE COLLECT
When you book an appointment we collect your name, email address, phone number, the appointment details you choose, and the health information you provide on the intake form. If you pay a deposit online, your card is handled entirely by Square — we never see or store your card number.

HOW WE USE IT
To book and manage your appointment, to send you confirmations and reminders by email and text message, to keep a record of your visits and any health information relevant to your treatment, and to keep the financial records required for tax purposes.

MOBILE INFORMATION AND TEXT MESSAGING CONSENT
No mobile information will be sold, rented, or shared with third parties or affiliates for marketing or promotional purposes. All the above categories exclude text messaging originator opt-in data and consent; this information won't be shared with any third parties. Your phone number is used only to send you messages about your own appointments.

HOW YOU OPT IN TO TEXT MESSAGES
You opt in by entering your own mobile number on the booking form at vislashes.com. The form tells you, at the point where the number is entered, exactly which messages you will receive and how to stop them. We never add a number from any other source, and we never buy, rent, or import phone lists.

TEXT MESSAGES
If you book with us you may receive up to three text messages per appointment: a confirmation, a reminder two days before, and a reminder two hours before. You will also receive one message if we have to cancel your appointment. These are transactional messages about your own appointment, never marketing. Message frequency varies with how often you book, and message and data rates may apply. Reply STOP at any time to stop them; your appointment and your email reminders are unaffected. Reply HELP for help.

WHO ELSE HANDLES YOUR INFORMATION
We use a small number of service providers to run the business, and they only receive what they need to do their job: Square for card payments, Supabase for storing appointment records, Resend for sending email, Twilio for sending text messages, Google Calendar for the appointment schedule, and Vercel for hosting the website. None of them are permitted to use your information for their own marketing. All the above categories exclude text messaging originator opt-in data and consent; this information won't be shared with any third parties. Twilio receives your number only to deliver a message to you on our behalf.

HOW LONG WE KEEP IT
Appointment and payment records are kept as long as required for tax and business records. You can ask us to delete your contact details at any time.

YOUR CHOICES
You can ask to see what we hold about you, ask us to correct it, ask us to delete it, or stop text messages by replying STOP. Contact us using the details below.

CHILDREN
This website is not directed at children under 13 and we do not knowingly collect their information.

CHANGES
If this policy changes, the updated version will be posted on this page.

CONTACT
${contact}`;
}

/**
 * The public messaging-policy page, at /sms.
 *
 * This exists because of how the booking flow is shaped. The consent
 * disclosure is rendered by CustomerForm, which is step 3 of 7: a reviewer has
 * to choose a service and pick a slot from a live calendar before the phone
 * field — and the sentence next to it — is on screen at all. A carrier vetting
 * an A2P campaign opens the URL on the registration and reads what comes back;
 * a crawler certainly does no more than that. Neither of them completes two
 * steps of a booking wizard, so the disclosure they are looking for has, until
 * now, been invisible to the people the disclosure is for.
 *
 * So this page states the whole messaging programme on one public URL with no
 * interaction: what is sent, how often, how consent is given, the exact words
 * shown where the number is typed, how to stop, and the sharing statement the
 * carriers require. It duplicates text that also lives in SMS_TERMS and the
 * privacy policy, which is the point — a reviewer who reads only this page
 * still sees everything, and every copy has to agree.
 *
 * CONSENT_DISCLOSURE below is the single source for that sentence: this page
 * and CustomerForm both render it, so the page cannot quote a promise the
 * booking form no longer makes.
 */
export const CONSENT_DISCLOSURE =
  "By entering your number you agree to receive appointment texts from VIS " +
  "Lashes: a confirmation, a reminder two days before, one two hours before, " +
  "and a notice if we have to cancel. No marketing, ever, and your number is " +
  "never shared. Reply STOP any time to stop them - your appointment is " +
  "unaffected - or HELP for help. Message and data rates may apply.";

export function buildMessagingPolicy(details: {
  businessName: string;
  email: string | null;
  phone: string | null;
}) {
  const contact = [details.businessName, details.email, details.phone]
    .filter(Boolean)
    .join("\n");

  return `TEXT MESSAGE POLICY

WHO WE ARE
${details.businessName} is a solo eyelash extension studio in Saint Cloud, Florida. We take appointment bookings at vislashes.com.

WHAT THIS PROGRAMME SENDS
Appointment messages, and nothing else. If you book an appointment you may receive a booking confirmation, a reminder two days before, a reminder two hours before, and a notice if we have to cancel. That is up to four messages per appointment, and how often you get them depends only on how often you book. We do not send marketing or promotional texts, and there is no way to subscribe to any that we do not send.

HOW YOU OPT IN
You opt in by typing your own mobile number into the booking form at vislashes.com/book, on the step that asks for your name, email and phone number. Nobody is added any other way: we never buy, rent, import or upload phone lists, and we never add a number we were given for something else.

WHAT THE BOOKING FORM SAYS
This sentence is shown directly beneath the phone field, before you submit anything:

"${CONSENT_DISCLOSURE}"

Links to our Terms, our Privacy Policy and this page appear immediately beneath that sentence, on the same step.

HOW TO STOP
Reply STOP to any message and they stop immediately. Your appointment is not affected, and you will still receive the same confirmations and reminders by email. Reply START to turn them back on. Reply HELP at any time and you will get our contact details back.

COSTS
Message and data rates may apply, depending on your mobile plan. We do not charge for the messages themselves.

YOUR NUMBER IS NOT SHARED
No mobile information will be sold, rented, or shared with third parties or affiliates for marketing or promotional purposes. Text messaging originator opt-in data and consent are not shared with any third party. Your number reaches Twilio, who deliver the message to your phone on our behalf, and goes nowhere else.

THE FULL POLICIES
Our Privacy Policy is at vislashes.com/privacy and our Terms & Conditions, including the text message terms, are at vislashes.com/terms.

CONTACT
${contact}`;
}

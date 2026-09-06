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
 * appointment. Every claim here has to stay true of what the site actually
 * sends: three messages, transactional only, and STOP honoured automatically.
 * If the messages change, this changes with them — a carrier can and does
 * compare this page against the samples on the campaign registration.
 */
export const SMS_TERMS = `TEXT MESSAGE TERMS

1. By providing your mobile number when you book, you agree to receive appointment text messages from VIS Lashes.
2. You will receive up to three messages per appointment: a booking confirmation, a reminder two days before, and a reminder two hours before.
3. These messages are transactional. VIS Lashes does not send marketing or promotional text messages.
4. Message and data rates may apply.
5. Reply STOP at any time to stop receiving text messages. Your appointment is unaffected, and you will continue to receive email confirmations and reminders.
6. Reply HELP for help, or contact VIS Lashes using the details below.
7. Carriers are not liable for delayed or undelivered messages.`;

/**
 * The privacy policy.
 *
 * The mobile-number clause is not boilerplate: US carriers require an explicit
 * statement that phone numbers collected for messaging are not sold or shared,
 * and a campaign is rejected without one. Everything else describes what the
 * site genuinely does — the processors named are the ones actually in use.
 */
export function buildPrivacyPolicy(details: {
  businessName: string;
  address: string | null;
  email: string | null;
  phone: string | null;
}) {
  const contact = [
    details.businessName,
    details.address,
    details.email,
    details.phone,
  ]
    .filter(Boolean)
    .join("\n");

  return `PRIVACY POLICY

WHAT WE COLLECT
When you book an appointment we collect your name, email address, phone number, the appointment details you choose, and the health information you provide on the intake form. If you pay a deposit online, your card is handled entirely by Square — we never see or store your card number.

HOW WE USE IT
To book and manage your appointment, to send you confirmations and reminders by email and text message, to keep a record of your visits and any health information relevant to your treatment, and to keep the financial records required for tax purposes.

MOBILE NUMBERS ARE NOT SHARED
No mobile information collected for text messaging will be sold, rented, or shared with any third party for marketing or promotional purposes. Phone numbers are used only to send you messages about your own appointments.

TEXT MESSAGES
If you book with us you may receive up to three text messages per appointment: a confirmation, a reminder two days before, and a reminder two hours before. These are transactional messages, never marketing. Message and data rates may apply. Reply STOP at any time to stop them; your appointment and your email reminders are unaffected.

WHO ELSE HANDLES YOUR INFORMATION
We use a small number of service providers to run the business, and they only receive what they need to do their job: Square for card payments, Supabase for storing appointment records, Resend for sending email, Twilio for sending text messages, Google Calendar for the appointment schedule, and Vercel for hosting the website. None of them are permitted to use your information for their own marketing.

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

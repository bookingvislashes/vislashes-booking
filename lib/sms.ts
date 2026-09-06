/**
 * Appointment texts.
 *
 * Deliberately dependency-free: this talks to Twilio's REST API with fetch
 * rather than pulling in their SDK, because the whole surface used here is one
 * POST. Fewer moving parts to keep current, and nothing extra in the bundle.
 *
 * SAFE BEFORE SETUP. Every function no-ops when the Twilio environment
 * variables are absent, so this ships to production and simply does nothing
 * until an account exists. Reminders continue to go out by email throughout;
 * texting is added alongside them, never in place of them.
 */

const SMS_FROM = () => process.env.TWILIO_FROM_NUMBER;
const ACCOUNT_SID = () => process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = () => process.env.TWILIO_AUTH_TOKEN;

/** True once all three Twilio settings are present. */
export function isSmsConfigured(): boolean {
  return Boolean(ACCOUNT_SID() && AUTH_TOKEN() && SMS_FROM());
}

/**
 * Normalise a stored phone number to E.164, which is the only format Twilio
 * accepts. The client list holds these however they were typed over three
 * years of Acuity — "(407) 555-0123", "407-555-0123", "4075550123" — so this
 * strips everything that is not a digit and adds the US country code.
 *
 * Returns null rather than guessing when the result is not a plausible US
 * number: a malformed text is a failed send and a confused client, and the
 * email reminder already covers this person.
 */
export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  // Already E.164 with a different country code — pass it through untouched.
  if (raw.trim().startsWith("+") && digits.length >= 11 && digits.length <= 15) {
    return `+${digits}`;
  }
  return null;
}

/** Thrown when Twilio rejects a message because the person replied STOP. */
export class SmsOptedOutError extends Error {
  constructor(public readonly to: string) {
    super(`${to} has opted out of messages`);
    this.name = "SmsOptedOutError";
  }
}

/**
 * Send one text. Throws on failure so the caller can decide what that means —
 * an opt-out is permanent and worth recording, a network blip is worth
 * retrying on the next run.
 */
export async function sendSms(to: string, body: string): Promise<string> {
  const sid = ACCOUNT_SID();
  const token = AUTH_TOKEN();
  const from = SMS_FROM();

  if (!sid || !token || !from) {
    throw new Error("Twilio is not configured");
  }

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    }
  );

  const payload = (await res.json().catch(() => ({}))) as {
    sid?: string;
    code?: number;
    message?: string;
  };

  if (!res.ok) {
    // 21610 is Twilio's "this number replied STOP". Distinct from a failure:
    // retrying it is both useless and, in spirit, ignoring someone's answer.
    if (payload.code === 21610) throw new SmsOptedOutError(to);
    throw new Error(
      `Twilio ${res.status}: ${payload.message ?? "send failed"}${
        payload.code ? ` (code ${payload.code})` : ""
      }`
    );
  }

  return payload.sid ?? "";
}

/** First name only. Texts are short and a full legal name reads like a bill. */
function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName;
}

/**
 * "Saturday, September 12". Built in the salon's timezone from a plain
 * YYYY-MM-DD, parsed at local noon so no UTC rollover can move the day.
 */
function friendlyDate(value: string): string {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/** Just the weekday — "Saturday" — for the two-day text. */
function weekday(value: string): string {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).toLocaleDateString("en-US", {
    weekday: "long",
  });
}

export interface AppointmentSms {
  clientName: string;
  serviceName: string;
  bookingDate: string;
  timeSlot: string;
  /** From the business_address setting. Omitted from the text when unset —
   *  a wrong address sends someone to the wrong house. */
  address?: string | null;
  depositAmount?: number;
}

/**
 * The three messages, in the salon owner's voice.
 *
 * Each is built on the same four beats: who it is from, the one fact that
 * matters, the one thing to do, and the way out. No message invites a reply
 * the salon cannot see — inbound texts land at Twilio, not on her phone, so
 * "reply here" would quietly swallow a client asking to reschedule.
 */
export function confirmationText(a: AppointmentSms): string {
  const deposit = a.depositAmount
    ? `\nDeposit received: $${a.depositAmount.toFixed(2)}`
    : "";
  // The address is what makes this text actually useful for finding the
  // studio, not just a receipt — printed here rather than only in the email
  // so a client who reads texts and skims email still knows where to go.
  const where = a.address ? `\n${a.address}` : "";
  return (
    `VIS Lashes — you're booked, ${firstName(a.clientName)}!\n\n` +
    `${a.serviceName}\n` +
    `${friendlyDate(a.bookingDate)} at ${a.timeSlot}${deposit}${where}\n\n` +
    `Everything you need is in your email confirmation. See you soon!\n\n` +
    // Carriers require opt-out instructions, and the first message a client
    // receives is the place for them. Only on the confirmation: repeating it
    // on every reminder reads like marketing, which is the opposite of what
    // this is.
    `Reply STOP to opt out.`
  );
}

export function twoDayText(a: AppointmentSms): string {
  return (
    `Hi ${firstName(a.clientName)}! Your ${a.serviceName} with VIS Lashes ` +
    `is in 2 days — ${weekday(a.bookingDate)} at ${a.timeSlot}.\n\n` +
    `To prep: clean lashes, no mascara, and go easy on the caffeine.\n\n` +
    `Need to change it? Let me know today and I'll find you another spot.`
  );
}

/**
 * Sent when the salon cancels an appointment from the admin. This is the one
 * message a client most needs to actually see — an email she opens tomorrow is
 * an email about a slot she has already driven to.
 */
export function cancellationText(a: {
  clientName: string;
  bookingDate: string;
  timeSlot: string;
  depositRefunded?: boolean;
}): string {
  const deposit = a.depositRefunded
    ? `\n\nYour deposit will be refunded.`
    : "";
  return (
    `Hi ${firstName(a.clientName)} — your VIS Lashes appointment on ` +
    `${friendlyDate(a.bookingDate)} at ${a.timeSlot} has been cancelled.` +
    `${deposit}\n\n` +
    `Sorry for the change! Book again any time at vislashes.com.`
  );
}

export function twoHourText(a: AppointmentSms): string {
  const where = a.address ? `\n${a.address}\n` : "\n";
  return (
    `See you in 2 hours, ${firstName(a.clientName)}!\n\n` +
    `${a.timeSlot}${where}\n` +
    `Text or call when you arrive and I'll let you in.`
  );
}

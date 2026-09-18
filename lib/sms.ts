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
/** Which of the two message bodies a client gets. */
export type SmsLanguage = "en" | "es";

function friendlyDate(value: string, lang: SmsLanguage = "en"): string {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).toLocaleDateString(
    lang === "es" ? "es-US" : "en-US",
    { weekday: "long", month: "long", day: "numeric" }
  );
}

/** Just the weekday — "Saturday" — for the two-day text. */
function weekday(value: string, lang: SmsLanguage = "en"): string {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).toLocaleDateString(
    lang === "es" ? "es-US" : "en-US",
    { weekday: "long" }
  );
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
  /** Defaults to English. Set from clients.preferred_language. */
  language?: SmsLanguage;
}

/**
 * The three messages, in the salon owner's voice.
 *
 * LANGUAGE: each message has an English body and a Spanish one, chosen by
 * clients.preferred_language. They sit next to each other in the same
 * function rather than in separate files, so a change to what the salon
 * actually does has to be made twice in one place instead of once in two —
 * a half-translated programme is worse than an untranslated one, and the
 * A2P registration describes both.
 *
 * The Spanish bodies are UCS-2, not GSM-7, and cost about twice as many
 * segments: 5 against 3 on the confirmation, 4 against 2 on the two-day and
 * the cancellation. That is not the em dash mistake repeated — á, í, ó and ú
 * are simply not in the GSM-7 alphabet (é, ñ, ü, ¿ and ¡ are), so correct
 * Spanish cannot be GSM-7. Stripping the accents would halve it and is a
 * decision for the salon owner, not a default to take quietly on her behalf.
 *
 * PUNCTUATION: hyphens, not em dashes, and straight quotes throughout. A text
 * is encoded in GSM-7 only while every character is in that alphabet, and an
 * em dash is not; one of them anywhere in the body switches the whole message
 * to UCS-2, which cuts a segment from 160 characters to 70. The confirmation
 * below is long enough that this is the difference between 2 segments and 4 —
 * paid per segment, on every booking, forever. Prose in these comments can use
 * whatever punctuation reads best; the message bodies cannot.
 *
 * Each is built on the same four beats: who it is from, the one fact that
 * matters, the one thing to do, and the way out. No message invites a reply
 * the salon cannot see — inbound texts land at Twilio, not on her phone, so
 * "reply here" would quietly swallow a client asking to reschedule.
 */
export function confirmationText(a: AppointmentSms): string {
  const where = a.address ? `\n${a.address}` : "";

  // This is the opt-in confirmation, and Twilio's campaign guide is specific
  // about what one has to carry: the brand (at the top), the frequency, the
  // rates disclosure, how to get help and how to stop. Only on the
  // confirmation — repeating it on every reminder reads like marketing, which
  // is the opposite of what this is. Twilio answers both keywords itself once
  // Advanced Opt-Out is on, in whichever language the keyword was sent in.
  if (a.language === "es") {
    const deposit = a.depositAmount
      ? `\nDepósito recibido: $${a.depositAmount.toFixed(2)}`
      : "";
    return (
      `VIS Lashes - ¡lista, ${firstName(a.clientName)}!\n\n` +
      `${a.serviceName}\n` +
      `${friendlyDate(a.bookingDate, "es")} a las ${a.timeSlot}${deposit}${where}\n\n` +
      `Todo lo demás está en tu correo. ¡Nos vemos!\n\n` +
      `Hasta 3 mensajes más sobre esta cita. Pueden aplicarse tarifas de mensajes y datos.\n` +
      `Responde AYUDA para ayuda, PARAR para cancelar.`
    );
  }

  const deposit = a.depositAmount
    ? `\nDeposit received: $${a.depositAmount.toFixed(2)}`
    : "";
  return (
    `VIS Lashes - you're booked, ${firstName(a.clientName)}!\n\n` +
    `${a.serviceName}\n` +
    `${friendlyDate(a.bookingDate)} at ${a.timeSlot}${deposit}${where}\n\n` +
    `Everything you need is in your email confirmation. See you soon!\n\n` +
    `Up to 3 more texts for this appointment. Msg & data rates may apply.\n` +
    `Reply HELP for help, STOP to opt out.`
  );
}

export function twoDayText(a: AppointmentSms): string {
  if (a.language === "es") {
    return (
      `¡Hola ${firstName(a.clientName)}! Tu ${a.serviceName} con VIS Lashes ` +
      `es en 2 días - ${weekday(a.bookingDate, "es")} a las ${a.timeSlot}.\n\n` +
      `Para prepararte: pestañas limpias, sin rímel, y con calma con la cafeína.\n\n` +
      `¿Necesitas cambiarla? Avísame hoy y te busco otro espacio.`
    );
  }
  return (
    `Hi ${firstName(a.clientName)}! Your ${a.serviceName} with VIS Lashes ` +
    `is in 2 days - ${weekday(a.bookingDate)} at ${a.timeSlot}.\n\n` +
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
  language?: SmsLanguage;
}): string {
  if (a.language === "es") {
    const deposit = a.depositRefunded
      ? `\n\nTu depósito será reembolsado.`
      : "";
    return (
      `Hola ${firstName(a.clientName)} - tu cita de VIS Lashes del ` +
      `${friendlyDate(a.bookingDate, "es")} a las ${a.timeSlot} ha sido cancelada.` +
      `${deposit}\n\n` +
      `¡Perdón por el cambio! Puedes reservar otra vez cuando quieras en vislashes.com.`
    );
  }

  const deposit = a.depositRefunded
    ? `\n\nYour deposit will be refunded.`
    : "";
  return (
    `Hi ${firstName(a.clientName)} - your VIS Lashes appointment on ` +
    `${friendlyDate(a.bookingDate)} at ${a.timeSlot} has been cancelled.` +
    `${deposit}\n\n` +
    `Sorry for the change! Book again any time at vislashes.com.`
  );
}

export function twoHourText(a: AppointmentSms): string {
  const where = a.address ? `\n${a.address}\n` : "\n";
  if (a.language === "es") {
    return (
      `¡Nos vemos en 2 horas, ${firstName(a.clientName)}!\n\n` +
      `${a.timeSlot}${where}\n` +
      `Escríbeme o llámame cuando llegues y te abro.`
    );
  }
  return (
    `See you in 2 hours, ${firstName(a.clientName)}!\n\n` +
    `${a.timeSlot}${where}\n` +
    `Text or call when you arrive and I'll let you in.`
  );
}

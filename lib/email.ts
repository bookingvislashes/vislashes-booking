import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";
import { rescheduleUrl, reviewUrl } from "./booking-links";

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

const emailFrom = process.env.EMAIL_FROM || "onboarding@resend.dev";

/**
 * Just the address out of `emailFrom`, without a display name.
 *
 * EMAIL_FROM is allowed to carry one — "VIS Lashes <bookings@vislashes.com>"
 * is what puts the salon's name in a client's inbox instead of a bare
 * address, and Resend takes either form. But two places compare it to
 * something a visitor typed, to keep the salon's own address from being
 * treated as a client: the import, and the "do we know you?" lookup on the
 * booking form. Those compare whole strings, so the display-name form would
 * never match and the guard would stop working without failing — which is
 * the kind of break nobody finds. They use this instead.
 */
export const emailFromAddress = (
  emailFrom.match(/<([^>]+)>/)?.[1] ?? emailFrom
)
  .trim()
  .toLowerCase();

/**
 * Hand a message to Resend, and fail loudly if Resend refuses it.
 *
 * THIS IS THE WHOLE POINT OF THIS FUNCTION. Resend's SDK does NOT throw when
 * the API rejects a send — `emails.send()` resolves with `{ data, error }`
 * and puts the failure in `error`. Every call site here used to be a bare
 * `await ...send(...)` inside a try/catch, which catches an exception that is
 * never thrown. The result: an unverified sending domain, a bad API key, a
 * suppressed address — all of it looked like success, nothing was logged, and
 * the salon's own "confirmation sent" screen said so too, while Resend's
 * dashboard recorded no sent email at all.
 *
 * Throwing here restores what every caller already assumed: their try/catch
 * means what it says, the reminder cron stops stamping bookings it never
 * reminded, and the resend button reports the real reason.
 */
async function deliver(
  payload: Parameters<Resend["emails"]["send"]>[0]
): Promise<void> {
  const { error } = await getResend().emails.send(payload);
  if (error) {
    throw new Error(
      `${error.name || "send_failed"}: ${error.message || "Resend rejected the message."}`
    );
  }
}

/* ────────────────────────────────────────────────────────────────────────
 * Brand
 *
 * The salon's palette, repeated here rather than imported from globals.css
 * because an email cannot load a stylesheet — every colour has to be inline
 * on the element that uses it. Playfair is the brand face on the site, but
 * webfonts do not render in Outlook or most desktop clients, so the wordmark
 * is Arial with wide letter-spacing (the same treatment the design notes in
 * md/EMAIL_AUTOMATIONS.md call for).
 * ──────────────────────────────────────────────────────────────────────── */
const PAGE = "#F5F0EB";
const CARD = "#FFFFFF";
const INK = "#2C2C2C";
const HEADING = "#3D2B1F";
const ACCENT = "#8B6F47";
const MUTED = "#9A9A9A";
const RULE = "#E8DDD0";
const FONT = "Arial, Helvetica, sans-serif";

/**
 * The salon's profiles, in the footer of every email.
 *
 * The icons are served from the site itself rather than embedded, because
 * Gmail strips data: URIs on images. Every mail client that blocks images by
 * default then shows the alt text instead — still a link, still labelled — so
 * the footer degrades to two words rather than two broken frames. When
 * NEXT_PUBLIC_BASE_URL is not set there is nowhere to serve them from, and the
 * footer falls back to plain text links.
 */
const SOCIALS = [
  {
    name: "Instagram",
    url: "https://www.instagram.com/vislashesbooking",
    icon: "instagram.png",
  },
  {
    name: "TikTok",
    url: "https://www.tiktok.com/@vislashes",
    icon: "tiktok.png",
  },
] as const;

function siteBase(): string {
  return (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
}

function socialRowHtml(): string {
  const base = siteBase();

  const cells = SOCIALS.map((social) => {
    const inner = base
      ? `<img src="${base}/email/${social.icon}" width="22" height="22" alt="${social.name}" style="display:block;border:0;outline:none;text-decoration:none;" />`
      : `<span style="font-family:${FONT};font-size:12px;color:${ACCENT};">${social.name}</span>`;
    return `<td style="padding:0 9px;"><a href="${social.url}" style="text-decoration:none;color:${ACCENT};">${inner}</a></td>`;
  }).join("");

  return `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:14px auto 0;">
                <tr>${cells}</tr>
              </table>`;
}

/**
 * Names, service names and notes all reach these templates from a form. A
 * client called "Renée & Co <3" used to break the markup around her; worse,
 * anything a client typed was interpolated into HTML that lands in the
 * salon's own inbox. Everything interpolated below goes through this first.
 */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** "2026-09-08" reads as a database row, not a date. */
function friendlyDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const [, y, m, d] = match;
  return new Date(Number(y), Number(m) - 1, Number(d), 12).toLocaleDateString(
    "en-US",
    { weekday: "long", month: "long", day: "numeric" }
  );
}

/** The same date, short enough to survive a subject line on a phone. */
function shortDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const [, y, m, d] = match;
  return new Date(Number(y), Number(m) - 1, Number(d), 12).toLocaleDateString(
    "en-US",
    { weekday: "short", month: "short", day: "numeric" }
  );
}

/* ────────────────────────────────────────────────────────────────────────
 * Layout
 *
 * One shell for every email the site sends, so the four of them cannot drift
 * apart. Built from tables rather than divs: Outlook's rendering engine is
 * Word, which ignores max-width and border-radius on a div and would print
 * the confirmation full-bleed across a desktop monitor.
 * ──────────────────────────────────────────────────────────────────────── */

interface DetailRow {
  label: string;
  /** Plain text. Escaped on the way in and reused verbatim in the text part. */
  value: string;
  /** Optional richer rendering (a mailto: link, say). Must already be escaped. */
  html?: string;
}

interface Section {
  title?: string;
  /** Already-escaped HTML. */
  html: string;
  /** The same section as plain text, for the text/plain part. */
  text: string;
}

interface Layout {
  /** The grey line after the subject in an inbox list. Worth writing. */
  preheader: string;
  heading: string;
  intro?: string;
  rows?: DetailRow[];
  /** A small line directly under the details card. */
  rowsNote?: string;
  sections?: Section[];
  cta?: { label: string; url: string };
  /**
   * Sections placed AFTER the button.
   *
   * The confirmation's loyalty offer lives here: it is the one thing in that
   * email nobody needs in order to turn up on the right day, so it sits below
   * everything that is, rather than pushing the reschedule button further
   * down the message.
   */
  postCta?: Section[];
  /**
   * A decorative strip under the wordmark. Served from the site like the
   * social icons, and carries alt text, so a client blocking images loses a
   * flourish and nothing else.
   */
  banner?: { file: string; alt: string; height: number };
  /** Sits above the wordmark in the footer. */
  footerLead?: string;
}

function renderRows(rows: DetailRow[]): string {
  return rows
    .map(
      (row, i) => `
              <tr>
                <td style="padding:${i === 0 ? "0" : "14px"} 0 0;">
                  <p style="margin:0 0 4px;font-family:${FONT};font-size:12px;line-height:16px;letter-spacing:1px;color:${MUTED};text-transform:uppercase;">${esc(row.label)}</p>
                  <p style="margin:0;font-family:${FONT};font-size:16px;line-height:22px;color:${HEADING};font-weight:bold;">${row.html ?? esc(row.value)}</p>
                </td>
              </tr>`
    )
    .join("");
}

function renderHtml(layout: Layout): string {
  const rowsCard = layout.rows?.length
    ? `
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${PAGE};border-radius:8px;margin:0 0 24px;">
            <tr>
              <td style="padding:20px 22px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  ${renderRows(layout.rows)}
                </table>
                ${
                  layout.rowsNote
                    ? `<p style="margin:14px 0 0;font-family:${FONT};font-size:13px;line-height:18px;color:${MUTED};">${esc(layout.rowsNote)}</p>`
                    : ""
                }
              </td>
            </tr>
          </table>`
    : "";

  const renderSections = (list: Section[]) =>
    list
      .map(
        (section) => `
          ${
            section.title
              ? `<h3 style="margin:0 0 8px;font-family:${FONT};font-size:15px;line-height:20px;color:${HEADING};">${esc(section.title)}</h3>`
              : ""
          }
          <div style="margin:0 0 22px;font-family:${FONT};font-size:14px;line-height:21px;color:${INK};">${section.html}</div>`
      )
      .join("");

  const sections = renderSections(layout.sections || []);

  // Separated from the body above by a hairline, so it reads as a postscript
  // rather than as one more thing to get through.
  const postCta = layout.postCta?.length
    ? `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 22px;">
                <tr><td style="border-top:1px solid ${RULE};font-size:0;line-height:0;">&nbsp;</td></tr>
              </table>
${renderSections(layout.postCta)}`
    : "";

  const bannerBase = siteBase();
  const banner =
    layout.banner && bannerBase
      ? `
              <img src="${bannerBase}/email/${layout.banner.file}" width="520" height="${layout.banner.height}" alt="${esc(layout.banner.alt)}" style="display:block;width:100%;max-width:520px;height:auto;border:0;margin:0 0 20px;" />`
      : "";

  const cta = layout.cta
    ? `
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
            <tr>
              <td style="background-color:${ACCENT};border-radius:6px;">
                <a href="${esc(layout.cta.url)}" style="display:inline-block;padding:12px 26px;font-family:${FONT};font-size:14px;line-height:18px;font-weight:bold;color:#FFFFFF;text-decoration:none;">${esc(layout.cta.label)}</a>
              </td>
            </tr>
          </table>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>VIS Lashes</title>
</head>
<body style="margin:0;padding:0;background-color:${PAGE};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(layout.preheader)}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${PAGE};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:520px;background-color:${CARD};border-radius:10px;">
          <tr>
            <td style="padding:32px 28px;">
              <p style="margin:0 0 ${layout.banner ? "18px" : "26px"};text-align:center;font-family:${FONT};font-size:13px;line-height:18px;letter-spacing:4px;color:${HEADING};font-weight:bold;">VIS <span style="font-style:italic;font-weight:normal;">LASHES</span></p>
${banner}
              <h1 style="margin:0 0 8px;font-family:${FONT};font-size:22px;line-height:29px;color:${HEADING};font-weight:bold;">${esc(layout.heading)}</h1>
              ${
                layout.intro
                  ? `<p style="margin:0 0 24px;font-family:${FONT};font-size:14px;line-height:21px;color:${INK};">${esc(layout.intro)}</p>`
                  : `<div style="height:16px;line-height:16px;">&nbsp;</div>`
              }
${rowsCard}
${sections}
${cta}
${postCta}
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr><td style="border-top:1px solid ${RULE};font-size:0;line-height:0;">&nbsp;</td></tr>
              </table>
              ${
                layout.footerLead
                  ? `<p style="margin:20px 0 0;text-align:center;font-family:${FONT};font-size:12px;line-height:18px;color:${MUTED};">${esc(layout.footerLead)}</p>`
                  : ""
              }
              <p style="margin:${layout.footerLead ? "14px" : "20px"} 0 0;text-align:center;font-family:${FONT};font-size:12px;line-height:18px;letter-spacing:3px;color:${HEADING};font-weight:bold;">VIS LASHES</p>
${socialRowHtml()}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * The same message as text/plain. Sent alongside every HTML body: a message
 * with no text part is one of the cheapest things a spam filter can score
 * against, and it is what a watch or a screen reader falls back to.
 */
function renderText(layout: Layout): string {
  const parts: string[] = ["VIS LASHES", "", layout.heading];
  if (layout.intro) parts.push("", layout.intro);
  if (layout.rows?.length) {
    parts.push("");
    for (const row of layout.rows) parts.push(`${row.label}: ${row.value}`);
  }
  if (layout.rowsNote) parts.push(layout.rowsNote);
  for (const section of layout.sections || []) {
    parts.push("");
    if (section.title) parts.push(section.title);
    parts.push(section.text);
  }
  if (layout.cta) parts.push("", `${layout.cta.label}: ${layout.cta.url}`);
  for (const section of layout.postCta || []) {
    parts.push("");
    if (section.title) parts.push(section.title);
    parts.push(section.text);
  }
  parts.push("", "—");
  if (layout.footerLead) parts.push(layout.footerLead);
  parts.push("VIS LASHES");
  parts.push(SOCIALS.map((s) => `${s.name}: ${s.url}`).join("\n"));
  return parts.join("\n");
}

/**
 * The four things a client needs to know before she sees them.
 *
 * Deliberately short and deliberately shared: the confirmation and the
 * two-day reminder print exactly this list, so the reminder is a glance
 * rather than a second read. The grace period is here rather than buried in
 * a policy page because "am I allowed to be five minutes late" is the
 * question, and answering it warmly is worth more than the line costs.
 */
const PREP_NOTES = [
  "Clean lashes, no eye makeup.",
  "Please remove contacts before arrival.",
  "Running late? No stress — there's a 15-minute grace period.",
  "It's a cozy one-on-one space, so please come solo.",
];

/** A paragraph section from plain text, escaped. */
function paragraphs(title: string | undefined, lines: string[]): Section {
  return {
    title,
    html: lines
      .map((line) => `<p style="margin:0 0 8px;">${esc(line)}</p>`)
      .join(""),
    text: lines.join("\n"),
  };
}

/** A bulleted section from plain text, escaped. */
function bullets(title: string, items: string[]): Section {
  return {
    title,
    html: `<ul style="margin:0;padding-left:20px;">${items
      .map((item) => `<li style="margin:0 0 6px;">${esc(item)}</li>`)
      .join("")}</ul>`,
    text: items.map((item) => `• ${item}`).join("\n"),
  };
}

/* ────────────────────────────────────────────────────────────────────────
 * Settings the emails need
 * ──────────────────────────────────────────────────────────────────────── */

export interface EmailSettings {
  /**
   * The studio's street address. Private: it never appears on a public page
   * and only ever reaches someone in a confirmation, after they have booked
   * and paid a deposit. Null when Settings could not be read or the field is
   * blank — the location section is then omitted rather than guessed at.
   */
  studioAddress: string | null;
  /**
   * Admin → Settings → Business Email. The address clients are given on the
   * public contact section. Null when she has not filled it in.
   */
  businessEmail: string | null;
  /**
   * Admin → Settings → Your Inbox. Where her blind copy of every booking goes
   * and where a client's reply lands — deliberately separate from Business
   * Email, because this one is a personal address that never appears on a
   * public page. Falls back to Business Email when blank.
   */
  ownerInbox: string | null;
  /**
   * What goes in Reply-To on everything a client receives.
   *
   * Your Inbox — her real, monitored address — and deliberately not the
   * bookings@ address in From. Reply-To is not hidden: a client pressing
   * reply sees it in the To field of their draft. Routing it through the
   * public address would hide the personal one, but only if that mailbox
   * actually receives mail; pointed at an address nobody reads, a client's
   * reply vanishes. She chose the address that works over the one that
   * hides, so this is the address that works.
   *
   * Her blind copy goes to the same place. Bcc genuinely is invisible.
   */
  replyTo: string | null;
  /**
   * Settings → advance booking hours. The same number the calendar uses to
   * decide how late a slot can be taken, and therefore how late a client may
   * move their own appointment — so the confirmation has to quote THIS rather
   * than a figure written into the copy. Hers is 10, not 24, and an email
   * promising "up to the day before" would have been wrong.
   */
  noticeHours: number;
}

const DEFAULT_NOTICE_HOURS = 24;

const NO_SETTINGS: EmailSettings = {
  studioAddress: null,
  businessEmail: null,
  ownerInbox: null,
  replyTo: null,
  noticeHours: DEFAULT_NOTICE_HOURS,
};

/**
 * One read for both values, replacing the two separate address lookups the
 * booking paths used to do. Never throws: an email is best-effort everywhere
 * it is sent from, and by the time these are needed a card has usually
 * already been charged.
 */
export async function getEmailSettings(
  supabase: SupabaseClient
): Promise<EmailSettings> {
  try {
    const { data, error } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", [
        "business_address",
        "business_email",
        "owner_inbox_email",
        "advance_booking_hours",
      ]);

    if (error) {
      console.error("getEmailSettings: fetch failed:", error);
      return NO_SETTINGS;
    }

    const byKey = Object.fromEntries(
      (data || []).map((row) => [row.key, (row.value || "").trim()])
    );

    const businessEmail = byKey.business_email || null;
    const ownerInbox = byKey.owner_inbox_email || businessEmail;

    const notice = Number(byKey.advance_booking_hours);

    return {
      studioAddress: byKey.business_address || null,
      businessEmail,
      ownerInbox,
      replyTo: ownerInbox,
      noticeHours:
        Number.isFinite(notice) && notice > 0 ? notice : DEFAULT_NOTICE_HOURS,
    };
  } catch (err) {
    console.error("getEmailSettings: threw:", err);
    return NO_SETTINGS;
  }
}

/**
 * Where her blind copy of a booking goes.
 *
 * Your Inbox in Settings by default, so she changes it in the app rather than
 * asking for a deploy. OWNER_NOTIFICATION_EMAIL overrides it, and accepts a
 * comma-separated list. Empty when neither is set — nothing is guessed at and
 * no copy is sent.
 *
 * These addresses go in Bcc, never Cc: the client's confirmation is a message
 * between the salon and them, and her personal address has no business
 * appearing in it.
 */
export function ownerRecipients(ownerInbox: string | null): string[] {
  const configured = (process.env.OWNER_NOTIFICATION_EMAIL || "").trim();
  const source = configured || ownerInbox || "";
  return source
    .split(",")
    .map((address) => address.trim())
    .filter((address) => address.includes("@"));
}

/* ────────────────────────────────────────────────────────────────────────
 * Client emails
 * ──────────────────────────────────────────────────────────────────────── */

interface BookingEmailData {
  clientName: string;
  clientEmail: string;
  serviceName: string;
  bookingDate: string;
  timeSlot: string;
  duration: string;
  depositAmount: number;
  totalPrice: number;
  paymentMethod: string;
  /**
   * Whether the deposit is actually in hand. Optional, and it has to stay
   * that way: the checkout path never passes it, and there "not cash" has
   * always meant "a card was just charged". An appointment the salon books
   * herself is the case that breaks that assumption — a deposit sent by
   * Zelle is paid and is not cash, and an invoice she has just texted is
   * neither.
   */
  depositPaid?: boolean;
  /** "Zelle", "Apple Cash" — named so the client can recognise her own payment. */
  depositMethodLabel?: string;
  /** From Settings; see EmailSettings.studioAddress. */
  studioAddress?: string | null;
  /**
   * From Settings (Your Inbox). Set as Reply-To so a client answering the
   * confirmation reaches her personally rather than a no-reply void — which
   * is both what she wants and one of the signals that keeps these out of
   * Promotions.
   */
  replyTo?: string | null;
  /**
   * Her blind copy. The client's confirmation is the record she wants, so she
   * is bcc'd on the message itself rather than sent a separate one — she sees
   * exactly what they saw, and nothing in their copy reveals she is on it.
   */
  bcc?: string[];
  /**
   * Enables the "change your date or time" button. Absent means no button:
   * the link is signed from this id, so there is nothing to offer without it.
   */
  bookingId?: string;
  /**
   * "booked" is the confirmation sent when an appointment is first made;
   * "moved" is the same email after the client reschedules themselves.
   */
  variant?: "booked" | "moved";
  /**
   * A credit spent on this appointment — the $10 for tagging her, or a
   * birthday treat. Comes off the balance due at the chair, never off the
   * deposit, so it changes what the email says is still owed and nothing
   * about what was charged.
   */
  discountAmount?: number;
  /** "Thanks for tagging me!" — shown to the client beside the amount. */
  discountReason?: string;
  /**
   * How much notice the reschedule page actually requires, from Settings.
   * Quoted rather than described, so the promise in the email and the rule
   * the page enforces cannot disagree.
   */
  rescheduleNoticeHours?: number;
  /**
   * What tagging her is worth, from Settings. Absent means the offer is not
   * mentioned at all rather than mentioned with a guessed figure.
   */
  tagCreditAmount?: number;
}

/**
 * How to say the reschedule cut-off in a sentence.
 *
 * A day or more reads better as "the day before" than as "24 hours before";
 * anything shorter has to be stated in hours, because "the day before" would
 * be a promise the page then refuses to keep.
 */
function noticeWindow(hours: number | undefined): string {
  const h = Math.round(hours ?? DEFAULT_NOTICE_HOURS);
  if (h >= 24) return "any time up to the day before";
  if (h === 1) return "up to an hour before";
  return `up to ${h} hours before`;
}

/** Everything the confirmation says about money, in one place. */
function depositSummary(data: BookingEmailData) {
  const isCash = data.paymentMethod === "cash";
  const depositPaid = data.depositPaid ?? !isCash;
  const depositHeld = depositPaid ? data.depositAmount : 0;
  const discount = Math.max(0, data.discountAmount ?? 0);
  // Floored at zero. A deposit and a credit together can exceed the service
  // price, and a negative balance would read as the salon owing them money.
  const remainingBalance = Math.max(0, data.totalPrice - depositHeld - discount);

  const line = depositPaid
    ? `$${data.depositAmount.toFixed(2)} paid${
        data.depositMethodLabel ? ` (${data.depositMethodLabel})` : ""
      }`
    : isCash
    ? "Cash payment due at appointment"
    : `$${data.depositAmount.toFixed(2)} due to hold your spot`;

  return { depositPaid, remainingBalance, line, discount };
}

/**
 * What a send did, for the one caller that needs to know.
 *
 * Every automatic send ignores this and carries on, which is the contract
 * that keeps a booking from failing because Resend had a bad minute. But a
 * human pressing "send confirmation again" is owed the truth: silently
 * swallowing "your domain is not verified" there would have her pressing the
 * button and wondering why nothing arrives.
 */
export type EmailResult = { ok: true } | { ok: false; error: string };

export async function sendConfirmationEmail(
  data: BookingEmailData
): Promise<EmailResult> {
  const firstName = data.clientName.trim().split(" ")[0];
  const deposit = depositSummary(data);
  const moved = data.variant === "moved";

  const sections: Section[] = [];
  if (data.studioAddress) {
    sections.push(paragraphs("Where to find me", [data.studioAddress]));
  }
  // The same four lines as the reminder, word for word. Two emails saying the
  // same thing differently is two things to read; saying it identically means
  // the second one is already familiar. The appointment length is not among
  // them — it is in the details card two inches above.
  sections.push(bullets("Before you come", PREP_NOTES));

  // Only offered when the link can actually be built — a button that goes
  // nowhere is worse than sending them to reply, which the footer already
  // says. The deposit line is the point of it: she does not want anyone
  // thinking a change of date costs them their deposit.
  const reschedule = data.bookingId ? rescheduleUrl(data.bookingId) : null;
  if (reschedule) {
    sections.push(
      paragraphs("Need a different day?", [
        `Move it yourself ${noticeWindow(data.rescheduleNoticeHours)} — your deposit comes with you.`,
      ])
    );
  }

  const layout: Layout = {
    preheader: `${data.serviceName} · ${friendlyDate(data.bookingDate)} at ${data.timeSlot}`,
    heading: moved
      ? `All set, ${firstName} — you're moved!`
      : `You're all set, ${firstName}!`,
    intro: moved
      ? "All moved. Here's your new time."
      : "You're confirmed — I can't wait to see you!",
    rows: [
      { label: "Service", value: data.serviceName },
      {
        label: "Date & time",
        value: `${friendlyDate(data.bookingDate)} at ${data.timeSlot}`,
      },
      { label: "Duration", value: data.duration },
      { label: "Deposit", value: deposit.line },
      ...(deposit.discount > 0
        ? [
            {
              label: "Your credit",
              value: `−$${deposit.discount.toFixed(2)}${
                data.discountReason ? ` · ${data.discountReason}` : ""
              }`,
            },
          ]
        : []),
    ],
    rowsNote:
      deposit.remainingBalance > 0
        ? `Remaining balance: $${deposit.remainingBalance.toFixed(2)}, due at your appointment.`
        : undefined,
    sections,
    cta: reschedule
      ? { label: "Change my date or time", url: reschedule }
      : undefined,
    // Below the button, behind a rule. The loyalty offer is the one thing in
    // this email nobody needs in order to turn up on the right day, so it
    // does not get to crowd the things they do. It belongs in the
    // confirmation rather than the follow-up all the same: the window is 24
    // hours from the appointment, and a follow-up two days later would be
    // telling them about something already missed. Skipped on a reschedule —
    // they read it the first time.
    postCta:
      !moved && data.tagCreditAmount
        ? [
            paragraphs(
              `Want $${data.tagCreditAmount.toFixed(0)} off next time?`,
              [
                `Post a selfie within 24 hours of your appointment and tag me @vislashesbooking — I'll put $${data.tagCreditAmount.toFixed(0)} toward your next visit.`,
              ]
            ),
          ]
        : undefined,
    footerLead: "Questions? Just reply to this email.",
  };

  try {
    await deliver({
      from: emailFrom,
      to: data.clientEmail,
      ...(data.bcc && data.bcc.length ? { bcc: data.bcc } : {}),
      ...(data.replyTo ? { replyTo: data.replyTo } : {}),
      subject: moved
        ? `Your new time — ${shortDate(data.bookingDate)} at ${data.timeSlot}`
        : `You're booked — ${shortDate(data.bookingDate)} at ${data.timeSlot}`,
      html: renderHtml(layout),
      text: renderText(layout),
    });
    return { ok: true };
  } catch (error) {
    console.error("Failed to send confirmation email:", error);
    return { ok: false, error: describeSendError(error) };
  }
}

/**
 * Turn whatever Resend threw into something she can act on.
 *
 * The failures that actually happen here are the test sender, an unverified
 * domain and a missing API key, and each is fixable in about a minute once
 * named. Anything else is passed through rather than flattened into
 * "something went wrong".
 */
function describeSendError(error: unknown): string {
  const raw =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message)
      : String(error);

  // Checked before the domain case below, and on the sending address rather
  // than on Resend's wording, because this one is not an unverified domain at
  // all and used to be reported as one.
  //
  // onboarding@resend.dev is Resend's shared test sender. It is allowed to
  // reach exactly one address — the Resend account's own — so it works
  // perfectly while she is testing on herself and then refuses every real
  // client the day the site goes live. `emailFrom` falls back to it when
  // EMAIL_FROM is unset, so this is also what a missing variable looks like,
  // which is how it went unnoticed: every confirmation and every blind copy
  // was refused, and the old message here sent her to verify a domain that
  // was not the problem and then told her to set EMAIL_FROM to the very
  // address that was failing.
  if (/resend\.dev/i.test(emailFrom)) {
    return "Emails are still going out from Resend's test address, which is only allowed to reach your own inbox — so every client's confirmation is being refused, and your blind copy with it. In Vercel, set EMAIL_FROM to an address on your own verified domain, then redeploy.";
  }

  if (/not verified|domain is not|validation_error/i.test(raw)) {
    const domain = emailFrom.split("@").pop()?.replace(/>$/, "") || emailFrom;
    return `${emailFrom} can't send yet — ${domain} isn't verified in Resend. Open Resend, go to Domains, add ${domain}, and add the DNS records it gives you. Sending starts working once it shows Verified.`;
  }
  if (/api[_ ]?key|unauthor|401|403/i.test(raw)) {
    return "Resend refused the API key. Check RESEND_API_KEY in Vercel.";
  }
  return raw || "The email service didn't say why.";
}

/** Which reminder this is. The wording is the only difference. */
export type ReminderWindow = "twoDay" | "twoHour";

const REMINDER_COPY: Record<ReminderWindow, { subject: string; lead: string }> = {
  twoDay: {
    subject: "Your lash appointment is in 2 days",
    lead: "Just a quick reminder — see you in two days!",
  },
  twoHour: {
    subject: "See you in a couple of hours",
    lead: "Your appointment is in about two hours.",
  },
};

/**
 * Unlike the confirmation email, this one rethrows. Its caller stamps the
 * booking as reminded only when the send resolves, so swallowing the error
 * here would mark every booking reminded during a Resend outage and nobody
 * would ever get one.
 */
export async function sendReminderEmail(
  data: BookingEmailData & { window?: ReminderWindow }
) {
  const copy = REMINDER_COPY[data.window ?? "twoDay"];
  const firstName = data.clientName.trim().split(" ")[0];

  const sections: Section[] = [];
  if (data.studioAddress) {
    sections.push(paragraphs("Where to find me", [data.studioAddress]));
  }
  sections.push(bullets("Before you come", PREP_NOTES));

  const layout: Layout = {
    preheader: `${data.serviceName} · ${friendlyDate(data.bookingDate)} at ${data.timeSlot}`,
    heading: `See you soon, ${firstName}!`,
    intro: copy.lead,
    rows: [
      { label: "Service", value: data.serviceName },
      {
        label: "Date & time",
        value: `${friendlyDate(data.bookingDate)} at ${data.timeSlot}`,
      },
    ],
    sections,
    footerLead: "Need to reschedule? Just reply to this email.",
  };

  try {
    await deliver({
      from: emailFrom,
      to: data.clientEmail,
      ...(data.replyTo ? { replyTo: data.replyTo } : {}),
      subject: copy.subject,
      html: renderHtml(layout),
      text: renderText(layout),
    });
  } catch (error) {
    console.error("Failed to send reminder email:", error);
    throw error;
  }
}

export async function sendCancellationEmail(data: {
  clientName: string;
  clientEmail: string;
  bookingDate: string;
  timeSlot: string;
  depositPaid: boolean;
  replyTo?: string | null;
  /**
   * Her blind copy. This is the one email she has to act on rather than file:
   * a cancelled appointment with a deposit against it means going into Square
   * and refunding it by hand, and nothing else in the app tells her that.
   */
  bcc?: string[];
}) {
  const firstName = data.clientName.trim().split(" ")[0];
  const base = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");

  const lines = [
    `Hi ${firstName}, your appointment on ${friendlyDate(data.bookingDate)} at ${data.timeSlot} has been cancelled.`,
  ];
  if (data.depositPaid) {
    lines.push("Your deposit will be refunded within 5–10 business days.");
  }
  lines.push("I'd love to see you whenever you're ready.");

  const layout: Layout = {
    preheader: `${friendlyDate(data.bookingDate)} at ${data.timeSlot} — cancelled`,
    heading: "Your appointment has been cancelled",
    sections: [paragraphs(undefined, lines)],
    cta: base ? { label: "Book a new appointment", url: `${base}/book` } : undefined,
    footerLead: "Questions? Just reply to this email.",
  };

  try {
    await deliver({
      from: emailFrom,
      to: data.clientEmail,
      ...(data.bcc && data.bcc.length ? { bcc: data.bcc } : {}),
      ...(data.replyTo ? { replyTo: data.replyTo } : {}),
      subject: "Your VIS Lashes appointment has been cancelled",
      html: renderHtml(layout),
      text: renderText(layout),
    });
  } catch (error) {
    console.error("Failed to send cancellation email:", error);
  }
}

/* ────────────────────────────────────────────────────────────────────────
 * After the appointment
 * ──────────────────────────────────────────────────────────────────────── */

export interface FollowUpEmailData {
  clientName: string;
  clientEmail: string;
  replyTo?: string | null;
  /** Enables the review link. Absent means no review section at all. */
  bookingId?: string;
}

/**
 * The check-in two days after an appointment.
 *
 * Three jobs in about a hundred words, in the order they earn their place:
 *
 * 1. Aftercare. Poor retention is the most common reason a lash client does
 *    not come back, and it is usually aftercare rather than application — so
 *    the tips are not filler, they are the thing that protects the work.
 * 2. The refill nudge. Two to three weeks is the industry window, and saying
 *    it plainly is what turns one appointment into a standing one.
 * 3. The ask. A client is never happier about their lashes than in the first
 *    few days, which is exactly when a tag or a recommendation costs them
 *    nothing to give.
 *
 * Rethrows, like the reminders: the caller only stamps the booking as
 * followed up once the send resolves, so swallowing an outage here would mark
 * everyone done and nobody would ever get one.
 *
 * She is deliberately not blind-copied. Her copy exists for bookings, which
 * are things she has to act on; a copy of every follow-up would be noise.
 */
export async function sendFollowUpEmail(data: FollowUpEmailData) {
  const firstName = data.clientName.trim().split(" ")[0];
  const base = siteBase();
  const review = data.bookingId ? reviewUrl(data.bookingId) : null;

  const layout: Layout = {
    preheader: "Keeping them looking new, and when to book your fill",
    heading: `How are they holding up, ${firstName}?`,
    intro: "It's been a couple of days — I hope you're loving them!",
    sections: [
      bullets("Keeping them looking new", [
        "Brush them each morning with your spoolie.",
        "Skip oil-based makeup and cleansers around your eyes.",
        "Sleep on your back or side where you can.",
      ]),
      paragraphs("Ready for your fill?", [
        "Most clients come back every 2–3 weeks. That's the sweet spot for keeping them full.",
      ]),
      paragraphs("One little favour", [
        "If you're loving them, tag me in a selfie @vislashesbooking — and if a friend asks who did your lashes, send them my way. Word of mouth means everything to me.",
      ]),
      // A linked line rather than the button, because the button belongs to
      // the refill — that is the one that pays for itself. Sits below the
      // tag ask: a review is the bigger favour of the two, and leading with
      // it would make the whole email read as a request.
      ...(review
        ? [
            {
              title: "Or leave me a review",
              html: `<p style="margin:0;">It takes about thirty seconds and it helps other people find me. <a href="${esc(review)}" style="color:${ACCENT};font-weight:bold;text-decoration:underline;">Leave a review</a></p>`,
              text: `It takes about thirty seconds and it helps other people find me: ${review}`,
            },
          ]
        : []),
    ],
    cta: base ? { label: "Book my fill", url: `${base}/book` } : undefined,
    footerLead: "Any questions about your lashes? Just reply.",
  };

  try {
    await deliver({
      from: emailFrom,
      to: data.clientEmail,
      ...(data.replyTo ? { replyTo: data.replyTo } : {}),
      subject: `How are your lashes, ${firstName}?`,
      html: renderHtml(layout),
      text: renderText(layout),
    });
  } catch (error) {
    console.error("Failed to send follow-up email:", error);
    throw error;
  }
}

/**
 * The birthday greeting, sent once at the start of a client's birth month.
 *
 * The credit is already on their account by the time this arrives — the cron
 * grants it first and only then sends — so the email is telling them about
 * something that is true rather than promising something a later step might
 * fail to deliver.
 */
export async function sendBirthdayEmail(data: {
  clientName: string;
  clientEmail: string;
  amount: number;
  replyTo?: string | null;
}) {
  const firstName = data.clientName.trim().split(" ")[0];
  const base = siteBase();
  const amount = `$${data.amount.toFixed(0)}`;

  const layout: Layout = {
    preheader: `${amount} off any service, all month long`,
    // The one email on this site that gets an emoji. Everywhere else they are
    // left off because they cost a little deliverability for nothing; here
    // the whole point is that it should feel like a card rather than a
    // notification, and the emoji is the part that lands even when a client's
    // inbox blocks the confetti above it.
    heading: `Happy birthday, ${firstName}! 🎉`,
    banner: { file: "confetti.gif", alt: "", height: 85 },
    intro: "It's your month, so here's a little something from me.",
    sections: [
      paragraphs(undefined, [
        `${amount} off any service, yours to use any time this month. It's already on your account — book in and it comes off automatically.`,
      ]),
    ],
    cta: base ? { label: "Book my birthday set", url: `${base}/book` } : undefined,
    footerLead: "Have the loveliest day.",
  };

  try {
    await deliver({
      from: emailFrom,
      to: data.clientEmail,
      ...(data.replyTo ? { replyTo: data.replyTo } : {}),
      subject: `Happy birthday, ${firstName}! 🎉 ${amount} off this month`,
      html: renderHtml(layout),
      text: renderText(layout),
    });
  } catch (error) {
    console.error("Failed to send birthday email:", error);
    throw error;
  }
}

/**
 * The nudge six weeks after an appointment, to someone with nothing booked.
 *
 * Six weeks is roughly two missed fill cycles — long enough that they have
 * drifted rather than merely being late, and early enough that their lashes
 * are a memory rather than a bad one. No discount attached: this is a warm
 * "I'd love to see you", and leading with money teaches clients to wait for
 * a sale before rebooking.
 */
export async function sendWinBackEmail(data: {
  clientName: string;
  clientEmail: string;
  replyTo?: string | null;
}) {
  const firstName = data.clientName.trim().split(" ")[0];
  const base = siteBase();

  const layout: Layout = {
    preheader: "Your chair is still here whenever you want it",
    heading: `Miss you, ${firstName}!`,
    intro: "It's been about six weeks since I last saw you.",
    sections: [
      paragraphs(undefined, [
        "No pressure at all — I just wanted you to know your spot is here whenever you're ready. A full set, a refill, or a lift if you fancy a change.",
      ]),
    ],
    cta: base ? { label: "Find me a time", url: `${base}/book` } : undefined,
    footerLead: "Just reply if you'd rather I found you a time.",
  };

  try {
    await deliver({
      from: emailFrom,
      to: data.clientEmail,
      ...(data.replyTo ? { replyTo: data.replyTo } : {}),
      subject: `We miss you, ${firstName}`,
      html: renderHtml(layout),
      text: renderText(layout),
    });
  } catch (error) {
    console.error("Failed to send win-back email:", error);
    throw error;
  }
}

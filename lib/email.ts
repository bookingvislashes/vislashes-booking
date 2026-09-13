import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";
import { rescheduleUrl } from "./reschedule-link";

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

const emailFrom = process.env.EMAIL_FROM || "onboarding@resend.dev";

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

  const sections = (layout.sections || [])
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
              <p style="margin:0 0 26px;text-align:center;font-family:${FONT};font-size:13px;line-height:18px;letter-spacing:4px;color:${HEADING};font-weight:bold;">VIS <span style="font-style:italic;font-weight:normal;">LASHES</span></p>
              <h1 style="margin:0 0 8px;font-family:${FONT};font-size:22px;line-height:29px;color:${HEADING};font-weight:bold;">${esc(layout.heading)}</h1>
              ${
                layout.intro
                  ? `<p style="margin:0 0 24px;font-family:${FONT};font-size:14px;line-height:21px;color:${INK};">${esc(layout.intro)}</p>`
                  : `<div style="height:16px;line-height:16px;">&nbsp;</div>`
              }
${rowsCard}
${sections}
${cta}
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
  parts.push("", "—");
  if (layout.footerLead) parts.push(layout.footerLead);
  parts.push("VIS LASHES");
  parts.push(SOCIALS.map((s) => `${s.name}: ${s.url}`).join("\n"));
  return parts.join("\n");
}

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
   * Business Email when she has one, because Reply-To is NOT hidden — a
   * client pressing reply sees the address in the To field of their draft.
   * Pointing it at the public bookings@ address and forwarding that mailbox
   * to her personal one is what keeps the personal one off their screen.
   * Until she sets that up this falls back to Your Inbox: a reply that
   * reaches her and shows the address beats a reply that reaches nobody.
   *
   * Her blind copy is unaffected either way. Bcc genuinely is invisible, so
   * it always goes to Your Inbox.
   */
  replyTo: string | null;
}

const NO_SETTINGS: EmailSettings = {
  studioAddress: null,
  businessEmail: null,
  ownerInbox: null,
  replyTo: null,
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
      .in("key", ["business_address", "business_email", "owner_inbox_email"]);

    if (error) {
      console.error("getEmailSettings: fetch failed:", error);
      return NO_SETTINGS;
    }

    const byKey = Object.fromEntries(
      (data || []).map((row) => [row.key, (row.value || "").trim()])
    );

    const businessEmail = byKey.business_email || null;
    const ownerInbox = byKey.owner_inbox_email || businessEmail;

    return {
      studioAddress: byKey.business_address || null,
      businessEmail,
      ownerInbox,
      replyTo: businessEmail || ownerInbox,
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
}

/** Everything the confirmation says about money, in one place. */
function depositSummary(data: BookingEmailData) {
  const isCash = data.paymentMethod === "cash";
  const depositPaid = data.depositPaid ?? !isCash;
  const depositHeld = depositPaid ? data.depositAmount : 0;
  // Floored at zero. A deposit larger than the service price would otherwise
  // print a negative balance as though the salon owed the client money.
  const remainingBalance = Math.max(0, data.totalPrice - depositHeld);

  const line = depositPaid
    ? `$${data.depositAmount.toFixed(2)} paid${
        data.depositMethodLabel ? ` (${data.depositMethodLabel})` : ""
      }`
    : isCash
    ? "Cash payment due at appointment"
    : `$${data.depositAmount.toFixed(2)} due to hold your spot`;

  return { depositPaid, remainingBalance, line };
}

export async function sendConfirmationEmail(data: BookingEmailData) {
  const firstName = data.clientName.trim().split(" ")[0];
  const deposit = depositSummary(data);
  const moved = data.variant === "moved";

  const sections: Section[] = [];
  if (data.studioAddress) {
    sections.push(paragraphs("Where to find me", [data.studioAddress]));
  }
  sections.push(
    bullets("A few things before you come", [
      "Come with clean lashes and no eye makeup — it helps everything bond beautifully.",
      "Please remove your contact lenses before your appointment.",
      "Come a few minutes early if you can, and no stress at all if you can't.",
      "It's a cozy one-on-one space, so please come on your own — no extra guests. Thank you for understanding!",
      `Set aside about ${data.duration}. Most clients nap right through it.`,
    ])
  );

  // Only offered when the link can actually be built — a button that goes
  // nowhere is worse than sending them to reply, which the footer already
  // says. The deposit line is the point of it: she does not want anyone
  // thinking a change of date costs them their deposit.
  const reschedule = data.bookingId ? rescheduleUrl(data.bookingId) : null;
  if (reschedule) {
    sections.push(
      paragraphs("Need a different day?", [
        "Life happens — you can move your appointment yourself, any time up to the day before.",
        "Your deposit comes with you, so there's nothing to pay again.",
      ])
    );
  }

  const layout: Layout = {
    preheader: `${data.serviceName} · ${friendlyDate(data.bookingDate)} at ${data.timeSlot}`,
    heading: moved
      ? `All set, ${firstName} — you're moved!`
      : `You're all set, ${firstName}!`,
    intro: moved
      ? "Your appointment has been rescheduled. Here's the new time."
      : "Your lash appointment is confirmed. I can't wait to see you!",
    rows: [
      { label: "Service", value: data.serviceName },
      {
        label: "Date & time",
        value: `${friendlyDate(data.bookingDate)} at ${data.timeSlot}`,
      },
      { label: "Duration", value: data.duration },
      { label: "Deposit", value: deposit.line },
    ],
    rowsNote:
      deposit.remainingBalance > 0
        ? `Remaining balance: $${deposit.remainingBalance.toFixed(2)}, due at your appointment.`
        : undefined,
    sections,
    cta: reschedule
      ? { label: "Change my date or time", url: reschedule }
      : undefined,
    footerLead: "Questions? Just reply to this email.",
  };

  try {
    await getResend().emails.send({
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
  } catch (error) {
    console.error("Failed to send confirmation email:", error);
  }
}

/** Which reminder this is. The wording is the only difference. */
export type ReminderWindow = "twoDay" | "twoHour";

const REMINDER_COPY: Record<ReminderWindow, { subject: string; lead: string }> = {
  twoDay: {
    subject: "Reminder: your lash appointment is in 2 days",
    lead: "Your lash appointment is in two days.",
  },
  twoHour: {
    subject: "See you soon — your lash appointment is in 2 hours",
    lead: "Your lash appointment is in about two hours.",
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
  sections.push(
    bullets("A few reminders", [
      "Come with clean, makeup-free eyes.",
      "Please remove your contact lenses before your appointment.",
      "It's a cozy one-on-one space, so please come on your own — no extra guests. Thank you for understanding!",
    ])
  );

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
    await getResend().emails.send({
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
  lines.push("I'd love to see you another time whenever you're ready.");

  const layout: Layout = {
    preheader: `${friendlyDate(data.bookingDate)} at ${data.timeSlot} — cancelled`,
    heading: "Your appointment has been cancelled",
    sections: [paragraphs(undefined, lines)],
    cta: base ? { label: "Book a new appointment", url: `${base}/book` } : undefined,
    footerLead: "Questions? Just reply to this email.",
  };

  try {
    await getResend().emails.send({
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

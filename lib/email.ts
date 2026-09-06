import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

const emailFrom = process.env.EMAIL_FROM || "onboarding@resend.dev";

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
}

export async function sendConfirmationEmail(data: BookingEmailData) {
  const isCash = data.paymentMethod === "cash";
  const depositPaid = data.depositPaid ?? !isCash;
  const depositHeld = depositPaid ? data.depositAmount : 0;
  // Floored at zero. A deposit larger than the service price would otherwise
  // print a negative balance as though the salon owed the client money.
  const remainingBalance = Math.max(0, data.totalPrice - depositHeld);

  const depositLine = depositPaid
    ? `$${data.depositAmount.toFixed(2)} paid${
        data.depositMethodLabel ? ` (${data.depositMethodLabel})` : ""
      }`
    : isCash
    ? "Cash payment due at appointment"
    : `$${data.depositAmount.toFixed(2)} due to hold your spot`;

  try {
    await getResend().emails.send({
      from: emailFrom,
      to: data.clientEmail,
      subject: "Your VIS Lashes Appointment is Confirmed",
      html: `
        <div style="background-color:#F5F0EB;padding:40px 20px;font-family:Arial,sans-serif;">
          <div style="max-width:500px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
            <h1 style="text-align:center;color:#3D2B1F;font-size:14px;letter-spacing:3px;margin-bottom:24px;">
              VIS <em>LASHES</em>
            </h1>
            <h2 style="color:#3D2B1F;font-size:22px;margin-bottom:8px;">You're all set, ${data.clientName.split(" ")[0]}!</h2>
            <p style="color:#2C2C2C;font-size:14px;margin-bottom:24px;">Your lash appointment has been confirmed.</p>
            <div style="background:#F5F0EB;border-radius:8px;padding:20px;margin-bottom:24px;">
              <p style="margin:0 0 8px;font-size:13px;color:#9A9A9A;">SERVICE</p>
              <p style="margin:0 0 16px;font-size:16px;color:#3D2B1F;font-weight:600;">${data.serviceName}</p>
              <p style="margin:0 0 8px;font-size:13px;color:#9A9A9A;">DATE & TIME</p>
              <p style="margin:0 0 16px;font-size:16px;color:#3D2B1F;font-weight:600;">${friendlyDate(data.bookingDate)} at ${data.timeSlot}</p>
              <p style="margin:0 0 8px;font-size:13px;color:#9A9A9A;">DURATION</p>
              <p style="margin:0 0 16px;font-size:16px;color:#3D2B1F;font-weight:600;">${data.duration}</p>
              <p style="margin:0 0 8px;font-size:13px;color:#9A9A9A;">DEPOSIT</p>
              <p style="margin:0;font-size:16px;color:#3D2B1F;font-weight:600;">
                ${depositLine}
              </p>
              ${remainingBalance > 0 ? `<p style="margin:8px 0 0;font-size:13px;color:#9A9A9A;">Remaining balance: $${remainingBalance.toFixed(2)} due at appointment</p>` : ""}
            </div>
            <h3 style="color:#3D2B1F;font-size:16px;margin-bottom:8px;">What to Expect</h3>
            <ul style="color:#2C2C2C;font-size:14px;padding-left:20px;">
              <li>Come with clean lashes, no eye makeup</li>
              <li>Your appointment will take approximately ${data.duration}</li>
            </ul>
            <hr style="border:none;border-top:1px solid #E8DDD0;margin:24px 0;" />
            <p style="text-align:center;color:#9A9A9A;font-size:12px;">
              Need to reschedule? Contact us directly.<br/>
              VIS LASHES &middot; Orlando &middot; Saint Cloud &middot; Kissimmee
            </p>
          </div>
        </div>
      `,
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
  try {
    await getResend().emails.send({
      from: emailFrom,
      to: data.clientEmail,
      subject: copy.subject,
      html: `
        <div style="background-color:#F5F0EB;padding:40px 20px;font-family:Arial,sans-serif;">
          <div style="max-width:500px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
            <h1 style="text-align:center;color:#3D2B1F;font-size:14px;letter-spacing:3px;margin-bottom:24px;">
              VIS <em>LASHES</em>
            </h1>
            <h2 style="color:#3D2B1F;font-size:22px;margin-bottom:8px;">Hi ${data.clientName.split(" ")[0]}, just a friendly reminder!</h2>
            <p style="color:#2C2C2C;font-size:14px;margin-bottom:24px;">${copy.lead}</p>
            <div style="background:#F5F0EB;border-radius:8px;padding:20px;margin-bottom:24px;">
              <p style="margin:0 0 8px;font-size:13px;color:#9A9A9A;">SERVICE</p>
              <p style="margin:0 0 16px;font-size:16px;color:#3D2B1F;font-weight:600;">${data.serviceName}</p>
              <p style="margin:0 0 8px;font-size:13px;color:#9A9A9A;">DATE & TIME</p>
              <p style="margin:0;font-size:16px;color:#3D2B1F;font-weight:600;">${friendlyDate(data.bookingDate)} at ${data.timeSlot}</p>
            </div>
            <h3 style="color:#3D2B1F;font-size:16px;margin-bottom:8px;">Prep Tips</h3>
            <ul style="color:#2C2C2C;font-size:14px;padding-left:20px;">
              <li>Arrive with clean, makeup-free eyes</li>
              <li>Avoid caffeine beforehand (helps you stay still!)</li>
            </ul>
            <hr style="border:none;border-top:1px solid #E8DDD0;margin:24px 0;" />
            <p style="text-align:center;color:#9A9A9A;font-size:12px;">
              VIS LASHES &middot; Orlando &middot; Saint Cloud &middot; Kissimmee
            </p>
          </div>
        </div>
      `,
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
}) {
  try {
    await getResend().emails.send({
      from: emailFrom,
      to: data.clientEmail,
      subject: "Your VIS Lashes Appointment Has Been Cancelled",
      html: `
        <div style="background-color:#F5F0EB;padding:40px 20px;font-family:Arial,sans-serif;">
          <div style="max-width:500px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
            <h1 style="text-align:center;color:#3D2B1F;font-size:14px;letter-spacing:3px;margin-bottom:24px;">
              VIS <em>LASHES</em>
            </h1>
            <h2 style="color:#3D2B1F;font-size:22px;margin-bottom:8px;">Appointment Cancelled</h2>
            <p style="color:#2C2C2C;font-size:14px;">
              Hi ${data.clientName.split(" ")[0]}, your appointment on ${friendlyDate(data.bookingDate)} at ${data.timeSlot} has been cancelled.
            </p>
            ${data.depositPaid ? '<p style="color:#2C2C2C;font-size:14px;">Your deposit will be refunded within 5-10 business days.</p>' : ""}
            <p style="color:#2C2C2C;font-size:14px;">
              Want to rebook? <a href="${process.env.NEXT_PUBLIC_BASE_URL}/book" style="color:#8B6F47;font-weight:600;">Book a new appointment</a>
            </p>
            <hr style="border:none;border-top:1px solid #E8DDD0;margin:24px 0;" />
            <p style="text-align:center;color:#9A9A9A;font-size:12px;">
              VIS LASHES &middot; Orlando &middot; Saint Cloud &middot; Kissimmee
            </p>
          </div>
        </div>
      `,
    });
  } catch (error) {
    console.error("Failed to send cancellation email:", error);
  }
}

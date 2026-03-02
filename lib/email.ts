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
}

export async function sendConfirmationEmail(data: BookingEmailData) {
  const isCash = data.paymentMethod === "cash";
  const remainingBalance = data.totalPrice - (isCash ? 0 : data.depositAmount);

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
              <p style="margin:0 0 16px;font-size:16px;color:#3D2B1F;font-weight:600;">${data.bookingDate} at ${data.timeSlot}</p>
              <p style="margin:0 0 8px;font-size:13px;color:#9A9A9A;">DURATION</p>
              <p style="margin:0 0 16px;font-size:16px;color:#3D2B1F;font-weight:600;">${data.duration}</p>
              <p style="margin:0 0 8px;font-size:13px;color:#9A9A9A;">DEPOSIT</p>
              <p style="margin:0;font-size:16px;color:#3D2B1F;font-weight:600;">
                ${isCash ? "Cash payment due at appointment" : `$${data.depositAmount.toFixed(2)} paid`}
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

export async function sendReminderEmail(data: BookingEmailData) {
  try {
    await getResend().emails.send({
      from: emailFrom,
      to: data.clientEmail,
      subject: "Reminder: Your Lash Appointment is Tomorrow",
      html: `
        <div style="background-color:#F5F0EB;padding:40px 20px;font-family:Arial,sans-serif;">
          <div style="max-width:500px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
            <h1 style="text-align:center;color:#3D2B1F;font-size:14px;letter-spacing:3px;margin-bottom:24px;">
              VIS <em>LASHES</em>
            </h1>
            <h2 style="color:#3D2B1F;font-size:22px;margin-bottom:8px;">Hi ${data.clientName.split(" ")[0]}, just a friendly reminder!</h2>
            <p style="color:#2C2C2C;font-size:14px;margin-bottom:24px;">Your lash appointment is tomorrow.</p>
            <div style="background:#F5F0EB;border-radius:8px;padding:20px;margin-bottom:24px;">
              <p style="margin:0 0 8px;font-size:13px;color:#9A9A9A;">SERVICE</p>
              <p style="margin:0 0 16px;font-size:16px;color:#3D2B1F;font-weight:600;">${data.serviceName}</p>
              <p style="margin:0 0 8px;font-size:13px;color:#9A9A9A;">DATE & TIME</p>
              <p style="margin:0;font-size:16px;color:#3D2B1F;font-weight:600;">${data.bookingDate} at ${data.timeSlot}</p>
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
              Hi ${data.clientName.split(" ")[0]}, your appointment on ${data.bookingDate} at ${data.timeSlot} has been cancelled.
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

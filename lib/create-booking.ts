import { SupabaseClient } from "@supabase/supabase-js";
import {
  getEmailSettings,
  ownerRecipients,
  sendConfirmationEmail,
} from "./email";
import { confirmationText, isSmsConfigured, sendSms, toE164 } from "./sms";
import { syncBookingEvent } from "./google-calendar";

interface BookingFormData {
  serviceId: string;
  bookingDate: string;
  timeSlot: string;
  fullName: string;
  phone: string;
  email: string;
  /** The optional text-message box on step 3. False unless she ticked it. */
  smsConsent?: boolean;
  hasHadExtensions: boolean;
  isSpecialOccasion: boolean;
  occasionDetails?: string;
  hasCataracts: boolean;
  hasConjunctivitis: boolean;
  hasDryEye: boolean;
  hasGlaucoma: boolean;
  otherComplaints?: string;
  doctorName?: string;
  surgeryNotes?: string;
  medicalAcknowledgment: boolean;
  filmingConsent: boolean;
  liabilityWaiverSigned: boolean;
  termsAccepted: boolean;
  signatureData: string;
  paymentMethod: string;
  hasRemoval?: boolean;
}

interface CreateBookingOptions {
  supabase: SupabaseClient;
  formData: BookingFormData;
  depositPaid: boolean;
  depositAmount?: number;
  squarePaymentId?: string;
  /** Resolved server-side from settings — never sent by the browser. */
  removalPrice?: number;
  removalMinutes?: number;
}

export async function createBooking({
  supabase,
  formData,
  depositPaid,
  depositAmount,
  squarePaymentId,
  removalPrice = 0,
  removalMinutes = 0,
}: CreateBookingOptions) {
  // 1. Upsert client (find by email or create new)
  //
  // Normalised before it is used as the lookup key. clients.email is a
  // case-sensitive unique text column, so "Jane@Example.com" on a second visit
  // did not match "jane@example.com" from the first — it passed the constraint
  // and forked the client into a second row, resetting visit_count and
  // splitting their history.
  const email = formData.email.trim().toLowerCase();
  const fullName = formData.fullName.trim();

  // maybeSingle, not single: single returns an error for "no rows", which is
  // the normal first-visit case, and it was indistinguishable from a genuine
  // query failure being silently read as "new client" — then rejected by the
  // unique constraint at insert, on the card path, after capture.
  const { data: existingClient, error: lookupError } = await supabase
    .from("clients")
    .select("id, visit_count")
    .eq("email", email)
    .maybeSingle();

  if (lookupError) {
    throw new Error(`Client lookup failed: ${lookupError.message}`);
  }

  let clientId: string;

  // Ticking the box is the opt-in, and it is only ever written when true.
  // An untick on a later booking is not a withdrawal of an earlier consent —
  // that is what STOP is for — so this spreads into the update rather than
  // setting the column back to false and silently revoking it.
  const smsConsentFields = formData.smsConsent
    ? { sms_consent: true, sms_consent_at: new Date().toISOString() }
    : {};

  if (existingClient) {
    clientId = existingClient.id;
    // This error was discarded while the insert branch below checked properly.
    // A failed update was completely silent: the booking confirmed, but a
    // corrected phone number never saved and the salon called the old one.
    //
    // visit_count and last_visit_date are deliberately not touched here — they
    // used to be written at booking time, which counted bookings rather than
    // appointments kept and recorded a future date as the last visit. They
    // belong to the admin's status change to "completed".
    const { error: updateError } = await supabase
      .from("clients")
      .update({
        full_name: fullName,
        phone: formData.phone,
        ...smsConsentFields,
        updated_at: new Date().toISOString(),
      })
      .eq("id", clientId);

    if (updateError) {
      throw new Error(`Failed to update client: ${updateError.message}`);
    }
  } else {
    // Before creating anyone, look for an imported record with the same phone
    // and no email. 47 of the clients brought over from Acuity have no email
    // address on file, so matching on email alone would file a returning
    // regular as brand new — splitting her history and, worse, leaving her
    // failing the returning-client check that unlocks refills.
    const digits = (value: string) => value.replace(/[^0-9]/g, "").slice(-10);
    const phoneDigits = digits(formData.phone || "");
    let adoptedId: string | null = null;

    if (phoneDigits.length === 10) {
      const { data: emailless } = await supabase
        .from("clients")
        .select("id, phone")
        .is("email", null)
        .not("phone", "is", null)
        .limit(2000);

      adoptedId =
        (emailless || []).find((c) => digits(c.phone || "") === phoneDigits)
          ?.id ?? null;
    }

    if (adoptedId) {
      // Fill in the email we now have, so every later visit matches on it
      // directly and this phone scan is never needed for her again.
      const { error: adoptError } = await supabase
        .from("clients")
        .update({
          full_name: fullName,
          email,
          phone: formData.phone,
          ...smsConsentFields,
          updated_at: new Date().toISOString(),
        })
        .eq("id", adoptedId);

      if (adoptError) {
        throw new Error(`Failed to update client: ${adoptError.message}`);
      }
      clientId = adoptedId;
    } else {
      const { data: newClient, error: clientError } = await supabase
        .from("clients")
        .insert({
          full_name: fullName,
          email,
          phone: formData.phone,
          ...smsConsentFields,
        })
        .select("id")
        .single();

      if (clientError || !newClient) {
        throw new Error(`Failed to create client: ${clientError?.message}`);
      }
      clientId = newClient.id;
    }
  }

  // 2. Get service details for email
  const { data: service } = await supabase
    .from("services")
    .select("*")
    .eq("id", formData.serviceId)
    .single();

  if (!service) {
    throw new Error("Service not found");
  }

  // 3. Create booking record
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .insert({
      client_id: clientId,
      service_id: formData.serviceId,
      booking_date: formData.bookingDate,
      time_slot: formData.timeSlot,
      status: "confirmed",
      payment_method: formData.paymentMethod,
      deposit_paid: depositPaid,
      deposit_amount: depositAmount ?? service.deposit_amount,
      square_payment_id: squarePaymentId ?? null,
      has_removal: Boolean(formData.hasRemoval),
    })
    .select("id")
    .single();

  if (bookingError || !booking) {
    throw new Error(`Failed to create booking: ${bookingError?.message}`);
  }

  // 4. Create intake form
  await supabase.from("intake_forms").insert({
    booking_id: booking.id,
    client_id: clientId,
    has_had_extensions: formData.hasHadExtensions,
    is_special_occasion: formData.isSpecialOccasion,
    occasion_details: formData.occasionDetails || null,
    has_cataracts: formData.hasCataracts,
    has_conjunctivitis: formData.hasConjunctivitis,
    has_dry_eye: formData.hasDryEye,
    has_glaucoma: formData.hasGlaucoma,
    other_complaints: formData.otherComplaints || null,
    doctor_name: formData.doctorName || null,
    surgery_notes: formData.surgeryNotes || null,
    medical_acknowledgment: formData.medicalAcknowledgment,
  });

  // 5. Create agreement record
  await supabase.from("agreements").insert({
    booking_id: booking.id,
    client_id: clientId,
    filming_consent: formData.filmingConsent,
    liability_waiver_signed: formData.liabilityWaiverSigned,
    terms_accepted: formData.termsAccepted,
    signature_data: formData.signatureData,
  });

  // 6. Send confirmation email
  const formatDuration = (mins: number) => {
    const hrs = Math.floor(mins / 60);
    const m = mins % 60;
    if (hrs && m) return `${hrs} hr ${m} min`;
    if (hrs) return `${hrs} hr`;
    return `${m} min`;
  };

  const removalAdded = Boolean(formData.hasRemoval);
  const appointmentMinutes =
    service.duration_minutes + (removalAdded ? removalMinutes : 0);
  const appointmentTotal =
    Number(service.price) + (removalAdded ? removalPrice : 0);

  // The studio address is private — it is deliberately absent from the public
  // pages (the privacy policy, the site footer) and only ever reaches someone
  // after she has booked and paid a deposit. The confirmation email and text
  // are that moment: both go out once, to the person who just paid, and never
  // anywhere public. Read fresh per booking rather than baked into a template,
  // so a studio move only ever requires an edit in Settings.
  // Read once for both messages below. Anything missing comes back null and
  // is simply omitted rather than guessed at.
  const { studioAddress, ownerInbox, replyTo } = await getEmailSettings(supabase);

  try {
    await sendConfirmationEmail({
      clientName: formData.fullName,
      clientEmail: formData.email,
      serviceName: removalAdded
        ? `${service.name} + lash removal`
        : service.name,
      bookingDate: formData.bookingDate,
      timeSlot: formData.timeSlot,
      duration: formatDuration(appointmentMinutes),
      depositAmount: service.deposit_amount,
      totalPrice: appointmentTotal,
      paymentMethod: formData.paymentMethod,
      studioAddress,
      replyTo,
      // Her copy, on the client's own confirmation rather than as a separate
      // message: she sees exactly what they saw, and Bcc means nothing in
      // their copy reveals she is on it. Every appointment, new client or
      // regular, full set or refill.
      bcc: ownerRecipients(ownerInbox),
      bookingId: booking.id,
    });
  } catch (emailErr) {
    // Log but don't fail the booking if email fails
    console.error("Failed to send confirmation email:", emailErr);
  }

  // The same confirmation as a text. Best-effort on exactly the same terms as
  // the email above: the card is already charged and the booking already
  // written, so nothing here is allowed to fail the booking. Skipped silently
  // when she did not tick the box, when Twilio is not configured, or when the
  // number cannot be parsed. The consent check comes first deliberately: no
  // text is sent to anyone who did not ask for one, whatever else is true.
  if (formData.smsConsent && isSmsConfigured()) {
    const phone = toE164(formData.phone);
    if (phone) {
      try {
        await sendSms(
          phone,
          confirmationText({
            clientName: formData.fullName,
            serviceName: removalAdded
              ? `${service.name} + lash removal`
              : service.name,
            bookingDate: formData.bookingDate,
            timeSlot: formData.timeSlot,
            depositAmount: Number(service.deposit_amount),
            address: studioAddress,
          })
        );
      } catch (smsErr) {
        console.error("Failed to send confirmation text:", smsErr);
      }
    }
  }

  // 7. Put it on her Google Calendar, if she has connected one. Same
  // best-effort contract as the email above: syncBookingEvent catches its own
  // failures, because by this point the card has already been charged.
  //
  // It is given the id alone and reads the rest back itself, so the event
  // carries the deposit and the intake answers this function has just written
  // — the details that make the entry worth opening on a phone.
  await syncBookingEvent(supabase, booking.id);

  return { bookingId: booking.id, clientId };
}

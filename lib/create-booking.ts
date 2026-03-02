import { SupabaseClient } from "@supabase/supabase-js";
import { sendConfirmationEmail } from "./email";

interface BookingFormData {
  serviceId: string;
  bookingDate: string;
  timeSlot: string;
  fullName: string;
  phone: string;
  email: string;
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
}

interface CreateBookingOptions {
  supabase: SupabaseClient;
  formData: BookingFormData;
  depositPaid: boolean;
  depositAmount?: number;
  squarePaymentId?: string;
}

export async function createBooking({
  supabase,
  formData,
  depositPaid,
  depositAmount,
  squarePaymentId,
}: CreateBookingOptions) {
  // 1. Upsert client (find by email or create new)
  const { data: existingClient } = await supabase
    .from("clients")
    .select("id, visit_count")
    .eq("email", formData.email)
    .single();

  let clientId: string;

  if (existingClient) {
    clientId = existingClient.id;
    await supabase
      .from("clients")
      .update({
        full_name: formData.fullName,
        phone: formData.phone,
        visit_count: existingClient.visit_count + 1,
        last_visit_date: formData.bookingDate,
        updated_at: new Date().toISOString(),
      })
      .eq("id", clientId);
  } else {
    const { data: newClient, error: clientError } = await supabase
      .from("clients")
      .insert({
        full_name: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        visit_count: 1,
        last_visit_date: formData.bookingDate,
      })
      .select("id")
      .single();

    if (clientError || !newClient) {
      throw new Error(`Failed to create client: ${clientError?.message}`);
    }
    clientId = newClient.id;
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

  try {
    await sendConfirmationEmail({
      clientName: formData.fullName,
      clientEmail: formData.email,
      serviceName: service.name,
      bookingDate: formData.bookingDate,
      timeSlot: formData.timeSlot,
      duration: formatDuration(service.duration_minutes),
      depositAmount: service.deposit_amount,
      totalPrice: service.price,
      paymentMethod: formData.paymentMethod,
    });
  } catch (emailErr) {
    // Log but don't fail the booking if email fails
    console.error("Failed to send confirmation email:", emailErr);
  }

  return { bookingId: booking.id, clientId };
}

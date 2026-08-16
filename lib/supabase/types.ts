// Database types matching the Supabase schema

export interface Service {
  id: string;
  name: string;
  category: "full_set" | "refill" | "lift";
  price: number;
  deposit_amount: number;
  duration_minutes: number;
  description: string | null;
  /** Photo on the booking page card. Site path or full URL; null shows the tan placeholder. */
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface Availability {
  id: string;
  day_of_week: number; // 0=Sun, 6=Sat
  start_time: string;
  end_time: string;
  is_active: boolean;
  created_at: string;
}

export interface BlockedDate {
  id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
  created_at: string;
}

export interface Client {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  visit_count: number;
  last_visit_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: string;
  client_id: string;
  service_id: string;
  booking_date: string;
  time_slot: string;
  status: "confirmed" | "completed" | "cancelled" | "no_show";
  payment_method: "square" | "apple_pay" | "google_pay" | "cash";
  deposit_paid: boolean;
  deposit_amount: number | null;
  square_payment_id: string | null;
  notes: string | null;
  /** Google Calendar event for this appointment (migration 006). */
  google_event_id: string | null;
  /** Set once the 24-hour reminder has gone out (migration 007). */
  reminder_sent_at: string | null;
  /** Free text, only when the admin gave one on cancelling (migration 007). */
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface BookingWithDetails extends Booking {
  client: Client;
  service: Service;
  intake_form: IntakeForm | null;
  agreement: Agreement | null;
}

export interface IntakeForm {
  id: string;
  booking_id: string;
  client_id: string;
  has_had_extensions: boolean;
  is_special_occasion: boolean;
  occasion_details: string | null;
  has_cataracts: boolean;
  has_conjunctivitis: boolean;
  has_dry_eye: boolean;
  has_glaucoma: boolean;
  other_complaints: string | null;
  doctor_name: string | null;
  surgery_notes: string | null;
  medical_acknowledgment: boolean;
  created_at: string;
}

export interface Agreement {
  id: string;
  booking_id: string;
  client_id: string;
  filming_consent: boolean;
  liability_waiver_signed: boolean;
  terms_accepted: boolean;
  signature_data: string;
  signed_at: string;
}

export interface Setting {
  id: string;
  key: string;
  value: string;
  updated_at: string;
}

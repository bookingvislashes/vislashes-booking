import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { createBooking } from "@/lib/create-booking";

const cashBookingSchema = z.object({
  serviceId: z.string().min(1),
  bookingDate: z.string().min(1),
  timeSlot: z.string().min(1),
  fullName: z.string().min(2),
  phone: z.string().min(1),
  email: z.string().email(),
  hasHadExtensions: z.boolean(),
  isSpecialOccasion: z.boolean(),
  occasionDetails: z.string().optional(),
  hasCataracts: z.boolean(),
  hasConjunctivitis: z.boolean(),
  hasDryEye: z.boolean(),
  hasGlaucoma: z.boolean(),
  otherComplaints: z.string().optional(),
  doctorName: z.string().optional(),
  surgeryNotes: z.string().optional(),
  medicalAcknowledgment: z.boolean(),
  filmingConsent: z.boolean(),
  liabilityWaiverSigned: z.boolean(),
  termsAccepted: z.boolean(),
  signatureData: z.string().min(1),
  paymentMethod: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = cashBookingSchema.parse(body);

    const supabase = await createServiceClient();

    const result = await createBooking({
      supabase,
      formData: data,
      depositPaid: false,
    });

    return NextResponse.json({ bookingId: result.bookingId });
  } catch (error) {
    console.error("Booking error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid booking data", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create booking" },
      { status: 500 }
    );
  }
}

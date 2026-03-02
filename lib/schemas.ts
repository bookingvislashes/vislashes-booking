import { z } from "zod";

export const bookingSchema = z.object({
  // Step 1
  serviceId: z.string().min(1, "Please select a service"),

  // Step 2
  bookingDate: z.string().min(1, "Please select a date"),
  timeSlot: z.string().min(1, "Please select a time"),

  // Step 3
  fullName: z.string().min(2, "Name is required"),
  phone: z
    .string()
    .regex(
      /^\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/,
      "Enter a valid phone number"
    ),
  email: z.string().email("Enter a valid email"),

  // Step 4
  hasHadExtensions: z.boolean({ message: "Please answer this question" }),
  isSpecialOccasion: z.boolean().default(false),
  occasionDetails: z.string().optional(),

  // Step 5
  hasCataracts: z.boolean().default(false),
  hasConjunctivitis: z.boolean().default(false),
  hasDryEye: z.boolean().default(false),
  hasGlaucoma: z.boolean().default(false),
  otherComplaints: z.string().optional(),
  doctorName: z.string().optional(),
  surgeryNotes: z.string().optional(),
  medicalAcknowledgment: z
    .boolean()
    .refine((val) => val === true, "You must acknowledge"),

  // Step 6
  filmingConsent: z.boolean().default(false),
  liabilityWaiverSigned: z
    .boolean()
    .refine((val) => val === true, "Waiver signature required"),
  termsAccepted: z
    .boolean()
    .refine((val) => val === true, "You must accept terms"),
  signatureData: z.string().min(1, "Please sign above"),

  // Step 7
  paymentMethod: z.enum(["square", "apple_pay", "google_pay", "cash"]),
});

export type BookingFormData = z.infer<typeof bookingSchema>;

export const stepFields: Record<number, (keyof BookingFormData)[]> = {
  1: ["serviceId"],
  2: ["bookingDate", "timeSlot"],
  3: ["fullName", "phone", "email"],
  4: ["hasHadExtensions"],
  5: ["medicalAcknowledgment"],
  6: ["liabilityWaiverSigned", "termsAccepted", "signatureData"],
  7: ["paymentMethod"],
};

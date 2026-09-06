"use client";

import { UseFormReturn } from "react-hook-form";
import { BookingFormData } from "@/lib/schemas";
import { Input } from "@/components/ui/input";

interface CustomerFormProps {
  form: UseFormReturn<BookingFormData>;
}

export function CustomerForm({ form }: CustomerFormProps) {
  const { register, formState: { errors } } = form;

  return (
    <div>
      <h2 className="font-display text-[24px] font-bold text-dark-brown mb-1">
        Your Information
      </h2>
      <p className="font-sans text-[14px] text-charcoal mb-6">
        We&apos;ll use this to contact you about your appointment.
      </p>

      <div className="flex flex-col gap-4">
        <Input
          id="fullName"
          label="Full Name"
          placeholder="Jane Smith"
          error={errors.fullName?.message}
          {...register("fullName")}
        />
        <Input
          id="phone"
          label="Phone Number"
          type="tel"
          placeholder="(407) 555-1234"
          error={errors.phone?.message}
          {...register("phone")}
        />
        <Input
          id="email"
          label="Email Address"
          type="email"
          placeholder="jane@example.com"
          error={errors.email?.message}
          {...register("email")}
        />
      </div>

      {/* Consent, shown where the number is actually collected.
          US carriers require A2P senders to disclose at the point of capture
          what the number will be used for and how to stop — and the 10DLC
          campaign review asks for the page this appears on. It says texts only,
          names the three that get sent, and promises no marketing, because that
          is exactly what the site does. If the messages ever change, this
          has to change with them. */}
      <p className="font-sans text-[12px] text-muted leading-[1.6] mt-4">
        By booking, you agree to receive appointment texts from VIS Lashes: a
        confirmation, a reminder two days before, and one two hours before. No
        marketing, ever. Reply STOP any time to stop them — your appointment is
        unaffected. Message and data rates may apply.
      </p>
    </div>
  );
}

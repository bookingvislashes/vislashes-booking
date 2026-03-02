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
      <h2 className="font-['Playfair_Display',Georgia,serif] text-[24px] font-bold text-dark-brown mb-1">
        Your Information
      </h2>
      <p className="font-['DM_Sans',system-ui,sans-serif] text-[14px] text-charcoal mb-6">
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
    </div>
  );
}

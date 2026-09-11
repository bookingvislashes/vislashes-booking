"use client";

import Link from "next/link";
import { UseFormReturn } from "react-hook-form";
import { BookingFormData } from "@/lib/schemas";
import { CONSENT_DISCLOSURE } from "@/lib/legal";
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
          names every message that gets sent, and promises no marketing, because
          that is exactly what the site does.

          The sentence itself lives in lib/legal.ts, because /sms quotes it word
          for word as the disclosure shown at the point of capture. Written out
          twice it would eventually be true in only one of them, and the page
          would be quoting a promise this form no longer makes. Change it there
          and both move together — and if the messages change, it has to. */}
      <p className="font-sans text-[12px] text-muted leading-[1.6] mt-4">
        {CONSENT_DISCLOSURE} See our{" "}
        <Link href="/terms" className="underline">
          Terms
        </Link>
        ,{" "}
        <Link href="/privacy" className="underline">
          Privacy Policy
        </Link>{" "}
        and{" "}
        <Link href="/sms" className="underline">
          Text Message Policy
        </Link>
        .
      </p>
    </div>
  );
}

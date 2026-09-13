"use client";

import Link from "next/link";
import { UseFormReturn } from "react-hook-form";
import { BookingFormData } from "@/lib/schemas";
import { CONSENT_DISCLOSURE, CONSENT_LABEL } from "@/lib/legal";
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

          This is a separate, optional, unticked checkbox rather than a line of
          small print, because Twilio's A2P guide rejects a campaign whose
          consent is a condition of the purchase: "Consent controls (checkboxes,
          toggles) must be blank or off by default", and a booking must be
          completable without it. It is deliberately absent from stepFields, so
          nothing about it can block the step.

          defaultChecked is never set, and nothing writes to it on mount — the
          box is off until she ticks it herself. The label and the wording
          below live in lib/legal.ts because /sms quotes both word for word as
          the disclosure shown at the point of capture; written out twice they
          would eventually disagree, and the page would be quoting a promise
          this form no longer makes. */}
      <div className="mt-4 flex gap-3">
        <input
          id="smsConsent"
          type="checkbox"
          className="mt-[3px] h-4 w-4 flex-none accent-deep-brown"
          {...register("smsConsent")}
        />
        <div>
          <label
            htmlFor="smsConsent"
            className="font-sans text-[14px] text-charcoal"
          >
            {CONSENT_LABEL}
          </label>
          <p className="font-sans text-[12px] text-muted leading-[1.6] mt-1">
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
      </div>
    </div>
  );
}

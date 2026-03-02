"use client";

import { UseFormReturn } from "react-hook-form";
import { BookingFormData } from "@/lib/schemas";

interface MedicalFormProps {
  form: UseFormReturn<BookingFormData>;
}

export function MedicalForm({ form }: MedicalFormProps) {
  const { register, formState: { errors } } = form;

  return (
    <div>
      <h2 className="font-['Playfair_Display',Georgia,serif] text-[24px] font-bold text-dark-brown mb-1">
        Medical Health Form
      </h2>
      <p className="font-['DM_Sans',system-ui,sans-serif] text-[14px] text-charcoal mb-6">
        Please check any conditions that apply to you.
      </p>

      <div className="flex flex-col gap-4">
        {/* Conditions checkboxes */}
        <div className="flex flex-col gap-3">
          {[
            { name: "hasCataracts" as const, label: "Cataracts" },
            { name: "hasConjunctivitis" as const, label: "Conjunctivitis" },
            { name: "hasDryEye" as const, label: "Dry Eye Syndrome" },
            { name: "hasGlaucoma" as const, label: "Glaucoma" },
          ].map((condition) => (
            <label
              key={condition.name}
              className="flex items-center gap-3 cursor-pointer"
            >
              <input
                type="checkbox"
                className="accent-deep-brown w-4 h-4"
                {...register(condition.name)}
              />
              <span className="font-['DM_Sans',system-ui,sans-serif] text-[14px] text-charcoal">
                {condition.label}
              </span>
            </label>
          ))}
        </div>

        {/* Text fields */}
        <div>
          <label
            htmlFor="otherComplaints"
            className="text-dark-brown text-[12px] font-semibold font-['DM_Sans',system-ui,sans-serif] block mb-1"
          >
            Any other complaints?
          </label>
          <textarea
            id="otherComplaints"
            rows={2}
            className="w-full bg-white border border-light-tan rounded-[4px] px-3 py-2.5 text-[14px] text-charcoal font-['DM_Sans',system-ui,sans-serif] placeholder:text-muted focus:outline-none focus:border-deep-brown transition-colors resize-none"
            placeholder="Optional"
            {...register("otherComplaints")}
          />
        </div>

        <div>
          <label
            htmlFor="doctorName"
            className="text-dark-brown text-[12px] font-semibold font-['DM_Sans',system-ui,sans-serif] block mb-1"
          >
            Name of Doctor
          </label>
          <input
            id="doctorName"
            className="w-full bg-white border border-light-tan rounded-[4px] px-3 py-2.5 text-[14px] text-charcoal font-['DM_Sans',system-ui,sans-serif] placeholder:text-muted focus:outline-none focus:border-deep-brown transition-colors"
            placeholder="Optional"
            {...register("doctorName")}
          />
        </div>

        <div>
          <label
            htmlFor="surgeryNotes"
            className="text-dark-brown text-[12px] font-semibold font-['DM_Sans',system-ui,sans-serif] block mb-1"
          >
            Surgery notes
          </label>
          <textarea
            id="surgeryNotes"
            rows={2}
            className="w-full bg-white border border-light-tan rounded-[4px] px-3 py-2.5 text-[14px] text-charcoal font-['DM_Sans',system-ui,sans-serif] placeholder:text-muted focus:outline-none focus:border-deep-brown transition-colors resize-none"
            placeholder="Optional"
            {...register("surgeryNotes")}
          />
        </div>

        {/* Acknowledgment */}
        <div className="border-t border-light-tan pt-4 mt-2">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="accent-deep-brown w-4 h-4 mt-0.5"
              {...register("medicalAcknowledgment")}
            />
            <span className="font-['DM_Sans',system-ui,sans-serif] text-[13px] text-charcoal">
              I have read and understood the above information and confirm that it is accurate.
            </span>
          </label>
          {errors.medicalAcknowledgment && (
            <p className="text-danger text-[12px] mt-1 font-['DM_Sans',system-ui,sans-serif]">
              {errors.medicalAcknowledgment.message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { UseFormReturn } from "react-hook-form";
import { BookingFormData } from "@/lib/schemas";

interface IntakeQuestionsProps {
  form: UseFormReturn<BookingFormData>;
}

export function IntakeQuestions({ form }: IntakeQuestionsProps) {
  const { register, watch, formState: { errors } } = form;
  const hasHadExtensions = watch("hasHadExtensions");
  const isSpecialOccasion = watch("isSpecialOccasion");

  return (
    <div>
      <h2 className="font-display text-[24px] font-bold text-dark-brown mb-1">
        Pre-Appointment Questions
      </h2>
      <p className="font-sans text-[14px] text-charcoal mb-6">
        Help us prepare for your visit.
      </p>

      <div className="flex flex-col gap-6">
        {/* Extensions question */}
        <fieldset>
          <legend className="text-dark-brown text-[13px] font-semibold font-sans mb-3">
            Have you ever had eyelash extensions before?
          </legend>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="hasHadExtensions"
                value="true"
                className="accent-deep-brown w-4 h-4"
                onChange={() => form.setValue("hasHadExtensions", true, { shouldValidate: true })}
                checked={hasHadExtensions === true}
              />
              <span className="font-sans text-[14px] text-charcoal">
                Yes
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="hasHadExtensions"
                value="false"
                className="accent-deep-brown w-4 h-4"
                onChange={() => form.setValue("hasHadExtensions", false, { shouldValidate: true })}
                checked={hasHadExtensions === false}
              />
              <span className="font-sans text-[14px] text-charcoal">
                No
              </span>
            </label>
          </div>
          {errors.hasHadExtensions && (
            <p className="text-danger text-[12px] mt-1 font-sans">
              Please answer this question
            </p>
          )}
        </fieldset>

        {/* Special occasion question */}
        <fieldset>
          <legend className="text-dark-brown text-[13px] font-semibold font-sans mb-3">
            Is this for a special occasion?
          </legend>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="true"
                className="accent-deep-brown w-4 h-4"
                onChange={() => form.setValue("isSpecialOccasion", true)}
                checked={isSpecialOccasion === true}
              />
              <span className="font-sans text-[14px] text-charcoal">
                Yes
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="false"
                className="accent-deep-brown w-4 h-4"
                onChange={() => form.setValue("isSpecialOccasion", false)}
                checked={isSpecialOccasion === false}
              />
              <span className="font-sans text-[14px] text-charcoal">
                No
              </span>
            </label>
          </div>
        </fieldset>

        {isSpecialOccasion && (
          <div>
            <label
              htmlFor="occasionDetails"
              className="text-dark-brown text-[12px] font-semibold font-sans block mb-1"
            >
              What occasion?
            </label>
            <input
              id="occasionDetails"
              className="w-full bg-white border border-light-tan rounded-control px-3 py-2.5 text-[14px] text-charcoal font-sans placeholder:text-muted focus:outline-none focus:border-deep-brown transition-colors"
              placeholder="e.g., Wedding, Birthday, Prom"
              {...register("occasionDetails")}
            />
          </div>
        )}
      </div>
    </div>
  );
}

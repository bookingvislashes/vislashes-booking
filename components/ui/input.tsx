"use client";

import { InputHTMLAttributes, forwardRef, useId } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", id, ...props }, ref) => {
    // `id` is optional, so `htmlFor={id}` used to resolve to undefined whenever
    // a caller passed a label without one — a field that looks labelled but has
    // no programmatic association at all. Falling back to a generated id keeps
    // the pair intact however it is called.
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={inputId}
            className="text-dark-brown text-[12px] font-semibold font-sans"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          // 16px on small screens is not a style choice: iOS Safari force-zooms
          // the page on focus for anything smaller and never zooms back out,
          // leaving the operator stranded mid-form. Drops to the design's 14px
          // from md up, where no phone keyboard is involved.
          className={`w-full h-control box-border bg-white border border-light-tan rounded-control px-3 text-[16px] md:text-[14px] text-charcoal font-sans placeholder:text-muted focus:border-deep-brown transition-colors ${error ? "border-danger" : ""} ${className}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          {...props}
        />
        {error && (
          // Announced on appearance — aria-invalid alone tells a screen reader
          // the field is wrong but never why.
          <p id={errorId} role="alert" className="text-danger text-[12px] font-sans">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

"use client";

import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={id}
            className="text-dark-brown text-[12px] font-semibold font-sans"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={`w-full h-control box-border bg-white border border-light-tan rounded-control px-3 text-[14px] text-charcoal font-sans placeholder:text-muted focus:border-deep-brown transition-colors ${error ? "border-danger" : ""} ${className}`}
          aria-invalid={error ? true : undefined}
          {...props}
        />
        {error && (
          <p className="text-danger text-[12px] font-sans">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

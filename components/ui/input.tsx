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
            className="text-dark-brown text-[12px] font-semibold font-['DM_Sans',system-ui,sans-serif]"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={`w-full bg-white border border-light-tan rounded-[4px] px-3 py-2.5 text-[14px] text-charcoal font-['DM_Sans',system-ui,sans-serif] placeholder:text-muted focus:outline-none focus:border-deep-brown focus:shadow-[0_0_0_1px_rgba(139,111,71,0.2)] transition-colors ${error ? "border-danger" : ""} ${className}`}
          {...props}
        />
        {error && (
          <p className="text-danger text-[12px] font-['DM_Sans',system-ui,sans-serif]">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

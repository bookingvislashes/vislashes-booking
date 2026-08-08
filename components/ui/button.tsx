"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className = "", children, disabled, ...props }, ref) => {
    // Every variant carries a 2px border — transparent on the filled ones — so
    // a solid and an outlined button of the same size are always the same
    // height. Heights are explicit rather than derived from padding for the
    // same reason: a button can never disagree with the input beside it.
    const base =
      "inline-flex items-center justify-center box-border font-sans font-semibold " +
      "rounded-control border-2 transition-colors duration-150 cursor-pointer " +
      "disabled:opacity-50 disabled:cursor-not-allowed";

    const variants = {
      primary: "bg-brand-brown text-white border-transparent hover:bg-text-brown",
      secondary:
        "bg-transparent border-brand-brown text-text-brown hover:bg-brand-brown hover:text-white",
      danger: "bg-danger text-white border-transparent hover:bg-danger-dark",
      ghost: "bg-transparent border-transparent text-text-brown hover:bg-light-tan",
    };

    // Heights come from the shared control scale in globals.css, so a button,
    // an input and a hand-rolled control can never drift apart.
    const sizes = {
      sm: "h-control-sm text-[12px] px-4",
      md: "h-control text-[14px] px-7",
      lg: "h-control-lg text-[15px] px-8",
    };

    return (
      <button
        ref={ref}
        className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

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
    // active: gives a press response on touch, where :hover never fires. The
    // global prefers-reduced-motion rule already neutralises the transform.
    const base =
      "inline-flex items-center justify-center box-border font-sans font-semibold " +
      "rounded-control border-2 transition-[color,background-color,border-color,transform] duration-150 cursor-pointer " +
      "active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed";

    const variants = {
      // brand-brown on white is 3.45:1 — under the 4.5:1 AA floor for the 14px
      // and 12px labels these carry, on the default variant. text-brown is
      // 5.77:1 and deep-brown 4.71:1, so both states now pass. The two colours
      // simply swap roles; primary previously darkened on hover into the very
      // colour that was already legible.
      primary: "bg-text-brown text-white border-transparent hover:bg-deep-brown",
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

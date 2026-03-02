"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className = "", children, disabled, ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center font-['DM_Sans',system-ui,sans-serif] font-semibold rounded-[6px] transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";

    const variants = {
      primary: "bg-deep-brown text-white hover:bg-dark-brown",
      secondary:
        "bg-transparent border-[1.5px] border-deep-brown text-deep-brown hover:bg-light-tan",
      danger: "bg-danger text-white hover:bg-red-700",
      ghost: "bg-transparent text-deep-brown hover:bg-light-tan",
    };

    const sizes = {
      sm: "text-[12px] px-4 py-2",
      md: "text-[14px] px-7 py-3",
      lg: "text-[14px] px-8 py-3.5",
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

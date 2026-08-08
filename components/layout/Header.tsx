"use client";

import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/lib/cart-context";
import { useRef, useEffect } from "react";

export function Header() {
  const { items, totalItems, isOpen, setIsOpen, removeItem, updateQuantity } = useCart();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, setIsOpen]);

  return (
    <header className="w-full px-6 sm:px-12 lg:px-[120px] pt-[27px] pb-[33px] flex items-center justify-between max-w-[1440px] mx-auto">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-1 shrink-0">
        <Image
          src="/images/logo-icon.svg"
          alt=""
          width={76}
          height={34}
          className="h-[34px] w-auto"
        />
        <Image
          src="/images/logo-text.svg"
          alt="VIS Lashes"
          width={138}
          height={32}
          className="h-[32px] w-auto"
        />
      </Link>

      {/* Navigation Links */}
      <nav className="hidden md:flex items-center gap-[26px]">
        {[
          { label: "Home", href: "/" },
          { label: "Lash Products", href: "#products" },
          { label: "Book Appointment", href: "/book" },
          { label: "Contact", href: "#contact" },
        ].map((link) => (
          <Link
            key={link.label}
            href={link.href}
            className="font-['Inter',sans-serif] font-medium text-[16px] text-nav-brown leading-[15px] tracking-[0.25px] hover:text-brand-brown transition-colors"
          >
            {link.label}
          </Link>
        ))}
      </nav>

      {/* Icons */}
      <div className="flex items-center gap-[28px] shrink-0">
        {/* Search Icon */}
        <button aria-label="Search" className="text-nav-brown hover:text-brand-brown transition-colors">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>

        {/* Cart Icon */}
        <div className="relative" ref={dropdownRef}>
          <button
            aria-label="Cart"
            className="text-nav-brown hover:text-brand-brown transition-colors relative"
            onClick={() => setIsOpen(!isOpen)}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 01-8 0" />
            </svg>
            {totalItems > 0 && (
              <span className="absolute -top-2 -right-2 bg-brand-brown text-white text-[10px] font-semibold w-[18px] h-[18px] rounded-full flex items-center justify-center">
                {totalItems}
              </span>
            )}
          </button>

          {/* Cart Dropdown */}
          {isOpen && (
            <div className="absolute right-0 top-[calc(100%+12px)] w-[340px] bg-white rounded-[8px] shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-light-tan z-50 overflow-hidden">
              {/* Header */}
              <div className="px-5 py-4 border-b border-light-tan flex items-center justify-between">
                <h3 className="font-['Playfair_Display',Georgia,serif] text-[18px] text-dark-brown">
                  Your Cart
                </h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-muted hover:text-charcoal transition-colors"
                  aria-label="Close cart"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Items */}
              {items.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <p className="font-['DM_Sans',sans-serif] text-[14px] text-muted">
                    Your cart is empty
                  </p>
                </div>
              ) : (
                <>
                  <div className="max-h-[280px] overflow-y-auto">
                    {items.map((item) => (
                      <div
                        key={item.name}
                        className="px-5 py-4 flex items-center gap-4 border-b border-light-tan/50 last:border-0"
                      >
                        {/* Thumbnail */}
                        <div className="w-[56px] h-[56px] bg-card-beige rounded-[4px] relative overflow-hidden shrink-0">
                          <Image
                            src={item.image}
                            alt={item.name}
                            fill
                            className="object-cover"
                            sizes="56px"
                          />
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-['Playfair_Display',Georgia,serif] text-[15px] text-dark-brown truncate">
                            {item.name}
                          </p>
                          <p className="font-['DM_Sans',sans-serif] text-[13px] text-text-brown">
                            {item.price}
                          </p>
                        </div>
                        {/* Quantity Controls */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => updateQuantity(item.name, item.quantity - 1)}
                            className="w-[24px] h-[24px] rounded-full border border-light-tan flex items-center justify-center text-[14px] text-nav-brown hover:border-brand-brown hover:text-brand-brown transition-colors"
                          >
                            −
                          </button>
                          <span className="font-['DM_Sans',sans-serif] text-[13px] text-charcoal w-[16px] text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.name, item.quantity + 1)}
                            className="w-[24px] h-[24px] rounded-full border border-light-tan flex items-center justify-center text-[14px] text-nav-brown hover:border-brand-brown hover:text-brand-brown transition-colors"
                          >
                            +
                          </button>
                        </div>
                        {/* Remove */}
                        <button
                          onClick={() => removeItem(item.name)}
                          className="text-muted hover:text-danger transition-colors shrink-0"
                          aria-label={`Remove ${item.name}`}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Total + Checkout */}
                  <div className="px-5 py-4 border-t border-light-tan bg-cream/50">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-['DM_Sans',sans-serif] text-[14px] text-charcoal font-semibold">
                        Total
                      </span>
                      <span className="font-['DM_Sans',sans-serif] text-[16px] text-dark-brown font-semibold">
                        ${items.reduce((sum, item) => {
                          const price = parseFloat(item.price.replace("$", ""));
                          return sum + price * item.quantity;
                        }, 0).toFixed(2)}
                      </span>
                    </div>
                    <button className="w-full bg-brand-brown text-white font-['Montserrat',sans-serif] font-semibold text-[14px] py-3 rounded-[3px] hover:bg-text-brown transition-colors">
                      Checkout
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

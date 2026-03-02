"use client";

import { ReactNode, useEffect } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-lg shadow-lg max-w-lg w-full max-h-[85vh] overflow-y-auto p-6">
        {title && (
          <h3 className="text-[18px] font-bold text-dark-brown mb-4 font-['Playfair_Display',Georgia,serif]">
            {title}
          </h3>
        )}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted hover:text-charcoal text-xl leading-none cursor-pointer"
          aria-label="Close"
        >
          &times;
        </button>
        {children}
      </div>
    </div>
  );
}

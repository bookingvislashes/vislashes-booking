"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Service {
  id: string;
  name: string;
  category: string;
  price: number;
  depositAmount: number;
  durationMinutes: number;
  isActive: boolean;
}

const demoServices: Service[] = [
  { id: "1", name: "Natural Glam", category: "full_set", price: 50, depositAmount: 10, durationMinutes: 110, isActive: true },
  { id: "2", name: "Premium Wispy Glam", category: "full_set", price: 55, depositAmount: 10, durationMinutes: 110, isActive: true },
  { id: "3", name: "Premium Wispy Glam (Custom)", category: "full_set", price: 55, depositAmount: 10, durationMinutes: 110, isActive: true },
  { id: "4", name: "Natural Glam Refill", category: "refill", price: 25, depositAmount: 10, durationMinutes: 60, isActive: true },
  { id: "5", name: "Premium Wispy Glam Refill", category: "refill", price: 30, depositAmount: 10, durationMinutes: 60, isActive: true },
  { id: "6", name: "Premium Wispy Glam Refill (Custom)", category: "refill", price: 30, depositAmount: 10, durationMinutes: 60, isActive: true },
];

export default function ServicesPage() {
  const [services, setServices] = useState(demoServices);

  const toggleActive = (id: string) => {
    setServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isActive: !s.isActive } : s))
    );
  };

  const formatDuration = (mins: number) => {
    const hrs = Math.floor(mins / 60);
    const m = mins % 60;
    if (hrs && m) return `${hrs}h ${m}m`;
    if (hrs) return `${hrs}h`;
    return `${m}m`;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-[28px] font-bold text-dark-brown">
          Services
        </h1>
        <Button size="sm">Add Service</Button>
      </div>

      <div className="bg-white rounded-surface shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
        {services.map((service) => (
          <div
            key={service.id}
            className="flex items-center justify-between px-5 py-4 border-b border-light-tan last:border-b-0"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-sans text-[14px] font-semibold text-dark-brown">
                  {service.name}
                </p>
                {!service.isActive && (
                  <span className="text-[10px] font-semibold font-sans text-muted bg-muted/15 px-2 py-0.5 rounded-full">
                    Inactive
                  </span>
                )}
              </div>
              <p className="font-sans text-[12px] text-muted">
                {service.category === "full_set" ? "Full Set" : "Refill"} &middot;{" "}
                {formatDuration(service.durationMinutes)} &middot; ${service.depositAmount} deposit
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-sans text-[16px] font-semibold text-deep-brown">
                ${service.price.toFixed(2)}
              </span>
              <button
                onClick={() => toggleActive(service.id)}
                className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${
                  service.isActive ? "bg-deep-brown" : "bg-muted/30"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    service.isActive ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

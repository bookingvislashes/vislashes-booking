"use client";

import { UseFormReturn } from "react-hook-form";
import { BookingFormData } from "@/lib/schemas";

interface Service {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price: number;
  duration_minutes: number;
  image_url: string | null;
}

interface ServiceSelectorProps {
  form: UseFormReturn<BookingFormData>;
  services: Service[];
}

export function ServiceSelector({ form, services }: ServiceSelectorProps) {
  const selectedId = form.watch("serviceId");
  const fullSets = services.filter((s) => s.category === "full_set");
  const refills = services.filter((s) => s.category === "refill");
  // A lift is a lash treatment with no extensions applied — a different kind
  // of appointment from a set, not a lighter version of one — so it gets its
  // own section rather than being folded into Full Sets.
  const lifts = services.filter((s) => s.category === "lift");

  const formatDuration = (mins: number) => {
    const hrs = Math.floor(mins / 60);
    const m = mins % 60;
    if (hrs && m) return `${hrs} hr ${m} min`;
    if (hrs) return `${hrs} hr`;
    return `${m} min`;
  };

  const ServiceCard = ({ service }: { service: Service }) => {
    const isSelected = selectedId === service.id;
    return (
      <button
        type="button"
        aria-pressed={isSelected}
        onClick={() => form.setValue("serviceId", service.id, { shouldValidate: true })}
        // `flex flex-col` + `mt-auto` on the price row. The grid already
        // stretched the cards to equal height, but the price and duration
        // stopped wherever the description ended, so across a row they sat at
        // three different heights. Now they pin to the bottom edge.
        className={`flex flex-col h-full text-left bg-white rounded-surface p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] border-2 transition-[border-color,box-shadow] duration-200 motion-reduce:transition-none ${
          isSelected
            ? "border-deep-brown shadow-[0_2px_8px_rgba(139,111,71,0.2)]"
            : "border-transparent hover:border-light-tan"
        }`}
      >
        <div className="w-full h-24 bg-light-tan rounded-control mb-3" />
        <h4 className="font-display text-[15px] font-bold text-dark-brown mb-1">
          {service.name}
        </h4>
        {service.description && (
          <p className="font-sans text-[12px] text-muted mb-3 line-clamp-2">
            {service.description}
          </p>
        )}
        <div className="flex items-center justify-between mt-auto pt-1">
          <span className="font-sans text-[15px] font-semibold text-deep-brown">
            ${service.price.toFixed(2)}
          </span>
          <span className="font-sans text-[11px] text-muted">
            {formatDuration(service.duration_minutes)}
          </span>
        </div>
      </button>
    );
  };

  return (
    <div>
      <h2 className="font-display text-[24px] font-bold text-dark-brown mb-1">
        Select Your Lash Set
      </h2>
      <p className="font-sans text-[14px] text-charcoal mb-6">
        Choose the service you&apos;d like to book.
      </p>

      {fullSets.length > 0 && (
        <>
          <p className="font-sans text-[11px] font-semibold text-muted uppercase tracking-wider mb-3">
            Full Sets
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            {fullSets.map((s) => (
              <ServiceCard key={s.id} service={s} />
            ))}
          </div>
        </>
      )}

      {refills.length > 0 && (
        <>
          <p className="font-sans text-[11px] font-semibold text-muted uppercase tracking-wider mb-3">
            Refills
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            {refills.map((s) => (
              <ServiceCard key={s.id} service={s} />
            ))}
          </div>
        </>
      )}

      {lifts.length > 0 && (
        <>
          <p className="font-sans text-[11px] font-semibold text-muted uppercase tracking-wider mb-3">
            Lash Lifts
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {lifts.map((s) => (
              <ServiceCard key={s.id} service={s} />
            ))}
          </div>
        </>
      )}

      {form.formState.errors.serviceId && (
        <p className="text-danger text-[12px] mt-3 font-sans">
          {form.formState.errors.serviceId.message}
        </p>
      )}
    </div>
  );
}

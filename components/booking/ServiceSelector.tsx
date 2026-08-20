"use client";

import { useState } from "react";
import Image from "next/image";
import { UseFormReturn } from "react-hook-form";
import { BookingFormData } from "@/lib/schemas";

/**
 * A service photo, from either a path inside the site or somewhere else.
 *
 * next/image optimises and serves a right-sized rendition, but it refuses any
 * host that is not listed in next.config.ts and throws rather than degrading.
 * Since this value is typed by hand in the admin, an address on some other
 * host is a realistic thing to paste — so those fall back to a plain img,
 * which shows the picture instead of breaking the booking page.
 */
function ServicePhoto({ src, focusY }: { src: string; focusY: number }) {
  // The card is a short letterbox and the photos are full portraits, so a
  // centre crop lands on a nose. Each service is nudged onto the lashes in
  // the admin, which is the only part a customer is judging.
  const objectPosition = `50% ${focusY}%`;
  const isLocal = src.startsWith("/");
  // Photos uploaded through the admin live on Supabase Storage, which is
  // allow-listed in next.config.ts — so they can be optimised rather than
  // dropped to the unoptimised fallback below.
  const supabaseHost = (() => {
    try {
      const raw = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
      return raw ? new URL(raw).hostname : "";
    } catch {
      return "";
    }
  })();
  const isOptimisable =
    isLocal || (supabaseHost !== "" && src.includes(supabaseHost));

  if (!isOptimisable) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={src}
        alt=""
        loading="eager"
        className="absolute inset-0 w-full h-full object-cover"
        style={{ objectPosition }}
      />
    );
  }

  return (
    <Image
      src={src}
      alt=""
      fill
      className="object-cover"
      style={{ objectPosition }}
      // The card is at most ~340px wide, and three sit side by side on desktop.
      sizes="(max-width: 640px) 100vw, 340px"
      quality={85}
      loading="eager"
    />
  );
}

interface Service {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price: number;
  duration_minutes: number;
  image_url: string | null;
  image_focus_y?: number;
}

interface ServiceSelectorProps {
  form: UseFormReturn<BookingFormData>;
  services: Service[];
  removalPrice: number;
  removalMinutes: number;
}

export function ServiceSelector({
  form,
  services,
  removalPrice,
  removalMinutes,
}: ServiceSelectorProps) {
  const selectedId = form.watch("serviceId");
  const hasRemoval = form.watch("hasRemoval");

  // Refills stay locked until someone identifies themselves as a returning
  // client. Session state only — this is a nudge to the right service, not a
  // security boundary, and the booking itself is validated server-side.
  const [refillsUnlocked, setRefillsUnlocked] = useState(false);
  const [showRefillNote, setShowRefillNote] = useState(false);
  const [contact, setContact] = useState("");
  const [checking, setChecking] = useState(false);
  const [notFound, setNotFound] = useState(false);

  // A lash lift is the only service in its category, and a heading over one
  // card reads like a section that failed to load. It sits with the sets, the
  // way the salon's own Acuity page has always listed it.
  const bookableNow = services.filter(
    (s) => s.category === "full_set" || s.category === "lift"
  );
  const refills = services.filter((s) => s.category === "refill");

  const selected = services.find((s) => s.id === selectedId);
  // Offered on a set or a lift, not on a refill: a refill is work on lashes
  // she applied herself, so there is nothing of anyone else's to take off.
  const removalOffered =
    selected && (selected.category === "full_set" || selected.category === "lift");

  const formatDuration = (mins: number) => {
    const hrs = Math.floor(mins / 60);
    const m = mins % 60;
    if (hrs && m) return `${hrs} hr ${m} min`;
    if (hrs) return `${hrs} hr`;
    return `${m} min`;
  };

  const checkReturning = async () => {
    if (!contact.trim()) return;
    setChecking(true);
    setNotFound(false);
    try {
      const res = await fetch("/api/clients/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact: contact.trim() }),
      });
      const data = await res.json();
      if (data.known) {
        setRefillsUnlocked(true);
        setShowRefillNote(false);
      } else {
        setNotFound(true);
      }
    } catch {
      setNotFound(true);
    } finally {
      setChecking(false);
    }
  };

  const ServiceCard = ({
    service,
    locked = false,
  }: {
    service: Service;
    locked?: boolean;
  }) => {
    const isSelected = selectedId === service.id;
    return (
      <button
        type="button"
        aria-pressed={isSelected}
        onClick={() => {
          if (locked) {
            setShowRefillNote(true);
            return;
          }
          form.setValue("serviceId", service.id, { shouldValidate: true });
        }}
        className={`relative flex flex-col h-full text-left bg-white rounded-surface p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] border-2 transition-[border-color,box-shadow,opacity] duration-200 motion-reduce:transition-none ${
          locked
            ? "border-transparent opacity-60"
            : isSelected
              ? "border-deep-brown shadow-[0_2px_8px_rgba(139,111,71,0.2)]"
              : "border-transparent hover:border-light-tan"
        }`}
      >
        {/* The tan block is the fallback, not the design — a service with no
            photo set still gets a card of the right shape rather than one that
            collapses. Per the project's rule on missing values: render nothing
            rather than a stand-in that looks like real content. */}
        <div className="relative w-full h-24 bg-light-tan rounded-control mb-3 overflow-hidden">
          {service.image_url && (
            <ServicePhoto
              src={service.image_url}
              focusY={service.image_focus_y ?? 50}
            />
          )}
        </div>
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

      {bookableNow.length > 0 && (
        <>
          <p className="font-sans text-[11px] font-semibold text-muted uppercase tracking-wider mb-3">
            Full Sets
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            {bookableNow.map((s) => (
              <ServiceCard key={s.id} service={s} />
            ))}
          </div>
        </>
      )}

      {/* Lash removal. Sits directly under the sets because it is a decision
          about the appointment just chosen, not a separate booking. */}
      {removalOffered && (
        <button
          type="button"
          onClick={() => form.setValue("hasRemoval", !hasRemoval)}
          aria-pressed={hasRemoval}
          className={`w-full text-left flex items-start gap-3 bg-white rounded-surface p-4 mb-6 border-2 transition-colors ${
            hasRemoval ? "border-deep-brown" : "border-light-tan"
          }`}
        >
          <span
            aria-hidden="true"
            className={`mt-0.5 w-5 h-5 shrink-0 rounded-[6px] border-2 flex items-center justify-center transition-colors ${
              hasRemoval
                ? "bg-deep-brown border-deep-brown"
                : "bg-white border-light-tan"
            }`}
          >
            {hasRemoval && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            )}
          </span>
          <span>
            <span className="block font-sans text-[14px] font-semibold text-dark-brown">
              Add a lash removal — ${removalPrice.toFixed(2)}
            </span>
            <span className="block font-sans text-[12px] text-muted mt-0.5">
              Wearing extensions from somewhere else? I&apos;ll take them off
              first. Adds {formatDuration(removalMinutes)} to your appointment.
            </span>
          </span>
        </button>
      )}

      {refills.length > 0 && (
        <>
          <div className="flex items-baseline gap-2 mb-3 flex-wrap">
            <p className="font-sans text-[11px] font-semibold text-muted uppercase tracking-wider">
              Refills
            </p>
            {!refillsUnlocked && (
              <span className="font-sans text-[11px] text-muted">
                — returning VIS Lashes clients
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-2">
            {refills.map((s) => (
              <ServiceCard key={s.id} service={s} locked={!refillsUnlocked} />
            ))}
          </div>
          {!refillsUnlocked && (
            <button
              type="button"
              onClick={() => setShowRefillNote(true)}
              className="font-sans text-[13px] text-deep-brown font-semibold underline mb-6"
            >
              Why can&apos;t I pick a refill?
            </button>
          )}
        </>
      )}

      {/* The explainer. Deliberately not an error: someone who lands here is a
          new client holding money, and the answer to "you can't book this" has
          to be "here is what to book instead". */}
      {showRefillNote && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setShowRefillNote(false)}
            className="absolute inset-0 bg-dark-brown/40"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="About refills"
            className="relative bg-white rounded-t-surface sm:rounded-surface w-full sm:max-w-md p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-6"
          >
            <h3 className="font-display text-[20px] font-bold text-dark-brown mb-2">
              Refills are for my own work
            </h3>
            <p className="font-sans text-[15px] text-charcoal leading-[1.55] mb-3">
              I only refill lashes I applied myself — I can&apos;t vouch for
              what&apos;s underneath someone else&apos;s work, and a refill over
              it doesn&apos;t hold.
            </p>
            <p className="font-sans text-[15px] text-charcoal leading-[1.55] mb-5">
              New to me? Book a full set instead. If you&apos;re wearing
              extensions right now, add a removal and I&apos;ll take them off
              first — same appointment.
            </p>

            <button
              type="button"
              onClick={() => setShowRefillNote(false)}
              className="w-full h-control box-border inline-flex items-center justify-center rounded-control bg-text-brown text-white font-sans font-semibold text-[15px] mb-4"
            >
              Book a full set
            </button>

            <div className="border-t border-light-tan pt-4">
              <p className="font-sans text-[13px] font-semibold text-dark-brown mb-2">
                Booked with me before?
              </p>
              {/* Phone leads because it is what the salon actually holds:
                  157 of her 159 clients have one, against 112 with an email,
                  and some of those were filled in with her own address. */}
              <p className="font-sans text-[12px] text-muted mb-2">
                Enter the phone number you booked with and I&apos;ll unlock
                refills. Email works too.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="tel"
                  autoComplete="tel"
                  value={contact}
                  onChange={(e) => {
                    setContact(e.target.value);
                    setNotFound(false);
                  }}
                  placeholder="Phone number"
                  className="flex-1 min-w-0 h-control box-border px-3 rounded-control border border-light-tan bg-white font-sans text-[16px] text-charcoal placeholder:text-muted focus:border-deep-brown transition-colors"
                />
                <button
                  type="button"
                  onClick={checkReturning}
                  disabled={checking || !contact.trim()}
                  className="h-control box-border px-4 shrink-0 rounded-control border-2 border-brand-brown text-text-brown font-sans font-semibold text-[14px] disabled:opacity-50"
                >
                  {checking ? "..." : "Check"}
                </button>
              </div>
              {notFound && (
                <p role="alert" className="font-sans text-[12px] text-danger mt-2">
                  I couldn&apos;t find that. Try the email you booked with
                  instead — or book a full set and we&apos;ll sort it out at
                  your appointment.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {form.formState.errors.serviceId && (
        <p className="text-danger text-[12px] mt-3 font-sans">
          {form.formState.errors.serviceId.message}
        </p>
      )}
    </div>
  );
}

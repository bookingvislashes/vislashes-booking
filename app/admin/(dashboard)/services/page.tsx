"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { createClient } from "@/lib/supabase/client";
import type { Service } from "@/lib/supabase/types";
import { ServicePhotoField } from "@/components/admin/ServicePhotoField";

type Draft = {
  id?: string;
  name: string;
  category: "full_set" | "refill" | "lift";
  price: string;
  deposit_amount: string;
  duration_minutes: string;
  description: string;
  image_url: string | null;
  image_focus_y: number;
};

const CATEGORY_LABELS: Record<Draft["category"], string> = {
  full_set: "Full Set",
  refill: "Refill",
  lift: "Lash Lift",
};

const emptyDraft: Draft = {
  name: "",
  category: "full_set",
  price: "",
  deposit_amount: "",
  duration_minutes: "",
  description: "",
  image_url: null,
  image_focus_y: 50,
};

function toDraft(service: Service): Draft {
  return {
    id: service.id,
    name: service.name,
    category: service.category,
    price: String(service.price),
    deposit_amount: String(service.deposit_amount),
    duration_minutes: String(service.duration_minutes),
    description: service.description ?? "",
    image_url: service.image_url ?? null,
    image_focus_y: service.image_focus_y ?? 50,
  };
}

function formatDuration(mins: number) {
  const hrs = Math.floor(mins / 60);
  const m = mins % 60;
  if (hrs && m) return `${hrs}h ${m}m`;
  if (hrs) return `${hrs}h`;
  return `${m}m`;
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Service | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [blockedDelete, setBlockedDelete] = useState<{
    service: Service;
    count: number;
    appointments: { date: string; time: string; client: string }[];
  } | null>(null);
  const [reordering, setReordering] = useState(false);
  // Archived services cannot always be deleted — anything ever booked has to
  // stay so that appointment still says what it was for — so without somewhere
  // to put them they pile up in the working list forever.
  const [showArchived, setShowArchived] = useState(false);

  const supabase = createClient();

  const fetchServices = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from("services")
      .select("*")
      .order("sort_order", { ascending: true });

    if (queryError) {
      setError(queryError.message);
      setLoading(false);
      return;
    }
    setError(null);
    setServices((data || []) as Service[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const toggleActive = async (service: Service) => {
    const next = !service.is_active;
    // Optimistic, because the switch should feel instant — reverted below if
    // the write is rejected, so the UI can never claim a state the database
    // did not accept.
    setServices((prev) =>
      prev.map((s) => (s.id === service.id ? { ...s, is_active: next } : s))
    );

    const { error: writeError } = await supabase
      .from("services")
      .update({ is_active: next })
      .eq("id", service.id);

    if (writeError) {
      setServices((prev) =>
        prev.map((s) =>
          s.id === service.id ? { ...s, is_active: service.is_active } : s
        )
      );
      setError(`Couldn't update ${service.name}: ${writeError.message}`);
    }
  };

  // Swaps sort_order with the neighbour above or below. Buttons rather than
  // drag-and-drop: this is used on a phone, where dragging a row inside a
  // scrolling list fights the scroll.
  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= services.length) return;

    const a = services[index];
    const b = services[target];

    // Reordered locally first so the row visibly moves on tap; re-fetched
    // below so a rejected write can never leave the screen disagreeing with
    // the database.
    setServices((prev) => {
      const next = [...prev];
      next[index] = b;
      next[target] = a;
      return next;
    });
    setReordering(true);

    // Two rows can share a sort_order if they were seeded that way, which
    // would make a swap a no-op. Writing positions by index instead of
    // exchanging the two stored values sidesteps that entirely.
    const [{ error: errA }, { error: errB }] = await Promise.all([
      supabase.from("services").update({ sort_order: target }).eq("id", a.id),
      supabase.from("services").update({ sort_order: index }).eq("id", b.id),
    ]);

    setReordering(false);

    if (errA || errB) {
      setError(`Couldn't reorder: ${(errA || errB)!.message}`);
    }
    fetchServices();
  };

  // Runs through /api/admin/delete-service rather than the browser client:
  // bookings has no delete policy for the authenticated role (only
  // select/update), so clearing blocking appointments needs the service
  // role. `deleteBookings` is only ever true on the second call, after she's
  // seen who's attached and confirmed they're tests.
  const deleteService = async (service: Service, deleteBookings = false) => {
    setDeleting(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/delete-service", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId: service.id, deleteBookings }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || `Couldn't delete ${service.name}.`);
        setConfirmDelete(null);
        setBlockedDelete(null);
        return;
      }

      if (data.blocked) {
        setConfirmDelete(null);
        setBlockedDelete({
          service,
          count: data.count,
          appointments: data.appointments || [],
        });
        return;
      }

      setConfirmDelete(null);
      setBlockedDelete(null);
      setLoading(true);
      fetchServices();
    } catch {
      setError(`Couldn't delete ${service.name}: network error.`);
    } finally {
      setDeleting(false);
    }
  };

  // Split for display only; `services` stays the single ordered source that
  // move() indexes into, so reordering is unaffected.
  const activeServices = services.filter((s) => s.is_active);
  const archivedServices = services.filter((s) => !s.is_active);

  const saveDraft = async () => {
    if (!draft) return;

    const price = Number(draft.price);
    const deposit = Number(draft.deposit_amount);
    const duration = Number(draft.duration_minutes);

    // Guarded here because these land in Square's charge amount and in the
    // slot generator; a NaN or a negative would either mischarge or produce
    // an unbookable service.
    if (!draft.name.trim()) return setFormError("Give the service a name.");
    if (!Number.isFinite(price) || price < 0)
      return setFormError("Price must be a number.");
    if (!Number.isFinite(deposit) || deposit < 0)
      return setFormError("Deposit must be a number.");
    if (deposit > price)
      return setFormError("Deposit can't be more than the price.");
    if (!Number.isInteger(duration) || duration <= 0)
      return setFormError("Duration must be a whole number of minutes.");

    setSaving(true);
    setFormError(null);

    const payload = {
      name: draft.name.trim(),
      category: draft.category,
      price,
      deposit_amount: deposit,
      duration_minutes: duration,
      description: draft.description.trim() || null,
      image_url: draft.image_url,
      image_focus_y: draft.image_focus_y,
    };

    const { error: writeError } = draft.id
      ? await supabase.from("services").update(payload).eq("id", draft.id)
      : await supabase.from("services").insert({
          ...payload,
          is_active: true,
          // Appended to the end of the list rather than colliding on 0.
          sort_order: services.length
            ? Math.max(...services.map((s) => s.sort_order)) + 1
            : 0,
        });

    setSaving(false);

    if (writeError) {
      setFormError(writeError.message);
      return;
    }

    setDraft(null);
    setLoading(true);
    fetchServices();
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="font-display text-[28px] font-bold text-dark-brown">
          Services
        </h1>
        <Button
          onClick={() => {
            setFormError(null);
            setDraft(emptyDraft);
          }}
        >
          Add Service
        </Button>
      </div>

      {error && (
        <div
          role="alert"
          className="bg-white border border-danger/30 rounded-surface p-4 mb-4"
        >
          <p className="font-sans text-[16px] text-danger font-semibold">
            {error}
          </p>
          <Button
            variant="secondary"
            className="mt-3"
            onClick={() => {
              setLoading(true);
              setError(null);
              fetchServices();
            }}
          >
            Retry
          </Button>
        </div>
      )}

      <div className="bg-white rounded-surface shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
        {loading ? (
          <div>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="px-4 sm:px-5 py-4 border-b border-light-tan last:border-b-0"
              >
                <div className="h-[16px] w-[45%] rounded-control bg-light-tan/70 animate-pulse" />
                <div className="h-[12px] w-[30%] rounded-control bg-light-tan/50 animate-pulse mt-2" />
              </div>
            ))}
          </div>
        ) : activeServices.length === 0 && archivedServices.length === 0 && !error ? (
          <div className="px-5 py-10 text-center">
            <p className="font-sans text-[16px] text-charcoal font-semibold">
              No services yet
            </p>
            <p className="font-sans text-[16px] text-muted mt-1">
              Add one and it becomes bookable straight away.
            </p>
          </div>
        ) : (
          activeServices.map((service) => (
            <div
              key={service.id}
              className="flex items-center justify-between gap-2 sm:gap-3 px-4 sm:px-5 py-4 border-b border-light-tan last:border-b-0"
            >
              {/* Order controls. This is the order clients see on the booking
                  page, so it is worth being able to set without a database. */}
              <div className="flex flex-col shrink-0 -my-1">
                <button
                  type="button"
                  onClick={() => move(services.indexOf(service), -1)}
                  disabled={services.indexOf(service) === 0 || reordering}
                  aria-label={`Move ${service.name} up`}
                  className="w-8 h-7 inline-flex items-center justify-center rounded-control text-muted hover:text-deep-brown hover:bg-cream disabled:opacity-25 disabled:hover:bg-transparent transition-colors active:scale-95"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 15l-6-6-6 6" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => move(services.indexOf(service), 1)}
                  disabled={
                    services.indexOf(service) === services.length - 1 || reordering
                  }
                  aria-label={`Move ${service.name} down`}
                  className="w-8 h-7 inline-flex items-center justify-center rounded-control text-muted hover:text-deep-brown hover:bg-cream disabled:opacity-25 disabled:hover:bg-transparent transition-colors active:scale-95"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setFormError(null);
                  setDraft(toDraft(service));
                }}
                className="flex-1 min-w-0 text-left rounded-control transition-transform active:scale-[0.99]"
              >
                <span className="flex items-center gap-2 flex-wrap">
                  <span className="font-sans text-[16px] font-semibold text-dark-brown">
                    {service.name}
                  </span>
                  {!service.is_active && (
                    <span className="text-[12px] font-semibold font-sans text-muted bg-muted/15 px-2.5 py-1 rounded-full">
                      Inactive
                    </span>
                  )}
                </span>
                <span className="block font-sans text-[12px] text-muted mt-0.5">
                  {CATEGORY_LABELS[service.category]}{" "}
                  &middot; {formatDuration(service.duration_minutes)} &middot; $
                  {service.deposit_amount} deposit
                </span>
              </button>
              <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                <span className="font-sans text-[16px] font-semibold text-deep-brown tabular-nums">
                  ${Number(service.price).toFixed(2)}
                </span>
                {/* The pill keeps its compact look; the pseudo-element extends
                    the hit area to the 44px minimum without moving anything. */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={service.is_active}
                  aria-label={`${service.name} — ${
                    service.is_active ? "active" : "inactive"
                  }`}
                  onClick={() => toggleActive(service)}
                  className={`relative w-10 h-5 rounded-full transition-[background-color,transform] duration-150 active:scale-[0.94] before:absolute before:content-[''] before:-inset-x-1 before:-inset-y-3 ${
                    service.is_active ? "bg-deep-brown" : "bg-muted/30"
                  }`}
                >
                  {/* `left-0.5` is load-bearing. Without a left anchor this
                      span is positioned from its static position, and a
                      <button> centres its content — so the knob started near
                      the middle of the track and `translate-x-5` carried it
                      out past the right edge instead of sliding to it.
                      Anchored at 2px and travelling 20px, it lands 2px from
                      the right of the 40px track: even inset at both ends. */}
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ease-out ${
                      service.is_active ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>

                <button
                  type="button"
                  onClick={() => setConfirmDelete(service)}
                  aria-label={`Delete ${service.name}`}
                  className="w-11 h-11 -mr-2 inline-flex items-center justify-center rounded-control text-muted hover:text-danger hover:bg-danger/10 transition-colors active:scale-95"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a1 1 0 01-1 1H7a1 1 0 01-1-1L5 6" />
                    <path d="M10 11v6M14 11v6" />
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Archived. Switched off and out of the way, but still reachable —
          some of these cannot be deleted at all, because an appointment still
          refers to them and that record has to keep meaning something. */}
      {archivedServices.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowArchived((open) => !open)}
            aria-expanded={showArchived}
            className="flex items-center gap-2 font-sans text-[13px] text-muted font-semibold"
          >
            <span
              aria-hidden="true"
              className={`transition-transform duration-200 ${
                showArchived ? "rotate-90" : ""
              }`}
            >
              &rsaquo;
            </span>
            Archived ({archivedServices.length})
          </button>

          {showArchived && (
            <div className="bg-white rounded-surface shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden mt-2">
              {archivedServices.map((service) => (
                <div
                  key={service.id}
                  className="flex items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-light-tan last:border-b-0"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setFormError(null);
                      setDraft(toDraft(service));
                    }}
                    className="flex-1 min-w-0 text-left"
                  >
                    <span className="block font-sans text-[16px] font-semibold text-muted truncate">
                      {service.name}
                    </span>
                    <span className="block font-sans text-[12px] text-muted mt-0.5">
                      Hidden from clients &middot; ${Number(service.price).toFixed(2)}
                    </span>
                  </button>

                  <div className="flex items-center gap-3 shrink-0">
                    {/* Turning it back on is the counterpart to archiving it,
                        and is the only route back for a seasonal service. */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={false}
                      aria-label={`Switch ${service.name} back on`}
                      onClick={() => toggleActive(service)}
                      className="relative w-10 h-5 rounded-full bg-muted/30 transition-[background-color,transform] duration-150 active:scale-[0.94] before:absolute before:content-[''] before:-inset-x-1 before:-inset-y-3"
                    >
                      <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ease-out translate-x-0" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setConfirmDelete(service)}
                      aria-label={`Delete ${service.name}`}
                      className="w-11 h-11 -mr-2 inline-flex items-center justify-center rounded-control text-muted hover:text-danger hover:bg-danger/10 transition-colors active:scale-95"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a1 1 0 01-1 1H7a1 1 0 01-1-1L5 6" />
                        <path d="M10 11v6M14 11v6" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Modal
        isOpen={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? "Edit Service" : "Add Service"}
      >
        {draft && (
          <div className="flex flex-col gap-4">
            <ServicePhotoField
              imageUrl={draft.image_url}
              focusY={draft.image_focus_y}
              onChange={({ imageUrl, focusY }) =>
                setDraft({ ...draft, image_url: imageUrl, image_focus_y: focusY })
              }
            />

            <Input
              id="service-name"
              label="Name"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />

            <div className="flex flex-col gap-1">
              <label
                htmlFor="service-category"
                className="text-dark-brown text-[12px] font-semibold font-sans"
              >
                Category
              </label>
              <select
                id="service-category"
                value={draft.category}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    category: e.target.value as Draft["category"],
                  })
                }
                className="w-full h-control box-border bg-white border border-light-tan rounded-control px-3 text-[16px] md:text-[14px] text-charcoal font-sans focus:border-deep-brown transition-colors"
              >
                <option value="full_set">Full Set</option>
                <option value="refill">Refill</option>
                <option value="lift">Lash Lift</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                id="service-price"
                label="Price ($)"
                type="number"
                inputMode="decimal"
                value={draft.price}
                onChange={(e) => setDraft({ ...draft, price: e.target.value })}
              />
              <Input
                id="service-deposit"
                label="Deposit ($)"
                type="number"
                inputMode="decimal"
                value={draft.deposit_amount}
                onChange={(e) =>
                  setDraft({ ...draft, deposit_amount: e.target.value })
                }
              />
            </div>

            <Input
              id="service-duration"
              label="Duration (minutes)"
              type="number"
              inputMode="numeric"
              value={draft.duration_minutes}
              onChange={(e) =>
                setDraft({ ...draft, duration_minutes: e.target.value })
              }
            />

            <Input
              id="service-description"
              label="Description (optional)"
              value={draft.description}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
            />

            {formError && (
              <p role="alert" className="font-sans text-[16px] text-danger font-semibold">
                {formError}
              </p>
            )}

            <div className="flex gap-3 mt-1">
              <Button onClick={saveDraft} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setDraft(null)}
                disabled={saving}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Delete this service?"
      >
        {confirmDelete && (
          <div>
            <p className="font-sans text-[16px] text-charcoal leading-[1.5]">
              <span className="font-semibold">{confirmDelete.name}</span> will
              be removed for good. If it has ever been booked, you&apos;ll be
              shown those appointments next and asked to confirm before
              anything is deleted.
            </p>
            <div className="flex gap-3 mt-5">
              <Button
                variant="danger"
                onClick={() => deleteService(confirmDelete)}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={blockedDelete !== null}
        onClose={() => setBlockedDelete(null)}
        title="This service has appointments"
      >
        {blockedDelete && (
          <div>
            <p className="font-sans text-[16px] text-charcoal leading-[1.5]">
              <span className="font-semibold">{blockedDelete.service.name}</span>{" "}
              is on {blockedDelete.count}{" "}
              {blockedDelete.count === 1 ? "appointment" : "appointments"}:
            </p>
            <ul className="mt-3 space-y-1 font-sans text-[15px] text-charcoal/80">
              {blockedDelete.appointments.map((a, i) => (
                <li key={i}>
                  {a.client} — {a.date} at {a.time}
                </li>
              ))}
              {blockedDelete.count > blockedDelete.appointments.length && (
                <li>and {blockedDelete.count - blockedDelete.appointments.length} more</li>
              )}
            </ul>
            <p className="font-sans text-[15px] text-charcoal/80 leading-[1.5] mt-3">
              If these are real bookings, switch the service off instead —
              that hides it from clients but keeps its history. If they were
              only tests, deleting the service will remove these appointments
              (and their intake forms and signed agreements) with them.
            </p>
            <div className="flex gap-3 mt-5">
              <Button
                variant="danger"
                onClick={() => deleteService(blockedDelete.service, true)}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "These are tests — delete them and the service"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setBlockedDelete(null)}
                disabled={deleting}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

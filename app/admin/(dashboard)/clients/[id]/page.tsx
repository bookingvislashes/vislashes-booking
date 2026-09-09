"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClientDocuments } from "@/components/admin/ClientDocuments";
import { createClient } from "@/lib/supabase/client";
import { todayISO, slotToMinutes } from "@/lib/schedule";
import type { Client } from "@/lib/supabase/types";

/**
 * One client, everything about them in one place.
 *
 * The list used to be the end of the road — a name, an email and a visit
 * count, with no way in. Everything the salon knows about someone was spread
 * across Bookings, Invoices and Agreements and could only be found by
 * remembering to look. This is that, gathered, and the only place her own
 * notes about a client can live.
 */

interface Appointment {
  id: string;
  booking_date: string;
  time_slot: string;
  status: "confirmed" | "completed" | "cancelled" | "no_show";
  service_name: string;
}

interface Invoice {
  id: string;
  amount: string | number;
  description: string;
  status: "unpaid" | "paid" | "void";
  created_at: string;
  paid_at: string | null;
}

interface AgreementRow {
  id: string;
  signed_at: string;
  filming_consent: boolean;
  liability_waiver_signed: boolean;
  terms_accepted: boolean;
}

function money(value: string | number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "$0.00";
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatStamp(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function initials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "?"
  );
}

function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-surface shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-light-tan">
        <h2 className="font-display text-[18px] font-bold text-dark-brown">
          {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}

export default function ClientProfilePage() {
  const params = useParams<{ id: string }>();
  const clientId = params.id;

  const [client, setClient] = useState<Client | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [agreements, setAgreements] = useState<AgreementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editing
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    notes: "",
    allergy_note: "",
  });

  const supabase = createClient();
  const today = todayISO();

  const fetchAll = useCallback(async () => {
    const { data: clientRow, error: clientErr } = await supabase
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .maybeSingle();

    if (clientErr || !clientRow) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const record = clientRow as Client;
    setClient(record);
    setForm({
      full_name: record.full_name ?? "",
      email: record.email ?? "",
      phone: record.phone ?? "",
      notes: record.notes ?? "",
      allergy_note: record.allergy_note ?? "",
    });

    const [bookingsRes, byIdRes, byNameRes, agreementsRes] = await Promise.all([
      supabase
        .from("bookings")
        .select("id, booking_date, time_slot, status, service:services(name)")
        .eq("client_id", clientId)
        .order("booking_date", { ascending: false }),
      supabase
        .from("invoices")
        .select("id, amount, description, status, created_at, paid_at")
        .eq("client_id", clientId),
      // Invoices raised before this client was ever linked — matched on the
      // name she typed. Without this an older invoice would simply not appear
      // on the profile it obviously belongs to.
      supabase
        .from("invoices")
        .select("id, amount, description, status, created_at, paid_at")
        .is("client_id", null)
        .ilike("client_name", record.full_name),
      supabase
        .from("agreements")
        .select(
          "id, signed_at, filming_consent, liability_waiver_signed, terms_accepted"
        )
        .eq("client_id", clientId)
        .order("signed_at", { ascending: false }),
    ]);

    type BookingRow = {
      id: string;
      booking_date: string;
      time_slot: string;
      status: Appointment["status"];
      service: { name: string } | { name: string }[] | null;
    };

    setAppointments(
      ((bookingsRes.data ?? []) as BookingRow[])
        .map((b) => {
          const service = Array.isArray(b.service) ? b.service[0] : b.service;
          return {
            id: b.id,
            booking_date: b.booking_date,
            time_slot: b.time_slot,
            status: b.status,
            service_name: service?.name ?? "Appointment",
          };
        })
        // booking_date orders in SQL; time_slot can't, because it is a
        // 12-hour string and sorts 10:00 AM before 9:00 AM.
        .sort((a, b) =>
          a.booking_date === b.booking_date
            ? (slotToMinutes(b.time_slot) ?? 0) - (slotToMinutes(a.time_slot) ?? 0)
            : a.booking_date < b.booking_date
            ? 1
            : -1
        )
    );

    const merged = new Map<string, Invoice>();
    for (const row of [...(byIdRes.data ?? []), ...(byNameRes.data ?? [])]) {
      merged.set((row as Invoice).id, row as Invoice);
    }
    setInvoices(
      [...merged.values()].sort((a, b) =>
        a.created_at < b.created_at ? 1 : -1
      )
    );

    setAgreements((agreementsRes.data ?? []) as AgreementRow[]);
    setError(
      bookingsRes.error?.message ??
        byIdRes.error?.message ??
        agreementsRes.error?.message ??
        null
    );
    setLoading(false);
  }, [supabase, clientId]);

  useEffect(() => {
    // Kicked off inside an async closure rather than called straight from the
    // effect body: nothing here sets state until after the first await, which
    // is what keeps this off the cascading-render path the other admin screens
    // are still on.
    void (async () => {
      await fetchAll();
    })();
  }, [fetchAll]);

  // Still to come goes first and reads soonest-first; everything else keeps
  // the newest-first order it arrived in.
  const { upcoming, history } = useMemo(() => {
    const isUpcoming = (a: Appointment) =>
      a.status === "confirmed" && a.booking_date >= today;
    return {
      upcoming: appointments.filter(isUpcoming).reverse(),
      history: appointments.filter((a) => !isUpcoming(a)),
    };
  }, [appointments, today]);

  const totalPaid = useMemo(
    () =>
      invoices
        .filter((i) => i.status === "paid")
        .reduce((sum, i) => sum + (Number(i.amount) || 0), 0),
    [invoices]
  );

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form.full_name.trim()) {
      setError("A client needs a name.");
      return;
    }
    setSaving(true);
    const { error: updateErr } = await supabase
      .from("clients")
      .update({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        // Blank fields are stored as null rather than "", so "is there a note"
        // is one check everywhere instead of two.
        notes: form.notes.trim() || null,
        allergy_note: form.allergy_note.trim() || null,
      })
      .eq("id", clientId);
    setSaving(false);

    if (updateErr) {
      setError(updateErr.message);
      return;
    }
    setError(null);
    setEditing(false);
    await fetchAll();
  }

  if (loading) {
    return (
      <p className="font-sans text-[16px] text-muted animate-pulse">
        Loading client…
      </p>
    );
  }

  if (notFound || !client) {
    return (
      <div>
        <Link
          href="/admin/clients"
          className="font-sans text-[14px] text-deep-brown font-semibold"
        >
          ← Clients
        </Link>
        <p className="font-sans text-[16px] text-muted mt-4">
          That client no longer exists.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 max-w-[820px]">
      <Link
        href="/admin/clients"
        className="font-sans text-[14px] text-deep-brown font-semibold self-start -ml-1 px-1 py-1"
      >
        ← Clients
      </Link>

      {/* Identity */}
      <section className="bg-white rounded-surface shadow-[0_1px_4px_rgba(0,0,0,0.06)] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-full bg-warm-beige/30 flex items-center justify-center shrink-0">
            <span className="font-sans text-[18px] font-semibold text-deep-brown">
              {initials(client.full_name)}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-[24px] font-bold text-dark-brown leading-tight break-words">
              {client.full_name}
            </h1>
            <p className="font-sans text-[13px] text-muted tabular-nums">
              {client.visit_count} {client.visit_count === 1 ? "visit" : "visits"}
              {totalPaid > 0 ? ` · ${money(totalPaid)} invoiced and paid` : ""}
            </p>
          </div>
          {!editing && (
            <Button
              variant="secondary"
              size="sm"
              className="shrink-0"
              onClick={() => setEditing(true)}
            >
              Edit
            </Button>
          )}
        </div>

        {/* An allergy is the one thing that must not need a tap to find. */}
        {!editing && client.allergy_note && (
          <p className="mt-3 font-sans text-[14px] text-danger bg-danger/10 border border-danger/20 rounded-control px-3 py-2 leading-[1.5]">
            <span className="font-semibold">Sensitivity: </span>
            {client.allergy_note}
          </p>
        )}

        {!editing && (
          <>
            {/* Tapping a number on the phone should call it. */}
            <div className="flex flex-wrap gap-2 mt-3">
              {client.phone && (
                <a
                  href={`tel:${client.phone}`}
                  className="inline-flex items-center h-control-sm px-4 rounded-control border border-light-tan font-sans text-[14px] text-charcoal hover:bg-light-tan transition-colors"
                >
                  Call {client.phone}
                </a>
              )}
              {client.phone && (
                <a
                  href={`sms:${client.phone}`}
                  className="inline-flex items-center h-control-sm px-4 rounded-control border border-light-tan font-sans text-[14px] text-charcoal hover:bg-light-tan transition-colors"
                >
                  Text
                </a>
              )}
              {client.email && (
                <a
                  href={`mailto:${client.email}`}
                  className="inline-flex items-center h-control-sm px-4 rounded-control border border-light-tan font-sans text-[14px] text-charcoal hover:bg-light-tan transition-colors max-w-full truncate"
                >
                  {client.email}
                </a>
              )}
            </div>

            {client.notes && (
              <p className="mt-3 font-sans text-[14px] text-charcoal leading-[1.6] whitespace-pre-wrap border-t border-light-tan pt-3">
                {client.notes}
              </p>
            )}
          </>
        )}

        {editing && (
          <form onSubmit={save} className="mt-4 grid gap-3">
            {[
              ["full_name", "Name", "text"],
              ["email", "Email", "email"],
              ["phone", "Phone", "tel"],
            ].map(([key, label, type]) => (
              <label key={key} className="block">
                <span className="font-sans text-[12px] font-semibold text-dark-brown">
                  {label}
                </span>
                <input
                  type={type}
                  value={form[key as keyof typeof form]}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, [key]: e.target.value }))
                  }
                  className="w-full mt-1 h-control px-3 box-border bg-white border border-light-tan rounded-control text-[16px] text-charcoal font-sans focus:border-deep-brown transition-colors"
                />
              </label>
            ))}

            <label className="block">
              <span className="font-sans text-[12px] font-semibold text-dark-brown">
                Allergy or sensitivity
              </span>
              <input
                type="text"
                value={form.allergy_note}
                onChange={(e) =>
                  setForm((f) => ({ ...f, allergy_note: e.target.value }))
                }
                placeholder="Reacts to cyanoacrylate — sensitive adhesive only"
                className="w-full mt-1 h-control px-3 box-border bg-white border border-light-tan rounded-control text-[16px] text-charcoal font-sans placeholder:text-muted focus:border-deep-brown transition-colors"
              />
              <span className="font-sans text-[12px] text-muted mt-1 block leading-[1.5]">
                Anything here shows up on Today beside their appointment, so
                you see it before you start.
              </span>
            </label>

            <label className="block">
              <span className="font-sans text-[12px] font-semibold text-dark-brown">
                Notes
              </span>
              <textarea
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
                rows={4}
                placeholder="Prefers a wispy D curl. Always books the last slot of the day."
                className="w-full mt-1 p-3 box-border bg-white border border-light-tan rounded-control text-[16px] text-charcoal font-sans placeholder:text-muted focus:border-deep-brown transition-colors leading-[1.5]"
              />
            </label>

            {error && (
              <p className="font-sans text-[14px] text-danger">{error}</p>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                disabled={saving}
                onClick={() => {
                  setEditing(false);
                  setError(null);
                  setForm({
                    full_name: client.full_name ?? "",
                    email: client.email ?? "",
                    phone: client.phone ?? "",
                    notes: client.notes ?? "",
                    allergy_note: client.allergy_note ?? "",
                  });
                }}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        )}
      </section>

      {error && !editing && (
        <p className="font-sans text-[14px] text-danger">{error}</p>
      )}

      {/* Appointments */}
      <Card
        title="Appointments"
        action={
          <Link
            href="/admin/bookings/new"
            className="font-sans text-[14px] font-semibold text-deep-brown"
          >
            + Book
          </Link>
        }
      >
        {appointments.length === 0 ? (
          <p className="px-4 sm:px-5 py-6 font-sans text-[15px] text-muted">
            No appointments yet.
          </p>
        ) : (
          <ul>
            {[...upcoming, ...history].map((appt) => (
              <li key={appt.id}>
                <Link
                  href={`/admin/bookings/${appt.id}`}
                  className="flex items-center gap-3 px-4 sm:px-5 py-3.5 border-b border-light-tan last:border-b-0 hover:bg-cream/50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-sans text-[15px] font-semibold text-dark-brown">
                      {formatDate(appt.booking_date)}
                      <span className="text-muted font-normal">
                        {" "}
                        · {appt.time_slot}
                      </span>
                    </p>
                    <p className="font-sans text-[14px] text-muted truncate">
                      {appt.service_name}
                    </p>
                  </div>
                  <Badge status={appt.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Invoices */}
      <Card
        title="Invoices"
        action={
          <Link
            href="/admin/invoices"
            className="font-sans text-[14px] font-semibold text-deep-brown"
          >
            All invoices
          </Link>
        }
      >
        {invoices.length === 0 ? (
          <p className="px-4 sm:px-5 py-6 font-sans text-[15px] text-muted">
            Nothing invoiced yet.
          </p>
        ) : (
          <ul>
            {invoices.map((invoice) => (
              <li
                key={invoice.id}
                className="flex items-center gap-3 px-4 sm:px-5 py-3.5 border-b border-light-tan last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-sans text-[15px] font-semibold text-dark-brown truncate">
                    {invoice.description}
                  </p>
                  <p className="font-sans text-[13px] text-muted">
                    {invoice.status === "paid" && invoice.paid_at
                      ? `Paid ${formatStamp(invoice.paid_at)}`
                      : `Raised ${formatStamp(invoice.created_at)}`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-sans text-[15px] font-semibold text-dark-brown tabular-nums">
                    {money(invoice.amount)}
                  </p>
                  <p
                    className={`font-sans text-[12px] font-semibold ${
                      invoice.status === "paid"
                        ? "text-success"
                        : invoice.status === "void"
                        ? "text-muted"
                        : "text-deep-brown"
                    }`}
                  >
                    {invoice.status === "paid"
                      ? "Paid"
                      : invoice.status === "void"
                      ? "Void"
                      : "Unpaid"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Signed online, through the booking flow. */}
      {agreements.length > 0 && (
        <Card title="Signed online">
          <ul>
            {agreements.map((agreement) => (
              <li
                key={agreement.id}
                className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-light-tan last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="font-sans text-[15px] font-semibold text-dark-brown">
                    Consent &amp; waiver
                  </p>
                  <p className="font-sans text-[13px] text-muted">
                    Signed {formatStamp(agreement.signed_at)}
                  </p>
                </div>
                <Link
                  href="/admin/agreements"
                  className="shrink-0 font-sans text-[15px] font-semibold text-deep-brown min-h-11 inline-flex items-center px-3"
                >
                  View
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Uploaded paper forms. */}
      <ClientDocuments clientId={clientId} clientName={client.full_name} />
    </div>
  );
}

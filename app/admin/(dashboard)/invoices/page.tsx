"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

/**
 * Invoices — who owes a deposit, who has paid, and the link to send them.
 *
 * Reading is done straight from Supabase with her own session, like every
 * other admin list. Writing goes through /api/admin/invoices, because the
 * link's token has to be minted server-side and settling an invoice must not
 * be something a browser can do to an arbitrary row.
 */

interface Invoice {
  id: string;
  token: string;
  client_id: string | null;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  amount: string | number;
  description: string;
  note: string | null;
  status: "unpaid" | "paid" | "void";
  paid_method: "card" | "manual" | null;
  square_payment_id: string | null;
  paid_at: string | null;
  due_date: string | null;
  created_at: string;
}

interface ClientOption {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
}

interface ServiceOption {
  id: string;
  name: string;
  deposit_amount: string | number;
}

type Filter = "unpaid" | "paid" | "all";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "unpaid", label: "Not paid" },
  { value: "paid", label: "Paid" },
  { value: "all", label: "All" },
];

function money(value: string | number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "$0.00";
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function when(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function InvoicesPage() {
  const [rows, setRows] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("unpaid");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New-invoice form
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");

  const supabase = createClient();

  const fetchAll = useCallback(async () => {
    const [invoices, clientRows, serviceRows] = await Promise.all([
      supabase
        .from("invoices")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("clients")
        .select("id, full_name, email, phone")
        .order("full_name"),
      // The deposit is per service and she edits it in Services, so the form
      // reads it from there rather than carrying a second copy of the number.
      supabase
        .from("services")
        .select("id, name, deposit_amount")
        .eq("is_active", true)
        .order("sort_order"),
    ]);

    if (invoices.error) {
      setError(invoices.error.message);
      setLoading(false);
      return;
    }

    setRows((invoices.data || []) as Invoice[]);
    setClients((clientRows.data || []) as ClientOption[]);
    setServices((serviceRows.data || []) as ServiceOption[]);

    setError(null);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "paid") return rows.filter((r) => r.status === "paid");
    // "Not paid" means outstanding — a cancelled invoice is not something she
    // is still chasing.
    return rows.filter((r) => r.status === "unpaid");
  }, [rows, filter]);

  const owed = useMemo(
    () =>
      rows
        .filter((r) => r.status === "unpaid")
        .reduce((sum, r) => sum + (Number(r.amount) || 0), 0),
    [rows]
  );

  const collected = useMemo(
    () =>
      rows
        .filter((r) => r.status === "paid")
        .reduce((sum, r) => sum + (Number(r.amount) || 0), 0),
    [rows]
  );

  const selectClient = (id: string) => {
    setClientId(id);
    const match = clients.find((c) => c.id === id);
    if (match) setClientName(match.full_name);
  };

  /** Picking a service fills in both the amount and the wording, so the common
   *  case is two taps and the deposit can never disagree with Services. */
  const selectService = (id: string) => {
    setServiceId(id);
    const match = services.find((s) => s.id === id);
    if (!match) return;
    setAmount(`${Number(match.deposit_amount)}`);
    setDescription(`Deposit for ${match.name}`);
  };

  const resetForm = () => {
    setClientId("");
    setClientName("");
    setServiceId("");
    setAmount("");
    setDescription("");
    setDueDate("");
    setFormError(null);
  };

  const createInvoice = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError(null);

    const chosen = clients.find((c) => c.id === clientId);
    const value = Number(amount);

    if (!Number.isFinite(value) || value <= 0) {
      setFormError("Enter an amount, like 50.");
      setSaving(false);
      return;
    }

    const res = await fetch("/api/admin/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: clientId || null,
        clientName: clientName.trim(),
        clientEmail: chosen?.email || null,
        clientPhone: chosen?.phone || null,
        amount: value,
        description: description.trim(),
        dueDate: dueDate || null,
      }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setFormError(data.error || "Could not create the invoice.");
      return;
    }

    resetForm();
    setFormOpen(false);
    setFilter("unpaid");
    await fetchAll();
  };

  const act = async (
    invoice: Invoice,
    action: "mark_paid" | "mark_unpaid" | "void" | "delete"
  ) => {
    if (
      action === "delete" &&
      !confirm(`Delete the invoice for ${invoice.client_name}? This can't be undone.`)
    ) {
      return;
    }

    setBusyId(invoice.id);
    setActionError(null);

    const res = await fetch("/api/admin/invoices", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: invoice.id, action }),
    });

    const data = await res.json().catch(() => ({}));
    setBusyId(null);

    if (!res.ok) {
      setActionError(data.error || "That didn't work. Please try again.");
      return;
    }

    await fetchAll();
  };

  const copyLink = async (invoice: Invoice) => {
    const url = `${window.location.origin}/invoice/${invoice.token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(invoice.id);
      setTimeout(() => setCopiedId((id) => (id === invoice.id ? null : id)), 2000);
    } catch {
      // Clipboard is blocked outside a secure context and on some in-app
      // browsers. Showing the link is better than a dead button.
      window.prompt("Copy this link and send it to your client:", url);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <h1 className="font-display text-[28px] font-bold text-dark-brown">
          Invoices
        </h1>
        {/* Hidden while the form is open — the form has its own Cancel, and two
            buttons saying the same thing is one decision too many. */}
        {!formOpen && (
          <Button
            onClick={() => {
              setFormOpen(true);
              setFormError(null);
            }}
          >
            New invoice
          </Button>
        )}
      </div>
      <p className="font-sans text-[16px] text-muted mb-6 leading-[1.5]">
        Send someone a link to pay their deposit, and see at a glance who still
        owes you.
      </p>

      {formOpen && (
        <form
          onSubmit={createInvoice}
          className="bg-white rounded-surface shadow-[0_1px_4px_rgba(0,0,0,0.06)] p-4 sm:p-5 mb-6"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="font-sans text-[16px] font-semibold text-dark-brown">
                Who is it for?
              </span>
              <select
                value={clientId}
                onChange={(e) => selectClient(e.target.value)}
                className="w-full mt-1 h-control px-3 bg-white border border-light-tan rounded-control text-[16px] text-charcoal font-sans cursor-pointer"
              >
                <option value="">Someone new — type their name</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="font-sans text-[16px] font-semibold text-dark-brown">
                Name on the invoice
              </span>
              <input
                type="text"
                required
                value={clientName}
                onChange={(e) => {
                  setClientName(e.target.value);
                  // Typing over a picked client detaches it, so the invoice is
                  // never filed under someone it isn't for.
                  setClientId("");
                }}
                placeholder="First and last name"
                className="w-full mt-1 h-control px-3 box-border bg-white border border-light-tan rounded-control text-[16px] text-charcoal font-sans placeholder:text-muted focus:border-deep-brown transition-colors"
              />
              <span className="font-sans text-[12px] text-muted mt-1 block leading-[1.5]">
                Filed against this client&apos;s profile automatically. A name
                nobody in your list has starts a new profile.
              </span>
            </label>

            <label className="block">
              <span className="font-sans text-[16px] font-semibold text-dark-brown">
                Which appointment?
              </span>
              <select
                value={serviceId}
                onChange={(e) => selectService(e.target.value)}
                className="w-full mt-1 h-control px-3 bg-white border border-light-tan rounded-control text-[16px] text-charcoal font-sans cursor-pointer"
              >
                <option value="">Something else</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {money(s.deposit_amount)} deposit
                  </option>
                ))}
              </select>
              <span className="font-sans text-[12px] text-muted">
                Fills in the deposit and the wording for you.
              </span>
            </label>

            <label className="block">
              <span className="font-sans text-[16px] font-semibold text-dark-brown">
                Amount
              </span>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-sans text-[16px] text-muted">
                  $
                </span>
                <input
                  type="number"
                  required
                  min="1"
                  max="2000"
                  step="1"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="25"
                  className="w-full h-control pl-7 pr-3 box-border bg-white border border-light-tan rounded-control text-[16px] text-charcoal font-sans tabular-nums placeholder:text-muted focus:border-deep-brown transition-colors"
                />
              </div>
              <span className="font-sans text-[12px] text-muted">
                Deposits come from Services — change one there and it changes here.
              </span>
            </label>

            <label className="block">
              <span className="font-sans text-[16px] font-semibold text-dark-brown">
                Due date <span className="text-muted font-normal">(optional)</span>
              </span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full mt-1 h-control px-3 box-border bg-white border border-light-tan rounded-control text-[16px] text-charcoal font-sans focus:border-deep-brown transition-colors"
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="font-sans text-[16px] font-semibold text-dark-brown">
                What is it for?
              </span>
              <input
                type="text"
                required
                maxLength={200}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Deposit for Hybrid Set"
                className="w-full mt-1 h-control px-3 box-border bg-white border border-light-tan rounded-control text-[16px] text-charcoal font-sans placeholder:text-muted focus:border-deep-brown transition-colors"
              />
              <span className="font-sans text-[12px] text-muted">
                Your client sees this on the payment page.
              </span>
            </label>
          </div>

          {formError && (
            <p className="font-sans text-[16px] text-danger mt-3">{formError}</p>
          )}

          <div className="flex gap-2 mt-4">
            <Button type="submit" disabled={saving}>
              {saving ? "Creating..." : "Create invoice"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                resetForm();
                setFormOpen(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Where she stands */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-white rounded-surface border border-light-tan p-4">
          <p className="font-sans text-[12px] text-muted uppercase tracking-[0.6px]">
            Still owed
          </p>
          <p className="font-display text-[24px] font-bold text-dark-brown mt-1 tabular-nums">
            {money(owed)}
          </p>
        </div>
        <div className="bg-white rounded-surface border border-light-tan p-4">
          <p className="font-sans text-[12px] text-muted uppercase tracking-[0.6px]">
            Collected
          </p>
          <p className="font-display text-[24px] font-bold text-dark-brown mt-1 tabular-nums">
            {money(collected)}
          </p>
        </div>
      </div>

      <div
        role="group"
        aria-label="Filter invoices"
        className="inline-flex bg-white border border-light-tan rounded-control overflow-hidden mb-4"
      >
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={`h-control px-5 text-[14px] font-sans font-semibold border-r border-light-tan last:border-r-0 transition-colors cursor-pointer ${
              filter === f.value
                ? "bg-deep-brown/10 text-deep-brown"
                : "text-charcoal hover:bg-light-tan"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {actionError && (
        <p className="font-sans text-[16px] text-danger mb-3">{actionError}</p>
      )}

      <div className="bg-white rounded-surface shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
        {loading ? (
          <div>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="px-4 sm:px-5 py-4 border-b border-light-tan last:border-b-0"
              >
                <div className="h-[16px] w-[40%] rounded-control bg-light-tan/70 animate-pulse" />
                <div className="h-[12px] w-[55%] rounded-control bg-light-tan/50 animate-pulse mt-2" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="font-sans text-[16px] text-danger font-semibold">
              Couldn&apos;t load invoices
            </p>
            <p className="font-sans text-[16px] text-muted mt-1 leading-[1.5]">
              {error}
            </p>
            <Button
              variant="secondary"
              className="mt-3"
              onClick={() => {
                setLoading(true);
                setError(null);
                fetchAll();
              }}
            >
              Retry
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <p className="font-sans text-[16px] text-charcoal font-semibold">
              {rows.length === 0
                ? "No invoices yet"
                : filter === "unpaid"
                  ? "Everyone has paid"
                  : "Nothing here"}
            </p>
            <p className="font-sans text-[16px] text-muted mt-1 leading-[1.5]">
              {rows.length === 0
                ? "Tap New invoice to send someone a link to pay their deposit."
                : filter === "unpaid"
                  ? "Nothing is outstanding right now."
                  : "Try another filter."}
            </p>
          </div>
        ) : (
          filtered.map((invoice) => (
            <div
              key={invoice.id}
              className="px-4 sm:px-5 py-4 border-b border-light-tan last:border-b-0"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {/* Every invoice is filed against a client now (the server
                      matches or creates one), so the name is the way through
                      to everything else about them. */}
                  {invoice.client_id ? (
                    <Link
                      href={`/admin/clients/${invoice.client_id}`}
                      className="font-sans text-[16px] font-semibold text-dark-brown truncate hover:underline block"
                    >
                      {invoice.client_name}
                    </Link>
                  ) : (
                    <p className="font-sans text-[16px] font-semibold text-dark-brown truncate">
                      {invoice.client_name}
                    </p>
                  )}
                  <p className="font-sans text-[16px] text-muted leading-[1.5]">
                    {invoice.description}
                  </p>
                  <p className="font-sans text-[12px] text-muted mt-1">
                    Sent {when(invoice.created_at)}
                    {invoice.due_date && ` · due ${when(invoice.due_date)}`}
                    {invoice.paid_at &&
                      ` · paid ${when(invoice.paid_at)}${
                        invoice.paid_method === "manual" ? " (marked by you)" : " by card"
                      }`}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className="font-sans text-[16px] font-semibold text-charcoal tabular-nums">
                    {money(invoice.amount)}
                  </p>
                  <span
                    className={`inline-block mt-1 px-2 py-0.5 rounded-control font-sans text-[12px] font-semibold ${
                      invoice.status === "paid"
                        ? "bg-success/10 text-success"
                        : invoice.status === "void"
                          ? "bg-light-tan text-muted"
                          : "bg-danger/10 text-danger"
                    }`}
                  >
                    {invoice.status === "paid"
                      ? "Paid"
                      : invoice.status === "void"
                        ? "Cancelled"
                        : "Not paid"}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-3">
                {invoice.status === "unpaid" && (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => copyLink(invoice)}
                    >
                      {copiedId === invoice.id ? "Link copied" : "Copy payment link"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId === invoice.id}
                      onClick={() => act(invoice, "mark_paid")}
                    >
                      Mark as paid
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId === invoice.id}
                      onClick={() => act(invoice, "void")}
                    >
                      Cancel invoice
                    </Button>
                  </>
                )}

                {invoice.status === "paid" && !invoice.square_payment_id && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busyId === invoice.id}
                    onClick={() => act(invoice, "mark_unpaid")}
                  >
                    Undo — not paid after all
                  </Button>
                )}

                {invoice.square_payment_id && (
                  <span className="font-sans text-[12px] text-muted self-center break-all">
                    Square reference {invoice.square_payment_id}
                  </span>
                )}

                {invoice.status === "void" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busyId === invoice.id}
                    onClick={() => act(invoice, "delete")}
                  >
                    Delete
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

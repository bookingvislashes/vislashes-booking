"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { Client } from "@/lib/supabase/types";
import { ClientImport } from "@/components/admin/ClientImport";

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

function formatLastVisit(value: string | null) {
  if (!value) return "No visits yet";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return `Last: ${date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const supabase = createClient();

  const fetchClients = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from("clients")
      .select("*")
      .order("last_visit_date", { ascending: false, nullsFirst: false });

    if (queryError) {
      setError(queryError.message);
      setLoading(false);
      return;
    }
    setError(null);
    setClients((data || []) as Client[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // Filtered in memory rather than round-tripping per keystroke: a single salon's
  // client list is small, and this keeps typing instant with no debounce.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.full_name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q)
    );
  }, [clients, search]);

  return (
    <div>
      <h1 className="font-display text-[28px] font-bold text-dark-brown mb-6">
        Clients
      </h1>

      <ClientImport />

      {/* Search. focus:outline-none removed — it was overriding the brand focus
          ring that globals.css deliberately restores. */}
      <input
        type="text"
        aria-label="Search clients by name, email or phone"
        placeholder="Search by name, email or phone..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-white border border-light-tan rounded-control px-3 h-control box-border text-[16px] text-charcoal font-sans placeholder:text-muted focus:border-deep-brown transition-colors mb-6"
      />

      <div className="bg-white rounded-surface shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
        {loading ? (
          <div>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 sm:px-5 py-4 border-b border-light-tan last:border-b-0"
              >
                <div className="w-10 h-10 rounded-full bg-light-tan/70 animate-pulse shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="h-[16px] w-[40%] rounded-control bg-light-tan/70 animate-pulse" />
                  <div className="h-[12px] w-[55%] rounded-control bg-light-tan/50 animate-pulse mt-2" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="font-sans text-[16px] text-danger font-semibold">
              Couldn&apos;t load clients
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
                fetchClients();
              }}
            >
              Retry
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <p className="font-sans text-[16px] text-charcoal font-semibold">
              {clients.length === 0 ? "No clients yet" : "No matches"}
            </p>
            <p className="font-sans text-[16px] text-muted mt-1">
              {clients.length === 0
                ? "Anyone who books is added here automatically."
                : `Nothing matching "${search.trim()}".`}
            </p>
          </div>
        ) : (
          filtered.map((client) => (
            <div
              key={client.id}
              className="flex items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-light-tan last:border-b-0"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-full bg-warm-beige/30 flex items-center justify-center shrink-0">
                  <span className="font-sans text-[16px] font-semibold text-deep-brown">
                    {initials(client.full_name)}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="font-sans text-[16px] font-semibold text-dark-brown truncate">
                    {client.full_name}
                  </p>
                  {/* Long unbroken addresses were forcing the page sideways at
                      375px before this truncated. */}
                  <p className="font-sans text-[16px] text-muted truncate">
                    {client.email}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-sans text-[16px] text-charcoal font-semibold tabular-nums">
                  {client.visit_count} {client.visit_count === 1 ? "visit" : "visits"}
                </p>
                <p className="font-sans text-[12px] text-muted whitespace-nowrap">
                  {formatLastVisit(client.last_visit_date)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

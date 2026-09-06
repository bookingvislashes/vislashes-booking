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
  // Read from Settings rather than assumed, so the list agrees with whatever
  // she has the program set to.
  const [loyalty, setLoyalty] = useState({ rewardAmount: 15, visitsRequired: 5 });
  /** Clients holding an unspent reward. */
  const [waiting, setWaiting] = useState<Set<string>>(new Set());

  const supabase = createClient();

  const fetchClients = useCallback(async () => {
    const [clientsRes, settingsRes, rewardsRes] = await Promise.all([
      supabase
        .from("clients")
        .select("*")
        .order("last_visit_date", { ascending: false, nullsFirst: false }),
      supabase
        .from("settings")
        .select("key, value")
        .in("key", ["loyalty_reward_amount", "loyalty_visits_required"]),
      // Who has one banked and unspent. Allowed to fail without taking the
      // page with it — before migration 019 is run this table does not exist,
      // and a client list is worth more than a loyalty badge.
      supabase
        .from("loyalty_rewards")
        .select("client_id")
        .is("redeemed_at", null),
    ]);

    if (clientsRes.error) {
      setError(clientsRes.error.message);
      setLoading(false);
      return;
    }

    const settings = Object.fromEntries(
      (settingsRes.data || []).map((row) => [
        row.key as string,
        row.value as string,
      ])
    );
    const amount = Number(settings.loyalty_reward_amount);
    const required = Number(settings.loyalty_visits_required);

    setLoyalty({
      rewardAmount: Number.isFinite(amount) && amount >= 0 ? amount : 15,
      visitsRequired:
        Number.isFinite(required) && required >= 1 ? Math.floor(required) : 5,
    });

    setWaiting(
      new Set(
        (rewardsRes.data || []).map((row) => row.client_id as string)
      )
    );

    setError(null);
    setClients((clientsRes.data || []) as Client[]);
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
                {loyalty.rewardAmount > 0 &&
                  (waiting.has(client.id) ? (
                    // The one she wants to spot before the client walks in.
                    <p className="font-sans text-[12px] font-semibold text-success whitespace-nowrap mt-0.5">
                      ${loyalty.rewardAmount} off waiting
                    </p>
                  ) : (
                    <p className="font-sans text-[12px] text-muted whitespace-nowrap mt-0.5 tabular-nums">
                      {Number(client.loyalty_visits ?? 0) % loyalty.visitsRequired}{" "}
                      of {loyalty.visitsRequired} toward ${loyalty.rewardAmount}{" "}
                      off
                    </p>
                  ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  visitCount: number;
  lastVisit: string;
}

const demoClients: Client[] = [
  { id: "1", name: "Sarah Johnson", email: "sarah@example.com", phone: "(407) 555-1234", visitCount: 5, lastVisit: "2026-02-25" },
  { id: "2", name: "Maria Lopez", email: "maria@example.com", phone: "(321) 555-5678", visitCount: 3, lastVisit: "2026-02-20" },
  { id: "3", name: "Ashley Williams", email: "ashley@example.com", phone: "(407) 555-9012", visitCount: 1, lastVisit: "2026-02-15" },
  { id: "4", name: "Jessica Davis", email: "jessica@example.com", phone: "(321) 555-3456", visitCount: 8, lastVisit: "2026-02-28" },
  { id: "5", name: "Emma Brown", email: "emma@example.com", phone: "(407) 555-7890", visitCount: 2, lastVisit: "2026-02-10" },
];

export default function ClientsPage() {
  const [search, setSearch] = useState("");

  const filtered = demoClients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <h1 className="font-display text-[28px] font-bold text-dark-brown mb-6">
        Clients
      </h1>

      {/* Search */}
      <input
        type="text"
        placeholder="Search by name or email..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-white border border-light-tan rounded-control px-3 py-2.5 text-[14px] text-charcoal font-sans placeholder:text-muted focus:outline-none focus:border-deep-brown transition-colors mb-6"
      />

      {/* Client list */}
      <div className="bg-white rounded-surface shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
        {filtered.length === 0 ? (
          <div className="p-8 text-center">
            <p className="font-sans text-[14px] text-muted">
              No clients found
            </p>
          </div>
        ) : (
          filtered.map((client) => (
            <div
              key={client.id}
              className="flex items-center justify-between px-5 py-4 border-b border-light-tan last:border-b-0"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-warm-beige/30 flex items-center justify-center">
                  <span className="font-sans text-[14px] font-semibold text-deep-brown">
                    {client.name.split(" ").map((n) => n[0]).join("")}
                  </span>
                </div>
                <div>
                  <p className="font-sans text-[14px] font-semibold text-dark-brown">
                    {client.name}
                  </p>
                  <p className="font-sans text-[13px] text-muted">
                    {client.email}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-sans text-[13px] text-charcoal font-semibold">
                  {client.visitCount} visits
                </p>
                <p className="font-sans text-[12px] text-muted">
                  Last: {client.lastVisit}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

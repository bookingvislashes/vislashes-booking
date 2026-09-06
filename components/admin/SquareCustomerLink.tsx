"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Links each client to the Square customer profile they already have, so a
 * checkout started from Today files the sale against the right person.
 *
 * Deliberately a button rather than something that runs on its own. It reads
 * her whole Square directory, and it is only worth doing after she has added
 * clients — not on a schedule nobody asked for.
 */

interface Report {
  matched: number;
  alreadyLinked: number;
  ambiguous: { clientName: string; squareProfiles: number }[];
  unmatched: number;
  squareProfiles: number;
}

export function SquareCustomerLink() {
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    setError(null);
    setReport(null);
    try {
      const res = await fetch("/api/admin/square/customers", { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Couldn't match your Square customers.");
        return;
      }
      setReport(body as Report);
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="bg-white rounded-surface shadow-[0_1px_4px_rgba(0,0,0,0.06)] p-5">
      <h2 className="font-display text-[18px] font-bold text-dark-brown">
        Square customers
      </h2>
      <p className="font-sans text-[14px] text-muted mt-1 leading-[1.5]">
        Matches your clients to the customer profiles already in Square, so
        when you check someone out their name is on the sale. It only reads
        from Square — nothing is created there, and nothing is merged.
      </p>

      <Button
        type="button"
        variant="secondary"
        className="mt-4"
        onClick={run}
        disabled={running}
      >
        {running ? "Matching…" : "Match customers"}
      </Button>

      {error && (
        <p role="alert" className="font-sans text-[14px] text-danger mt-3">
          {error}
        </p>
      )}

      {report && (
        <div className="mt-4 font-sans text-[14px] text-charcoal">
          <p>
            <strong className="text-dark-brown">{report.matched}</strong> newly
            linked, {report.alreadyLinked} already were, out of{" "}
            {report.squareProfiles} profiles in Square.
          </p>
          {report.unmatched > 0 && (
            <p className="text-muted mt-1">
              {report.unmatched} have no Square profile yet — normal for anyone
              who hasn&apos;t paid you by card. They check out fine, just
              without a name attached.
            </p>
          )}
          {report.ambiguous.length > 0 && (
            <div className="mt-3">
              <p className="text-muted">
                These have more than one profile in Square, so I left them
                alone rather than guess. Merging them in Square will sort it:
              </p>
              <ul className="mt-1 list-disc pl-5">
                {report.ambiguous.map((row) => (
                  <li key={row.clientName}>
                    {row.clientName} — {row.squareProfiles} profiles
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

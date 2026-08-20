"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";

interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  total: number;
}

/**
 * Parses a CSV in the browser, one line at a time, handling quoted fields.
 *
 * Acuity quotes any value containing a comma — notes and "Last, First" style
 * names — so splitting on commas alone shears those rows apart and shifts
 * every later column, which would file phone numbers as email addresses.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        // "" inside a quoted field is a literal quote, not the end of it.
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

/** Finds a column however Acuity happened to spell its header. */
function columnIndex(headers: string[], ...candidates: string[]): number {
  const normalised = headers.map((h) =>
    h.trim().toLowerCase().replace(/[^a-z]/g, "")
  );
  for (const candidate of candidates) {
    const want = candidate.toLowerCase().replace(/[^a-z]/g, "");
    const found = normalised.indexOf(want);
    if (found !== -1) return found;
  }
  return -1;
}

export function ClientImport() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setBusy(true);
    setError(null);
    setResult(null);

    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.length < 2) {
        throw new Error("That file has no rows in it.");
      }

      const headers = parsed[0];
      const iFirst = columnIndex(headers, "First Name", "First");
      const iLast = columnIndex(headers, "Last Name", "Last");
      const iEmail = columnIndex(headers, "Email");
      const iPhone = columnIndex(headers, "Phone");
      const iNotes = columnIndex(headers, "Notes");
      const iDays = columnIndex(headers, "Days Since Last Appointment");

      if (iEmail === -1 && iPhone === -1) {
        throw new Error(
          "I couldn't find an Email or Phone column — is this the client list export?"
        );
      }

      const at = (row: string[], i: number) =>
        i === -1 ? "" : (row[i] ?? "").trim();

      const rows = parsed.slice(1).map((row) => ({
        firstName: at(row, iFirst),
        lastName: at(row, iLast),
        email: at(row, iEmail),
        phone: at(row, iPhone),
        notes: at(row, iNotes),
        daysSinceLastAppointment: at(row, iDays),
      }));

      const res = await fetch("/api/admin/import-clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed.");

      setResult(data as ImportResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that file.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-surface p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] mb-6">
      <h2 className="font-display text-[18px] font-bold text-dark-brown mb-1">
        Import Clients
      </h2>
      <p className="font-sans text-[13px] text-muted mb-4 max-w-[52ch]">
        Upload the client list exported from Acuity. Anyone already here is
        updated rather than duplicated, so it&apos;s safe to run again after
        another export.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="secondary"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? "Importing..." : "Choose CSV file"}
      </Button>

      {result && (
        <div className="mt-4">
          <p className="font-sans text-[14px] text-success font-semibold">
            Imported {result.created + result.updated} of {result.total}
          </p>
          <p className="font-sans text-[13px] text-muted mt-1 leading-[1.5]">
            {result.created} added, {result.updated} already here and updated
            {result.skipped > 0
              ? `, ${result.skipped} skipped for having no name, email or phone`
              : ""}
            .
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="font-sans text-[13px] text-danger mt-3">
          {error}
        </p>
      )}
    </div>
  );
}

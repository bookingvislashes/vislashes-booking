"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import {
  formatSignedOn,
  kindLabel,
  signedUrlFor,
} from "@/lib/client-documents";

/**
 * Every agreement on file, however it was signed.
 *
 * Two sources feed this. The booking flow writes an `agreements` row with a
 * drawn signature; the years of paper forms signed on the iPad are uploaded
 * as PDFs into `client_documents`. They used to be two unrelated things, and
 * only the first of them was visible anywhere — so a client who signed on
 * paper looked, from in here, like a client who had never signed at all.
 */

interface AgreementRow {
  id: string;
  signed_at: string;
  filming_consent: boolean;
  liability_waiver_signed: boolean;
  terms_accepted: boolean;
  signature_data: string;
  client: { id: string; full_name: string; email: string } | null;
}

interface DocumentRow {
  id: string;
  client_id: string;
  kind: string;
  storage_path: string;
  file_name: string;
  signed_on: string | null;
  uploaded_at: string;
  client: { id: string; full_name: string } | null;
}

/** One list, two shapes. `sortKey` is what puts them in one order. */
type Entry =
  | { type: "online"; sortKey: string; row: AgreementRow }
  | { type: "uploaded"; sortKey: string; row: DocumentRow };

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[12px] font-semibold font-sans text-deep-brown bg-deep-brown/15 px-2.5 py-1 rounded-full whitespace-nowrap">
      {children}
    </span>
  );
}

function formatSigned(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AgreementsPage() {
  const [agreements, setAgreements] = useState<AgreementRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AgreementRow | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const supabase = createClient();

  const fetchAll = useCallback(async () => {
    const [agreementsRes, documentsRes] = await Promise.all([
      supabase
        .from("agreements")
        .select(
          "id, signed_at, filming_consent, liability_waiver_signed, terms_accepted, signature_data, client:clients(id, full_name, email)"
        )
        .order("signed_at", { ascending: false }),
      supabase
        .from("client_documents")
        .select(
          "id, client_id, kind, storage_path, file_name, signed_on, uploaded_at, client:clients(id, full_name)"
        )
        .order("signed_on", { ascending: false, nullsFirst: false }),
    ]);

    if (agreementsRes.error) {
      setError(agreementsRes.error.message);
      setLoading(false);
      return;
    }

    // Supabase returns an embedded row as an array when it can't prove the
    // relationship is to-one, so it gets normalised here rather than at every
    // read site.
    setAgreements(
      (agreementsRes.data || []).map((a) => ({
        ...a,
        client: Array.isArray(a.client) ? a.client[0] : a.client,
      })) as AgreementRow[]
    );

    // A missing client_documents table means migration 020 hasn't been run
    // yet. That should leave the online agreements working, not blank the
    // page, so this error is swallowed rather than surfaced.
    setDocuments(
      documentsRes.error
        ? []
        : ((documentsRes.data || []).map((d) => ({
            ...d,
            client: Array.isArray(d.client) ? d.client[0] : d.client,
          })) as DocumentRow[])
    );

    setError(null);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const entries = useMemo<Entry[]>(() => {
    const online: Entry[] = agreements.map((row) => ({
      type: "online",
      sortKey: row.signed_at,
      row,
    }));
    const uploaded: Entry[] = documents.map((row) => ({
      type: "uploaded",
      // An undated form falls back to when it was uploaded, so it still sorts
      // somewhere sensible instead of to the very bottom forever.
      sortKey: row.signed_on ? `${row.signed_on}T12:00:00` : row.uploaded_at,
      row,
    }));
    return [...online, ...uploaded].sort((a, b) =>
      a.sortKey < b.sortKey ? 1 : -1
    );
  }, [agreements, documents]);

  async function openDocument(doc: DocumentRow) {
    // Opened synchronously, before the await, or Safari blocks it as a popup.
    const tab = window.open("", "_blank");
    setOpeningId(doc.id);
    const url = await signedUrlFor(supabase, doc.storage_path);
    setOpeningId(null);
    if (!url) {
      tab?.close();
      setError("Couldn't open that file.");
      return;
    }
    if (tab) tab.location.href = url;
    else window.location.assign(url);
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-6">
        <div className="min-w-0">
          <h1 className="font-display text-[28px] font-bold text-dark-brown">
            Signed Agreements
          </h1>
          <p className="font-sans text-[13px] text-muted">
            {loading
              ? "Loading…"
              : `${entries.length} on file${
                  documents.length
                    ? ` · ${documents.length} uploaded from paper`
                    : ""
                }`}
          </p>
        </div>
        <Link
          href="/admin/agreements/import"
          className="shrink-0 inline-flex items-center justify-center box-border h-control px-5 rounded-control border-2 border-transparent bg-text-brown text-white font-sans text-[14px] font-semibold hover:bg-deep-brown transition-colors"
        >
          Import forms
        </Link>
      </div>

      <div className="bg-white rounded-surface shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
        {loading ? (
          <div>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="px-4 sm:px-5 py-4 border-b border-light-tan last:border-b-0"
              >
                <div className="h-[16px] w-[40%] rounded-control bg-light-tan/70 animate-pulse" />
                <div className="h-[12px] w-[28%] rounded-control bg-light-tan/50 animate-pulse mt-2" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="px-5 py-10 text-center">
            <p className="font-sans text-[16px] text-danger font-semibold">
              Couldn&apos;t load agreements
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
        ) : entries.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="font-sans text-[16px] text-charcoal font-semibold">
              No signed agreements yet
            </p>
            <p className="font-sans text-[16px] text-muted mt-1 leading-[1.5]">
              Anyone booking online signs one on the way through. Forms signed
              on paper go in with Import forms.
            </p>
          </div>
        ) : (
          entries.map((entry) => {
            const clientName =
              entry.row.client?.full_name || "Unknown client";
            const clientId = entry.row.client?.id;
            return (
              <div
                key={`${entry.type}-${entry.row.id}`}
                className="flex items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-light-tan last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  {/* The name goes to the profile — the agreement is rarely
                      the only thing being looked for. */}
                  {clientId ? (
                    <Link
                      href={`/admin/clients/${clientId}`}
                      className="font-sans text-[16px] font-semibold text-dark-brown truncate hover:underline block"
                    >
                      {clientName}
                    </Link>
                  ) : (
                    <p className="font-sans text-[16px] font-semibold text-dark-brown truncate">
                      {clientName}
                    </p>
                  )}

                  {entry.type === "online" ? (
                    <>
                      <p className="font-sans text-[12px] text-muted truncate">
                        Signed online {formatSigned(entry.row.signed_at)}
                      </p>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {entry.row.filming_consent && <Pill>Filming</Pill>}
                        {entry.row.liability_waiver_signed && <Pill>Waiver</Pill>}
                        {entry.row.terms_accepted && <Pill>Terms</Pill>}
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="font-sans text-[12px] text-muted truncate">
                        {kindLabel(entry.row.kind)} ·{" "}
                        {formatSignedOn(entry.row.signed_on)}
                      </p>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        <Pill>Paper</Pill>
                      </div>
                    </>
                  )}
                </div>

                {entry.type === "online" ? (
                  <button
                    type="button"
                    onClick={() => setSelected(entry.row)}
                    aria-label={`View agreement for ${clientName}`}
                    className="shrink-0 ml-3 min-h-11 px-3 -mr-3 inline-flex items-center rounded-control font-sans text-[16px] text-deep-brown font-semibold hover:underline transition-transform active:scale-[0.97]"
                  >
                    View
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => openDocument(entry.row as DocumentRow)}
                    disabled={openingId === entry.row.id}
                    aria-label={`Open the form signed by ${clientName}`}
                    className="shrink-0 ml-3 min-h-11 px-3 -mr-3 inline-flex items-center rounded-control font-sans text-[16px] text-deep-brown font-semibold hover:underline disabled:opacity-50 transition-transform active:scale-[0.97]"
                  >
                    {openingId === entry.row.id ? "Opening…" : "View"}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      <Modal
        isOpen={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.client?.full_name || "Agreement"}
      >
        {selected && (
          // print-agreement is the only thing left visible by the @media print
          // rule in globals.css, so Print produces the agreement on its own
          // rather than the whole admin screen. On iOS that is Share > Print >
          // pinch out to save as PDF.
          <div className="print-agreement">
            <p className="font-sans text-[16px] text-muted">
              {selected.client?.email}
            </p>
            <p className="font-sans text-[12px] text-muted mt-0.5">
              Signed {formatSigned(selected.signed_at)}
            </p>

            <dl className="mt-4 border-t border-light-tan divide-y divide-light-tan">
              {[
                ["Filming consent", selected.filming_consent],
                ["Liability waiver", selected.liability_waiver_signed],
                ["Terms accepted", selected.terms_accepted],
              ].map(([label, value]) => (
                <div
                  key={label as string}
                  className="flex items-center justify-between py-2.5"
                >
                  <dt className="font-sans text-[16px] text-charcoal">
                    {label}
                  </dt>
                  <dd
                    className={`font-sans text-[16px] font-semibold ${
                      value ? "text-success" : "text-muted"
                    }`}
                  >
                    {value ? "Yes" : "No"}
                  </dd>
                </div>
              ))}
            </dl>

            <p className="font-sans text-[12px] text-muted font-semibold uppercase tracking-wider mt-5 mb-2">
              Signature
            </p>
            {selected.signature_data ? (
              // A PNG data URL written by the signature canvas at booking time.
              // Plain <img>: next/image cannot optimise a data URL, and there is
              // nothing to optimise.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selected.signature_data}
                alt={`Signature of ${selected.client?.full_name || "client"}`}
                className="w-full max-w-[360px] border border-light-tan rounded-control bg-white"
              />
            ) : (
              <p className="font-sans text-[16px] text-muted">
                No signature was captured.
              </p>
            )}

            <div className="mt-5 print:hidden">
              <Button onClick={() => window.print()}>Print / Save as PDF</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

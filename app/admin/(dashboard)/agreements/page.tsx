"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

interface AgreementRow {
  id: string;
  signed_at: string;
  filming_consent: boolean;
  liability_waiver_signed: boolean;
  terms_accepted: boolean;
  signature_data: string;
  client: { full_name: string; email: string } | null;
}

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AgreementRow | null>(null);

  const supabase = createClient();

  const fetchAgreements = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from("agreements")
      .select(
        "id, signed_at, filming_consent, liability_waiver_signed, terms_accepted, signature_data, client:clients(full_name, email)"
      )
      .order("signed_at", { ascending: false });

    if (queryError) {
      setError(queryError.message);
      setLoading(false);
      return;
    }

    // Supabase returns an embedded row as an array when it can't prove the
    // relationship is to-one, so it gets normalised here rather than at every
    // read site.
    const rows = (data || []).map((a) => ({
      ...a,
      client: Array.isArray(a.client) ? a.client[0] : a.client,
    })) as AgreementRow[];

    setError(null);
    setAgreements(rows);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchAgreements();
  }, [fetchAgreements]);

  return (
    <div>
      <h1 className="font-display text-[28px] font-bold text-dark-brown mb-6">
        Signed Agreements
      </h1>

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
                fetchAgreements();
              }}
            >
              Retry
            </Button>
          </div>
        ) : agreements.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="font-sans text-[16px] text-charcoal font-semibold">
              No signed agreements yet
            </p>
            <p className="font-sans text-[16px] text-muted mt-1">
              Each client signs one while booking, and it appears here.
            </p>
          </div>
        ) : (
          agreements.map((agreement) => (
            <div
              key={agreement.id}
              className="flex items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-light-tan last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <p className="font-sans text-[16px] font-semibold text-dark-brown truncate">
                  {agreement.client?.full_name || "Unknown client"}
                </p>
                <p className="font-sans text-[12px] text-muted truncate">
                  Signed {formatSigned(agreement.signed_at)}
                </p>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {agreement.filming_consent && <Pill>Filming</Pill>}
                  {agreement.liability_waiver_signed && <Pill>Waiver</Pill>}
                  {agreement.terms_accepted && <Pill>Terms</Pill>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(agreement)}
                aria-label={`View agreement for ${
                  agreement.client?.full_name || "unknown client"
                }`}
                className="shrink-0 ml-3 min-h-11 px-3 -mr-3 inline-flex items-center rounded-control font-sans text-[16px] text-deep-brown font-semibold hover:underline transition-transform active:scale-[0.97]"
              >
                View
              </button>
            </div>
          ))
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

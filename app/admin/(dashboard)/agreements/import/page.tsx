"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  ACCEPTED_TYPES,
  DOCUMENTS_BUCKET,
  DOCUMENT_KINDS,
  MAX_DOCUMENT_BYTES,
  formatBytes,
  isAcceptedType,
  storagePathFor,
  type DocumentKind,
} from "@/lib/client-documents";

/**
 * Importing the years of consent and medical health forms signed on paper.
 *
 * Built for doing all of them in one sitting rather than one at a time: pick
 * every file at once, then work down the list naming who each one belongs to.
 * The forms exported from Pages are numbered, not named, so there is nothing
 * in a filename to match on — Preview opens the actual page so she can read
 * the signature instead of guessing from "consent_form_41.pdf".
 *
 * Anything a filename DOES match is filled in anyway, because a few of them
 * may well have been saved under a client's name.
 */

interface ClientOption {
  id: string;
  full_name: string;
  email: string | null;
}

type RowState = "ready" | "uploading" | "done" | "failed";

interface Row {
  key: string;
  file: File;
  /** The typed name, matched against `labelToId` to resolve a client. */
  clientLabel: string;
  kind: DocumentKind;
  signedOn: string;
  state: RowState;
  message: string | null;
}

let rowCounter = 0;

export default function ImportFormsPage() {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  // Defaults applied to each newly picked file, so a batch signed the same
  // day is one date typed rather than fifty-nine.
  const [defaultKind, setDefaultKind] = useState<DocumentKind>("consent");
  const [defaultDate, setDefaultDate] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error: queryError } = await supabase
        .from("clients")
        .select("id, full_name, email")
        .order("full_name");
      if (cancelled) return;
      if (queryError) setError(queryError.message);
      else setClients((data || []) as ClientOption[]);
      setLoadingClients(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // A client is picked by typing their name, so each one needs a label that
  // is unique. Two people called Maria get their email appended; everyone
  // else stays just their name.
  const { labels, labelToId } = useMemo(() => {
    const nameCounts = new Map<string, number>();
    for (const c of clients) {
      const key = c.full_name.toLowerCase();
      nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
    }
    const map = new Map<string, string>();
    const list: string[] = [];
    for (const c of clients) {
      const duplicated = (nameCounts.get(c.full_name.toLowerCase()) ?? 0) > 1;
      const label =
        duplicated && c.email ? `${c.full_name} (${c.email})` : c.full_name;
      map.set(label.toLowerCase(), c.id);
      list.push(label);
    }
    return { labels: list, labelToId: map };
  }, [clients]);

  const resolve = useCallback(
    (label: string) => labelToId.get(label.trim().toLowerCase()) ?? null,
    [labelToId]
  );

  /** A filename that happens to contain a client's name fills that row in. */
  const guessFromFileName = useCallback(
    (fileName: string) => {
      const haystack = fileName.toLowerCase().replace(/[_-]+/g, " ");
      const hit = clients.find((c) => {
        const name = c.full_name.trim().toLowerCase();
        return name.length > 3 && haystack.includes(name);
      });
      return hit?.full_name ?? "";
    },
    [clients]
  );

  function addFiles(files: FileList | null) {
    if (!files) return;
    const next: Row[] = [];
    const rejected: string[] = [];

    for (const file of Array.from(files)) {
      if (!isAcceptedType(file)) {
        rejected.push(`${file.name} isn't a PDF or a photo.`);
        continue;
      }
      if (file.size > MAX_DOCUMENT_BYTES) {
        rejected.push(`${file.name} is over 25MB.`);
        continue;
      }
      next.push({
        key: `row-${rowCounter++}`,
        file,
        clientLabel: guessFromFileName(file.name),
        kind: defaultKind,
        signedOn: defaultDate,
        state: "ready",
        message: null,
      });
    }

    setRows((current) => [...current, ...next]);
    setError(rejected.length ? rejected.join(" ") : null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function update(key: string, patch: Partial<Row>) {
    setRows((current) =>
      current.map((r) => (r.key === key ? { ...r, ...patch } : r))
    );
  }

  function preview(row: Row) {
    // A blob URL of the file already in memory — nothing is uploaded to look
    // at it, so she can read a form before deciding whose it is.
    const url = URL.createObjectURL(row.file);
    window.open(url, "_blank");
    // Revoked on a delay rather than immediately: revoking before the new tab
    // has fetched it leaves her with a blank page.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  const pending = rows.filter((r) => r.state === "ready" || r.state === "failed");
  const unassigned = pending.filter((r) => !resolve(r.clientLabel));
  const uploaded = rows.filter((r) => r.state === "done").length;

  async function uploadAll() {
    setRunning(true);
    setError(null);

    for (const row of rows) {
      if (row.state === "done") continue;

      const clientId = resolve(row.clientLabel);
      if (!clientId) {
        update(row.key, {
          state: "failed",
          message: "Pick who this belongs to.",
        });
        continue;
      }

      update(row.key, { state: "uploading", message: null });

      const path = storagePathFor(clientId, row.file.name);
      const { error: uploadErr } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .upload(path, row.file, { cacheControl: "3600", upsert: false });

      if (uploadErr) {
        update(row.key, { state: "failed", message: uploadErr.message });
        continue;
      }

      const { error: insertErr } = await supabase
        .from("client_documents")
        .insert({
          client_id: clientId,
          kind: row.kind,
          storage_path: path,
          file_name: row.file.name,
          mime_type: row.file.type || null,
          byte_size: row.file.size,
          signed_on: row.signedOn || null,
        });

      if (insertErr) {
        // Don't leave a file in the bucket that nothing points at.
        await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
        update(row.key, { state: "failed", message: insertErr.message });
        continue;
      }

      update(row.key, { state: "done", message: null });
    }

    setRunning(false);
  }

  return (
    <div className="max-w-[820px]">
      <Link
        href="/admin/agreements"
        className="font-sans text-[14px] text-deep-brown font-semibold inline-block mb-3"
      >
        ← Signed Agreements
      </Link>

      <h1 className="font-display text-[28px] font-bold text-dark-brown">
        Import signed forms
      </h1>
      <p className="font-sans text-[15px] text-muted leading-[1.6] mt-1 max-w-[62ch]">
        For the consent and medical health forms signed on paper. On the iPad,
        open Pages, select the documents, then Export as PDF — the signature is
        only part of the file once it&apos;s a PDF. Pick them all here at once
        and say who each one belongs to.
      </p>

      {/* Defaults, set once and carried onto each file picked after. */}
      <div className="bg-white rounded-surface shadow-[0_1px_4px_rgba(0,0,0,0.06)] p-4 sm:p-5 mt-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="font-sans text-[12px] font-semibold text-dark-brown">
              These are mostly
            </span>
            <select
              value={defaultKind}
              onChange={(e) => setDefaultKind(e.target.value as DocumentKind)}
              className="w-full mt-1 h-control px-3 bg-white border border-light-tan rounded-control text-[16px] md:text-[14px] text-charcoal font-sans cursor-pointer"
            >
              {DOCUMENT_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="font-sans text-[12px] font-semibold text-dark-brown">
              Date to start each one at
            </span>
            <input
              type="date"
              value={defaultDate}
              onChange={(e) => setDefaultDate(e.target.value)}
              className="w-full mt-1 h-control px-3 box-border bg-white border border-light-tan rounded-control text-[16px] md:text-[14px] text-charcoal font-sans focus:border-deep-brown transition-colors"
            />
          </label>
        </div>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_TYPES}
          onChange={(e) => addFiles(e.target.files)}
          className="hidden"
        />
        <Button
          className="mt-4 w-full sm:w-auto"
          onClick={() => inputRef.current?.click()}
          disabled={loadingClients || running}
        >
          {rows.length === 0 ? "Choose files" : "Add more files"}
        </Button>
        {loadingClients && (
          <p className="font-sans text-[13px] text-muted mt-2">
            Loading your client list…
          </p>
        )}
      </div>

      {error && (
        <p className="font-sans text-[14px] text-danger mt-3 leading-[1.5]">
          {error}
        </p>
      )}

      {rows.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-3 mt-6 mb-2">
            <p className="font-sans text-[13px] text-muted">
              {rows.length} {rows.length === 1 ? "file" : "files"}
              {uploaded > 0 ? ` · ${uploaded} imported` : ""}
              {unassigned.length > 0
                ? ` · ${unassigned.length} still need a name`
                : ""}
            </p>
            {rows.some((r) => r.state === "done") && (
              <button
                type="button"
                onClick={() =>
                  setRows((current) => current.filter((r) => r.state !== "done"))
                }
                className="font-sans text-[13px] text-muted hover:text-charcoal cursor-pointer"
              >
                Clear imported
              </button>
            )}
          </div>

          <datalist id="client-names">
            {labels.map((label) => (
              <option key={label} value={label} />
            ))}
          </datalist>

          <div className="flex flex-col gap-2">
            {rows.map((row) => {
              const resolved = resolve(row.clientLabel);
              return (
                <div
                  key={row.key}
                  className={`bg-white rounded-surface shadow-[0_1px_4px_rgba(0,0,0,0.06)] p-3 sm:p-4 ${
                    row.state === "done" ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-sans text-[14px] font-semibold text-dark-brown truncate">
                        {row.file.name}
                      </p>
                      <p className="font-sans text-[12px] text-muted">
                        {formatBytes(row.file.size)}
                        {row.state === "done" ? " · Imported" : ""}
                        {row.state === "uploading" ? " · Uploading…" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => preview(row)}
                        className="min-h-11 px-3 inline-flex items-center font-sans text-[14px] font-semibold text-deep-brown cursor-pointer"
                      >
                        Preview
                      </button>
                      {row.state !== "done" && (
                        <button
                          type="button"
                          onClick={() =>
                            setRows((c) => c.filter((r) => r.key !== row.key))
                          }
                          aria-label={`Remove ${row.file.name}`}
                          disabled={running}
                          className="min-h-11 px-3 inline-flex items-center font-sans text-[14px] text-muted hover:text-danger disabled:opacity-50 cursor-pointer"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  {row.state !== "done" && (
                    <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr] mt-2">
                      <label className="block">
                        <span className="sr-only">
                          Client for {row.file.name}
                        </span>
                        <input
                          list="client-names"
                          value={row.clientLabel}
                          onChange={(e) =>
                            update(row.key, {
                              clientLabel: e.target.value,
                              state: "ready",
                              message: null,
                            })
                          }
                          placeholder="Start typing a client's name"
                          className={`w-full h-control px-3 box-border bg-white border rounded-control text-[16px] md:text-[14px] text-charcoal font-sans placeholder:text-muted transition-colors ${
                            row.clientLabel && !resolved
                              ? "border-danger"
                              : resolved
                              ? "border-success"
                              : "border-light-tan"
                          }`}
                        />
                      </label>
                      <label className="block">
                        <span className="sr-only">
                          Date signed for {row.file.name}
                        </span>
                        <input
                          type="date"
                          value={row.signedOn}
                          onChange={(e) =>
                            update(row.key, { signedOn: e.target.value })
                          }
                          className="w-full h-control px-3 box-border bg-white border border-light-tan rounded-control text-[16px] md:text-[14px] text-charcoal font-sans focus:border-deep-brown transition-colors"
                        />
                      </label>
                      <label className="block">
                        <span className="sr-only">
                          Kind of form for {row.file.name}
                        </span>
                        <select
                          value={row.kind}
                          onChange={(e) =>
                            update(row.key, {
                              kind: e.target.value as DocumentKind,
                            })
                          }
                          className="w-full h-control px-3 bg-white border border-light-tan rounded-control text-[16px] md:text-[14px] text-charcoal font-sans cursor-pointer"
                        >
                          {DOCUMENT_KINDS.map((k) => (
                            <option key={k.value} value={k.value}>
                              {k.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  )}

                  {row.clientLabel && !resolved && row.state !== "done" && (
                    <p className="font-sans text-[12px] text-muted mt-1.5">
                      No client called that. Pick one from the list — add them
                      under Clients first if they aren&apos;t there.
                    </p>
                  )}
                  {row.message && (
                    <p className="font-sans text-[12px] text-danger mt-1.5">
                      {row.message}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Sticky so the button stays reachable at the bottom of 59 rows.
              The offset clears the phone's tab bar and its home indicator. */}
          <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-4 mt-4">
            <Button
              size="lg"
              className="w-full shadow-[0_2px_10px_rgba(0,0,0,0.12)]"
              onClick={uploadAll}
              disabled={running || pending.length === 0 || unassigned.length > 0}
            >
              {running
                ? "Importing…"
                : unassigned.length > 0
                ? `${unassigned.length} still need a name`
                : `Import ${pending.length} ${
                    pending.length === 1 ? "form" : "forms"
                  }`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

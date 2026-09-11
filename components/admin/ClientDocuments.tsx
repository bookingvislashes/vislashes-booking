"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { DocumentPreview } from "@/components/admin/DocumentPreview";
import { createClient } from "@/lib/supabase/client";
import type { ClientDocument } from "@/lib/supabase/types";
import {
  ACCEPTED_TYPES,
  DOCUMENTS_BUCKET,
  DOCUMENT_KINDS,
  MAX_DOCUMENT_BYTES,
  formatBytes,
  formatSignedOn,
  isAcceptedType,
  kindLabel,
  storagePathFor,
  type DocumentKind,
} from "@/lib/client-documents";

/**
 * The forms kept against one client — consent, medical health, anything else.
 *
 * Preview opens the form in a dialog with Open, Print and Download on it, so
 * the four things she does with a form are all one tap from the profile
 * rather than a trip through the browser's own viewer. See DocumentPreview
 * for why printing takes a different route on the iPad than on a desktop.
 */

interface Props {
  clientId: string;
  clientName: string;
}

export function ClientDocuments({ clientId, clientName }: Props) {
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [kind, setKind] = useState<DocumentKind>("consent");
  const [signedOn, setSignedOn] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<ClientDocument | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const fetchDocuments = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from("client_documents")
      .select("*")
      .eq("client_id", clientId)
      .order("signed_on", { ascending: false, nullsFirst: false })
      .order("uploaded_at", { ascending: false });

    if (queryError) {
      setError(queryError.message);
      setLoading(false);
      return;
    }
    setError(null);
    setDocuments((data || []) as ClientDocument[]);
    setLoading(false);
  }, [supabase, clientId]);

  useEffect(() => {
    // Kicked off inside an async closure rather than called straight from the
    // effect body: nothing here sets state until after the first await, which
    // is what keeps this off the cascading-render path the other admin screens
    // are still on.
    void (async () => {
      await fetchDocuments();
    })();
  }, [fetchDocuments]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadError(null);
    setUploading(true);

    const chosen = Array.from(files);
    const problems: string[] = [];

    for (const file of chosen) {
      if (!isAcceptedType(file)) {
        problems.push(`${file.name} isn't a PDF or a photo.`);
        continue;
      }
      if (file.size > MAX_DOCUMENT_BYTES) {
        problems.push(`${file.name} is over 25MB.`);
        continue;
      }

      const path = storagePathFor(clientId, file.name);
      const { error: uploadErr } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .upload(path, file, { cacheControl: "3600", upsert: false });

      if (uploadErr) {
        problems.push(`${file.name}: ${uploadErr.message}`);
        continue;
      }

      const { error: insertErr } = await supabase
        .from("client_documents")
        .insert({
          client_id: clientId,
          kind,
          storage_path: path,
          file_name: file.name,
          mime_type: file.type || null,
          byte_size: file.size,
          signed_on: signedOn || null,
        });

      if (insertErr) {
        // The file is in the bucket but nothing points at it, so it is taken
        // back out rather than left behind as an orphan nobody can find.
        await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
        problems.push(`${file.name}: ${insertErr.message}`);
      }
    }

    setUploading(false);
    setUploadError(problems.length ? problems.join(" ") : null);
    if (inputRef.current) inputRef.current.value = "";
    await fetchDocuments();
  }

  async function remove(doc: ClientDocument) {
    if (
      !window.confirm(
        `Delete ${doc.file_name}? The file itself is removed too, and this can't be undone.`
      )
    ) {
      return;
    }
    setBusyId(doc.id);
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([doc.storage_path]);
    const { error: deleteErr } = await supabase
      .from("client_documents")
      .delete()
      .eq("id", doc.id);
    setBusyId(null);
    if (deleteErr) {
      setError(deleteErr.message);
      return;
    }
    await fetchDocuments();
  }

  return (
    <section className="bg-white rounded-surface shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
      <header className="px-4 sm:px-5 py-3 border-b border-light-tan">
        <h2 className="font-display text-[18px] font-bold text-dark-brown">
          Consent &amp; medical forms
        </h2>
        <p className="font-sans text-[13px] text-muted leading-[1.5] mt-0.5">
          Signed on paper or online. Only you can open these — each link is
          made when you tap View and stops working an hour later.
        </p>
      </header>

      {/* Upload. The kind and the date are set before picking, so uploading
          several forms for one client is one pass rather than a form per file. */}
      <div className="px-4 sm:px-5 py-4 border-b border-light-tan bg-cream/40">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="font-sans text-[12px] font-semibold text-dark-brown">
              What kind of form
            </span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as DocumentKind)}
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
              Date signed
            </span>
            <input
              type="date"
              value={signedOn}
              onChange={(e) => setSignedOn(e.target.value)}
              className="w-full mt-1 h-control px-3 box-border bg-white border border-light-tan rounded-control text-[16px] md:text-[14px] text-charcoal font-sans focus:border-deep-brown transition-colors"
            />
          </label>
        </div>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_TYPES}
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
        <Button
          variant="secondary"
          className="mt-3 w-full sm:w-auto"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? "Uploading…" : "Add a form"}
        </Button>

        {uploadError && (
          <p className="font-sans text-[13px] text-danger mt-2 leading-[1.5]">
            {uploadError}
          </p>
        )}
      </div>

      {loading ? (
        <div className="px-4 sm:px-5 py-6">
          <div className="h-[14px] w-1/3 rounded-control bg-light-tan/70 animate-pulse" />
        </div>
      ) : error ? (
        <p className="px-4 sm:px-5 py-5 font-sans text-[14px] text-danger">
          {error}
        </p>
      ) : documents.length === 0 ? (
        <p className="px-4 sm:px-5 py-6 font-sans text-[15px] text-muted leading-[1.5]">
          Nothing uploaded for {clientName.split(" ")[0]} yet.
        </p>
      ) : (
        <ul>
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center gap-3 px-4 sm:px-5 py-3.5 border-b border-light-tan last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <p className="font-sans text-[15px] font-semibold text-dark-brown">
                  {kindLabel(doc.kind)}
                </p>
                <p className="font-sans text-[13px] text-muted">
                  {formatSignedOn(doc.signed_on)}
                </p>
                <p className="font-sans text-[12px] text-muted/80 truncate">
                  {doc.file_name}
                  {doc.byte_size ? ` · ${formatBytes(doc.byte_size)}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setPreviewing(doc)}
                  className="min-h-11 px-3 inline-flex items-center rounded-control font-sans text-[15px] font-semibold text-deep-brown hover:underline cursor-pointer"
                >
                  View
                </button>
                <button
                  type="button"
                  onClick={() => remove(doc)}
                  disabled={busyId === doc.id}
                  aria-label={`Delete ${doc.file_name}`}
                  className="min-h-11 px-3 inline-flex items-center rounded-control font-sans text-[15px] text-muted hover:text-danger disabled:opacity-50 cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <DocumentPreview
        doc={previewing}
        clientName={clientName}
        onClose={() => setPreviewing(null)}
      />
    </section>
  );
}

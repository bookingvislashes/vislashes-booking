"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { createClient } from "@/lib/supabase/client";
import {
  formatBytes,
  formatSignedOn,
  isImageDocument,
  isPdfDocument,
  kindLabel,
  signedUrlFor,
} from "@/lib/client-documents";

/**
 * One stored form, on screen, with the four things she actually does with it:
 * read it, open it full screen, print it, save it.
 *
 * Everything here runs off a signed URL minted when the dialog opens and dead
 * an hour later — the bucket is private, so there is no durable link to a
 * medical form anywhere, not even in this component's state after a reload.
 *
 * Printing is the part that differs by device, and it is worth saying why:
 *
 *   - An image is printed by the `.print-agreement` rule in globals.css, which
 *     hides the rest of the admin. That works on every device including the
 *     iPad.
 *   - A PDF can't be printed that way — the browser prints the page, not the
 *     embedded document. On a desktop it is fetched into a blob (same-origin,
 *     unlike the Supabase URL) and printed from a hidden frame.
 *   - iOS Safari ignores print() on a frame holding a PDF. Rather than a
 *     button that silently does nothing, it opens the file and says to use
 *     Share > Print, which is how printing works on that device anyway.
 */

export interface PreviewableDocument {
  id: string;
  kind: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  byte_size: number | null;
  signed_on: string | null;
}

interface Props {
  doc: PreviewableDocument | null;
  /** Shown in the dialog title, so a form opened from the Agreements list
   *  still says whose it is. */
  clientName?: string;
  onClose: () => void;
}

/** iPadOS reports itself as a Mac, so the touch points are what separate an
 *  iPad from a desktop Safari that would print a PDF frame perfectly well. */
function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (/Mac/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
  );
}

export function DocumentPreview({ doc, clientName, onClose }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"print" | "download" | null>(null);

  // Frames and blob URLs made for printing, cleaned up when the dialog closes
  // rather than on a timer that outlives it.
  const cleanupRef = useRef<(() => void)[]>([]);

  const supabase = createClient();

  const isImage = doc ? isImageDocument(doc) : false;
  const isPdf = doc ? isPdfDocument(doc) : false;

  useEffect(() => {
    if (!doc) {
      setUrl(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      const signed = await signedUrlFor(supabase, doc.storage_path);
      if (cancelled) return;
      if (!signed) setError("Couldn't open that file.");
      setUrl(signed);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // `supabase` is a fresh client object each render; keying on the document
    // is what stops this re-minting a URL on every keystroke elsewhere.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.storage_path]);

  useEffect(() => {
    return () => {
      for (const fn of cleanupRef.current) fn();
      cleanupRef.current = [];
    };
  }, []);

  const open = useCallback(() => {
    if (url) window.open(url, "_blank");
  }, [url]);

  const print = useCallback(async () => {
    if (!doc || !url) return;

    // An image prints through the stylesheet, which is the one route that
    // works on the iPad as well as a desktop.
    if (isImage) {
      window.print();
      return;
    }

    if (isIOS()) {
      // Opening it is the print button on this device — the viewer's Share
      // sheet has Print, and print() on a PDF frame here does nothing at all.
      window.open(url, "_blank");
      return;
    }

    setBusy("print");
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("fetch failed");
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const frame = document.createElement("iframe");
      frame.setAttribute("aria-hidden", "true");
      frame.style.position = "fixed";
      frame.style.width = "0";
      frame.style.height = "0";
      frame.style.border = "0";
      frame.style.right = "0";
      frame.style.bottom = "0";
      frame.onload = () => {
        try {
          frame.contentWindow?.focus();
          frame.contentWindow?.print();
        } catch {
          window.open(blobUrl, "_blank");
        }
      };
      frame.src = blobUrl;
      document.body.appendChild(frame);

      cleanupRef.current.push(() => {
        frame.remove();
        URL.revokeObjectURL(blobUrl);
      });
    } catch {
      // Anything at all goes wrong, she still gets the document in front of
      // her with a working Print in the browser's own viewer.
      window.open(url, "_blank");
    } finally {
      setBusy(null);
    }
  }, [doc, url, isImage]);

  const download = useCallback(async () => {
    if (!doc) return;
    setBusy("download");
    // A second URL, minted with the filename attached: the stored path is a
    // UUID, so without this it saves as `9f3c…pdf` and is unfindable later.
    const downloadUrl = await signedUrlFor(supabase, doc.storage_path, {
      download: doc.file_name,
    });
    setBusy(null);
    if (!downloadUrl) {
      setError("Couldn't prepare that download.");
      return;
    }
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.rel = "noopener";
    // Not `anchor.download` — the file is on Supabase's origin, so the
    // attribute is ignored. The Content-Disposition on the signed URL is what
    // makes it save, and that works on iOS too.
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }, [doc, supabase]);

  return (
    <Modal
      isOpen={doc !== null}
      onClose={onClose}
      size="wide"
      title={clientName || (doc ? kindLabel(doc.kind) : undefined)}
    >
      {doc && (
        <>
          <p className="font-sans text-[13px] text-muted leading-[1.5] -mt-2">
            {kindLabel(doc.kind)} · Signed {formatSignedOn(doc.signed_on)}
          </p>
          <p className="font-sans text-[12px] text-muted/80 break-all">
            {doc.file_name}
            {doc.byte_size ? ` · ${formatBytes(doc.byte_size)}` : ""}
          </p>

          {/* The actions sit above the document rather than below it: on a
              phone the preview is taller than the screen, and a Print button
              you have to scroll a consent form to reach is a button she
              won't find. */}
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              type="button"
              onClick={open}
              disabled={!url}
              className="min-h-11 px-4 inline-flex items-center rounded-control border-2 border-light-tan bg-white font-sans text-[14px] font-semibold text-deep-brown hover:border-deep-brown disabled:opacity-50 transition-colors cursor-pointer"
            >
              Open
            </button>
            <button
              type="button"
              onClick={print}
              disabled={!url || busy === "print"}
              className="min-h-11 px-4 inline-flex items-center rounded-control border-2 border-light-tan bg-white font-sans text-[14px] font-semibold text-deep-brown hover:border-deep-brown disabled:opacity-50 transition-colors cursor-pointer"
            >
              {busy === "print" ? "Preparing…" : "Print"}
            </button>
            <button
              type="button"
              onClick={download}
              disabled={busy === "download"}
              className="min-h-11 px-4 inline-flex items-center rounded-control border-2 border-light-tan bg-white font-sans text-[14px] font-semibold text-deep-brown hover:border-deep-brown disabled:opacity-50 transition-colors cursor-pointer"
            >
              {busy === "download" ? "Preparing…" : "Download"}
            </button>
          </div>

          {error && (
            <p className="font-sans text-[13px] text-danger mt-3">{error}</p>
          )}

          <div className="mt-4 rounded-control overflow-hidden border border-light-tan bg-cream/40">
            {loading ? (
              <div className="h-[50vh] flex items-center justify-center">
                <p className="font-sans text-[14px] text-muted">Loading…</p>
              </div>
            ) : !url ? (
              <div className="h-[30vh] flex items-center justify-center px-4">
                <p className="font-sans text-[14px] text-muted text-center">
                  This file couldn&apos;t be opened.
                </p>
              </div>
            ) : isImage ? (
              // Wrapped for the @media print rule — printing an image goes
              // through here rather than through the frame above.
              <div className="print-agreement">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`${kindLabel(doc.kind)} for ${clientName || "this client"}`}
                  className="w-full h-auto"
                />
              </div>
            ) : isPdf ? (
              <iframe
                src={url}
                title={`${kindLabel(doc.kind)} — ${doc.file_name}`}
                className="w-full h-[55vh] bg-white"
              />
            ) : (
              <div className="h-[30vh] flex items-center justify-center px-4">
                <p className="font-sans text-[14px] text-muted text-center leading-[1.5]">
                  This kind of file can&apos;t be shown here. Use Open or
                  Download.
                </p>
              </div>
            )}
          </div>

          {isPdf && (
            <p className="font-sans text-[12px] text-muted mt-2 leading-[1.5]">
              On an iPad or phone this shows the first page only — tap Open to
              read the whole form, and Share &gt; Print from there.
            </p>
          )}
        </>
      )}
    </Modal>
  );
}

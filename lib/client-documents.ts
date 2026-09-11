/**
 * Shared vocabulary for the forms kept against a client — the consent and
 * medical health forms signed on paper, uploaded from the iPad.
 *
 * The bucket is PRIVATE (migration 020), so nothing here hands out a URL.
 * `signedUrlFor` mints one that works for an hour and then stops, which is
 * what makes it safe to open a medical form in a browser tab at all.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const DOCUMENTS_BUCKET = "client-documents";

/** An hour is long enough to read, print and save one; short enough that a
 *  URL left in a history or a chat is worthless by the time anyone finds it. */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export type DocumentKind = "consent" | "medical" | "other";

export const DOCUMENT_KINDS: { value: DocumentKind; label: string }[] = [
  { value: "consent", label: "Consent & waiver" },
  { value: "medical", label: "Medical health form" },
  { value: "other", label: "Other" },
];

export function kindLabel(kind: string): string {
  return DOCUMENT_KINDS.find((k) => k.value === kind)?.label ?? "Document";
}

/** What the uploader accepts. PDF is the shape Pages exports; the image types
 *  are there because a photo of a form beats not having the form. */
export const ACCEPTED_TYPES = "application/pdf,image/jpeg,image/png,image/heic";

/** 25MB. A scanned two-page form is a fraction of this; a 40MB photo burst
 *  export is a mistake worth catching before it uploads. */
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

export function isAcceptedType(file: File): boolean {
  return (
    file.type === "application/pdf" ||
    file.type.startsWith("image/") ||
    // iPadOS sometimes hands over a PDF with an empty type, so the extension
    // is the fallback rather than a hard rejection.
    /\.(pdf|jpe?g|png|heic)$/i.test(file.name)
  );
}

export function formatBytes(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** "2026-08-09" as "Aug 9, 2026". Parsed at midnight local, never as UTC —
 *  `new Date("2026-08-09")` lands on the 8th anywhere west of Greenwich. */
export function formatSignedOn(date: string | null): string {
  if (!date) return "No date on the form";
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Is this file one a browser can show inline as an image? */
export function isImageDocument(doc: {
  mime_type: string | null;
  file_name: string;
}): boolean {
  if (doc.mime_type?.startsWith("image/")) return true;
  return /\.(jpe?g|png|heic|gif|webp)$/i.test(doc.file_name);
}

/** Is this file a PDF? iPadOS sometimes uploads one with an empty mime type,
 *  so the extension is checked too rather than trusted away. */
export function isPdfDocument(doc: {
  mime_type: string | null;
  file_name: string;
}): boolean {
  if (doc.mime_type === "application/pdf") return true;
  return /\.pdf$/i.test(doc.file_name);
}

/**
 * A URL for one stored document, good for an hour.
 *
 * Pass `download` to get a URL the browser saves instead of displays — a
 * string names the saved file, which matters because the stored path is a
 * random UUID and would otherwise land in Downloads as `a3f2….pdf`.
 *
 * Returns null rather than throwing: a document that won't open should leave
 * the rest of a profile working.
 */
export async function signedUrlFor(
  supabase: SupabaseClient,
  storagePath: string,
  options?: { download?: string | boolean }
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS, options);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/**
 * Where a file goes in the bucket. Namespaced by client so the bucket stays
 * readable from the Supabase dashboard, and randomised so re-uploading the
 * same filename never collides or serves a stale cached copy.
 */
export function storagePathFor(clientId: string, fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "pdf";
  const safeExt = /^[a-z0-9]{1,5}$/.test(ext) ? ext : "pdf";
  return `${clientId}/${crypto.randomUUID()}.${safeExt}`;
}

"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

interface ServicePhotoFieldProps {
  imageUrl: string | null;
  focusY: number;
  onChange: (next: { imageUrl: string | null; focusY: number }) => void;
}

const BUCKET = "service-photos";
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Photo for a service card, uploaded straight from her phone.
 *
 * The card image on the booking page is a short letterbox, and these are
 * full-face portraits — a plain centre crop lands on a nose. The slider moves
 * the crop up and down so it sits on the lashes, which is the only part of the
 * photo a customer is actually trying to judge. The preview below is the exact
 * size and crop the booking page uses, so what she lines up is what they see.
 */
export function ServicePhotoField({
  imageUrl,
  focusY,
  onChange,
}: ServicePhotoFieldProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const upload = async (file: File) => {
    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("That file isn't an image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("That photo is over 8MB — try one straight from your camera roll.");
      return;
    }

    setUploading(true);
    try {
      // Extension kept so the browser serves the right content type; the name
      // is randomised so re-uploading never collides or serves a stale cache.
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { cacheControl: "3600", upsert: false });

      if (uploadError) throw new Error(uploadError.message);

      const {
        data: { publicUrl },
      } = supabase.storage.from(BUCKET).getPublicUrl(path);

      onChange({ imageUrl: publicUrl, focusY });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't upload that photo."
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-dark-brown text-[12px] font-semibold font-sans">
        Photo
      </span>

      <div className="relative w-full h-24 rounded-control overflow-hidden bg-light-tan">
        {imageUrl && (
          <Image
            src={imageUrl}
            alt=""
            fill
            sizes="400px"
            className="object-cover"
            style={{ objectPosition: `50% ${focusY}%` }}
          />
        )}
        {!imageUrl && (
          <span className="absolute inset-0 flex items-center justify-center font-sans text-[12px] text-muted">
            No photo yet
          </span>
        )}
      </div>

      {imageUrl && (
        <label className="mt-2">
          <span className="block font-sans text-[12px] text-muted mb-1">
            Slide until only the eyes show
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={focusY}
            onChange={(e) =>
              onChange({ imageUrl, focusY: Number(e.target.value) })
            }
            className="w-full accent-deep-brown"
          />
        </label>
      )}

      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
            // Cleared so choosing the same file twice still fires onChange.
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="h-control-sm box-border px-4 inline-flex items-center rounded-control border-2 border-brand-brown text-text-brown font-sans font-semibold text-[12px] disabled:opacity-50"
        >
          {uploading ? "Uploading..." : imageUrl ? "Replace photo" : "Add photo"}
        </button>
        {imageUrl && (
          <button
            type="button"
            onClick={() => onChange({ imageUrl: null, focusY })}
            className="font-sans text-[12px] text-muted underline"
          >
            Remove
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="font-sans text-[12px] text-danger mt-1">
          {error}
        </p>
      )}
    </div>
  );
}

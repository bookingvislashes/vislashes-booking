"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { STEPS } from "@/lib/how-to-book-steps";

type StepNumber = (typeof STEPS)[number]["number"];

const BUCKET = "service-photos";
const MAX_BYTES = 8 * 1024 * 1024;

const SETTING_KEYS: Record<StepNumber, string> = {
  "1": "how_to_book_photo_1",
  "2": "how_to_book_photo_2",
  "3": "how_to_book_photo_3",
};

/**
 * Real client photos for the home page's "How to Book" steps, uploaded from
 * her phone instead of a developer swapping files in /public.
 *
 * Reuses the service-photos bucket rather than a new one — the photos are
 * the same shape (a real face, public-read, admin-write), and adding a
 * second bucket with its own storage policies would only be more places for
 * the same permission to go stale.
 */
export function HowToBookPhotos() {
  const [photos, setPhotos] = useState<Partial<Record<StepNumber, string>>>({});
  const [loading, setLoading] = useState(true);
  const [uploadingStep, setUploadingStep] = useState<StepNumber | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<Partial<Record<StepNumber, HTMLInputElement>>>({});

  const supabase = createClient();

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", Object.values(SETTING_KEYS));

    if (!error) {
      const map: Partial<Record<StepNumber, string>> = {};
      (Object.keys(SETTING_KEYS) as StepNumber[]).forEach((step) => {
        const row = (data || []).find((r) => r.key === SETTING_KEYS[step]);
        if (row?.value) map[step] = row.value;
      });
      setPhotos(map);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const saveUrl = async (step: StepNumber, url: string | null) => {
    const key = SETTING_KEYS[step];
    const { data: existing } = await supabase
      .from("settings")
      .select("id")
      .eq("key", key)
      .maybeSingle();

    if (url === null) {
      if (existing) await supabase.from("settings").delete().eq("id", existing.id);
      return;
    }
    if (existing) {
      await supabase.from("settings").update({ value: url }).eq("id", existing.id);
    } else {
      await supabase.from("settings").insert({ key, value: url });
    }
  };

  const upload = async (step: StepNumber, file: File) => {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("That file isn't an image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("That photo is over 8MB — try one straight from your camera roll.");
      return;
    }

    setUploadingStep(step);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `how-to-book-${step}-${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (uploadError) throw new Error(uploadError.message);

      const {
        data: { publicUrl },
      } = supabase.storage.from(BUCKET).getPublicUrl(path);

      await saveUrl(step, publicUrl);
      setPhotos((prev) => ({ ...prev, [step]: publicUrl }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload that photo.");
    } finally {
      setUploadingStep(null);
    }
  };

  const resetToDefault = async (step: StepNumber) => {
    await saveUrl(step, null);
    setPhotos((prev) => {
      const next = { ...prev };
      delete next[step];
      return next;
    });
  };

  return (
    <div className="bg-white rounded-surface p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] mb-6">
      <h2 className="font-display text-[18px] font-bold text-dark-brown mb-1">
        How to Book Photos
      </h2>
      <p className="font-sans text-[13px] text-muted mb-4 max-w-[52ch]">
        The three photos on the home page&apos;s How to Book section. Leave a
        step on its default until you upload one of your own.
      </p>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {STEPS.map((s) => (
            <div key={s.number} className="h-24 rounded-control bg-light-tan/50 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {STEPS.map((step) => {
            const url = photos[step.number];
            return (
              <div key={step.number} className="flex flex-col gap-2">
                <span className="font-sans text-[12px] font-semibold text-dark-brown">
                  {step.number}. {step.title}
                </span>
                <div className="relative w-full h-24 rounded-control overflow-hidden bg-light-tan">
                  {url ? (
                    <Image src={url} alt="" fill sizes="300px" className="object-cover" />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center font-sans text-[11px] text-muted">
                      Default photo
                    </span>
                  )}
                </div>
                <input
                  ref={(el) => {
                    inputRefs.current[step.number] = el ?? undefined;
                  }}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) upload(step.number, file);
                    e.target.value = "";
                  }}
                />
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => inputRefs.current[step.number]?.click()}
                    disabled={uploadingStep === step.number}
                    className="h-control-sm box-border px-3 inline-flex items-center rounded-control border-2 border-brand-brown text-text-brown font-sans font-semibold text-[11px] disabled:opacity-50"
                  >
                    {uploadingStep === step.number
                      ? "Uploading..."
                      : url
                        ? "Replace"
                        : "Upload"}
                  </button>
                  {url && (
                    <button
                      type="button"
                      onClick={() => resetToDefault(step.number)}
                      className="font-sans text-[11px] text-muted underline"
                    >
                      Use default
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <p role="alert" className="font-sans text-[12px] text-danger mt-3">
          {error}
        </p>
      )}
    </div>
  );
}

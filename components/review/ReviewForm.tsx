"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface ReviewFormProps {
  token: string;
  firstName: string;
  serviceName: string;
}

const LABELS = ["", "Not great", "It was okay", "Good", "Really good", "Loved it"];

export function ReviewForm({ token, firstName, serviceName }: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"published" | "private" | null>(null);

  const shown = hovered || rating;

  const submit = async () => {
    if (!rating) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, rating, comment }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.message || data.error || "Couldn't save that. Please try again.");
        return;
      }
      setDone(data.published ? "published" : "private");
    } catch {
      setError("Couldn't reach the salon. Please check your connection.");
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <div className="bg-white rounded-surface p-6 sm:p-8 shadow-[0_1px_4px_rgba(0,0,0,0.06)] text-center">
        <h1 className="font-display text-[28px] font-bold text-dark-brown mb-2">
          Thank you{firstName ? `, ${firstName}` : ""}!
        </h1>
        <p className="font-sans text-[15px] leading-relaxed text-charcoal">
          {done === "published"
            ? "That means the world to me. It may show up on my site — thank you for helping other people find me."
            : "I really appreciate you telling me. I read every one of these, and I'd love the chance to make it right — just reply to your email."}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-surface p-6 sm:p-8 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
      <h1 className="font-display text-[28px] font-bold text-dark-brown mb-1">
        How did I do{firstName ? `, ${firstName}` : ""}?
      </h1>
      <p className="font-sans text-[15px] text-charcoal mb-6">
        Your {serviceName.toLowerCase()} — honestly, however it went.
      </p>

      {/* Buttons rather than a radio group drawn as stars: each one is a real
          control with its own label, so this works by keyboard and reads
          correctly to a screen reader. */}
      <div
        className="flex gap-1.5 mb-2"
        onMouseLeave={() => setHovered(0)}
        role="group"
        aria-label="Your rating"
      >
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            aria-label={`${value} ${value === 1 ? "star" : "stars"}`}
            aria-pressed={rating === value}
            onMouseEnter={() => setHovered(value)}
            onFocus={() => setHovered(value)}
            onBlur={() => setHovered(0)}
            onClick={() => {
              setRating(value);
              setError(null);
            }}
            className="p-1 cursor-pointer"
          >
            <svg
              viewBox="0 0 24 24"
              className={`w-9 h-9 transition-colors ${
                value <= shown ? "text-deep-brown" : "text-light-tan"
              }`}
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.35l-5.81 3.05 1.11-6.47-4.7-4.58 6.5-.95L12 2.5z" />
            </svg>
          </button>
        ))}
      </div>
      <p className="font-sans text-[14px] text-muted min-h-[21px] mb-5">
        {shown ? LABELS[shown] : "Tap a star"}
      </p>

      <label className="block">
        <span className="font-sans text-[13px] font-semibold text-dark-brown">
          Anything you&rsquo;d like to add?
        </span>
        <textarea
          id="reviewComment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          maxLength={1000}
          placeholder="However you'd describe it to a friend."
          className="w-full mt-1.5 p-3 box-border bg-white border border-light-tan rounded-control text-[16px] text-charcoal font-sans placeholder:text-muted focus:border-deep-brown transition-colors resize-y"
        />
      </label>

      {rating >= 4 && (
        <p className="font-sans text-[13px] text-muted mt-2 leading-[1.5]">
          I may share this on my website, with your first name only.
        </p>
      )}
      {rating > 0 && rating < 4 && (
        <p className="font-sans text-[13px] text-muted mt-2 leading-[1.5]">
          This one comes straight to me and goes nowhere else.
        </p>
      )}

      {error && (
        <p className="font-sans text-[14px] text-danger mt-4" role="alert">
          {error}
        </p>
      )}

      <Button
        type="button"
        className="w-full mt-5"
        disabled={!rating || saving}
        onClick={submit}
      >
        {saving ? "Sending…" : rating ? "Send it" : "Pick a rating first"}
      </Button>
    </div>
  );
}

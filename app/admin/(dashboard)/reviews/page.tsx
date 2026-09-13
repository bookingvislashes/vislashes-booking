"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Review, ReviewStatus } from "@/lib/reviews";
import { PUBLISH_THRESHOLD } from "@/lib/reviews";

/**
 * Reviews left through the link in the follow-up email.
 *
 * Four stars and up publish themselves the moment they arrive, which is what
 * makes this a page she checks rather than a queue she has to work. Anything
 * lower is private feedback: it is shown here, and there is deliberately no
 * way to publish it from this screen — the home page is her shop window, and
 * "only the positive ones" was the whole ask.
 *
 * What she can do is take a published one down, and put it back.
 */

function stars(rating: number) {
  return "★".repeat(rating) + "☆".repeat(5 - rating);
}

function when(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const supabase = createClient();

  const fetchAll = useCallback(async () => {
    const { data, error: fetchErr } = await supabase
      .from("reviews")
      .select("id, client_name, rating, comment, status, submitted_at, published_at")
      .order("submitted_at", { ascending: false });

    if (fetchErr) {
      setError(
        fetchErr.message.includes("reviews")
          ? "Run migration 024 first — the reviews table doesn't exist yet."
          : fetchErr.message
      );
      setLoading(false);
      return;
    }

    setError(null);
    setReviews((data || []) as Review[]);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  async function setStatus(id: string, status: ReviewStatus) {
    setBusyId(id);
    const { error: updateErr } = await supabase
      .from("reviews")
      .update({
        status,
        published_at: status === "published" ? new Date().toISOString() : null,
      })
      .eq("id", id);
    setBusyId(null);

    if (updateErr) {
      setError(updateErr.message);
      return;
    }
    await fetchAll();
  }

  const { live, feedback } = useMemo(
    () => ({
      live: reviews.filter((r) => r.rating >= PUBLISH_THRESHOLD),
      feedback: reviews.filter((r) => r.rating < PUBLISH_THRESHOLD),
    }),
    [reviews]
  );

  if (loading) {
    return (
      <p className="font-sans text-[16px] text-muted animate-pulse">
        Loading reviews…
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-[820px]">
      <div>
        <h1 className="font-display text-[28px] font-bold text-dark-brown">
          Reviews
        </h1>
        <p className="font-sans text-[14px] text-muted mt-1 leading-[1.6]">
          Left through the link in the two-day follow-up email. {PUBLISH_THRESHOLD}{" "}
          stars and up go on your home page automatically; anything lower comes
          only to you.
        </p>
      </div>

      {error && (
        <p className="font-sans text-[14px] text-danger bg-danger/10 border border-danger/20 rounded-control px-3 py-2">
          {error}
        </p>
      )}

      <section>
        <h2 className="font-sans text-[12px] font-semibold uppercase tracking-wider text-muted mb-2">
          On your website ({live.filter((r) => r.status === "published").length})
        </h2>

        {live.length === 0 ? (
          <p className="font-sans text-[15px] text-muted bg-white rounded-surface p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
            Nothing yet. Your original four quotes are showing on the home page
            until the first one arrives.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {live.map((review) => (
              <article
                key={review.id}
                className="bg-white rounded-surface p-4 sm:p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
              >
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <p className="font-sans text-[15px] font-semibold text-dark-brown">
                    {review.client_name}{" "}
                    <span className="text-deep-brown tracking-[2px]">
                      {stars(review.rating)}
                    </span>
                  </p>
                  <p className="font-sans text-[13px] text-muted">
                    {when(review.submitted_at)}
                  </p>
                </div>

                {review.comment && (
                  <p className="font-sans text-[15px] text-charcoal leading-[1.6] mt-2 whitespace-pre-wrap">
                    {review.comment}
                  </p>
                )}

                <div className="flex items-center gap-2 mt-3">
                  {review.status === "published" ? (
                    <button
                      type="button"
                      disabled={busyId === review.id}
                      onClick={() => setStatus(review.id, "hidden")}
                      className="inline-flex items-center h-control-sm px-4 rounded-control border border-light-tan font-sans text-[14px] text-charcoal hover:bg-light-tan transition-colors disabled:opacity-60"
                    >
                      Take it down
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busyId === review.id}
                      onClick={() => setStatus(review.id, "published")}
                      className="inline-flex items-center h-control-sm px-4 rounded-control border border-light-tan font-sans text-[14px] text-charcoal hover:bg-light-tan transition-colors disabled:opacity-60"
                    >
                      Put it back
                    </button>
                  )}
                  <span className="font-sans text-[13px] text-muted">
                    {review.status === "published" ? "Showing" : "Hidden"}
                    {!review.comment && " · no comment, so it never shows"}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-sans text-[12px] font-semibold uppercase tracking-wider text-muted mb-2">
          Just for you ({feedback.length})
        </h2>
        <p className="font-sans text-[14px] text-muted mb-2 leading-[1.6]">
          Under {PUBLISH_THRESHOLD} stars. These never reach your website — they
          are here so you know, and usually there is still time to make it
          right.
        </p>

        {feedback.length === 0 ? (
          <p className="font-sans text-[15px] text-muted bg-white rounded-surface p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
            None. Long may it last.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {feedback.map((review) => (
              <article
                key={review.id}
                className="bg-white rounded-surface p-4 sm:p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] border-l-[3px] border-warm-beige"
              >
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <p className="font-sans text-[15px] font-semibold text-dark-brown">
                    {review.client_name}{" "}
                    <span className="text-muted tracking-[2px]">
                      {stars(review.rating)}
                    </span>
                  </p>
                  <p className="font-sans text-[13px] text-muted">
                    {when(review.submitted_at)}
                  </p>
                </div>
                {review.comment && (
                  <p className="font-sans text-[15px] text-charcoal leading-[1.6] mt-2 whitespace-pre-wrap">
                    {review.comment}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

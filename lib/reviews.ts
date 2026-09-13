import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Client reviews: collected from the follow-up email, shown on the home page.
 *
 * WHAT GETS PUBLISHED. Four and five stars go straight onto the site.
 * Anything lower is stored as `private` and cannot be published from the
 * admin at all — the home page is her shop window, not a review platform, and
 * she asked for only the positive ones out front. A low rating is still kept,
 * because feedback she can act on is worth more than feedback nobody sees.
 *
 * The gate is a status column and an RLS policy, not a filter in a query: an
 * anonymous visitor cannot read a one-star review even by asking for it
 * directly.
 */

/** At or above this, a review is published the moment it arrives. */
export const PUBLISH_THRESHOLD = 4;

export type ReviewStatus = "published" | "private" | "hidden";

export interface Review {
  id: string;
  client_name: string;
  rating: number;
  comment: string | null;
  status: ReviewStatus;
  submitted_at: string;
  published_at: string | null;
}

/** "Jasmine Rivera" -> "Jasmine". First names only, as on the old quotes. */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || "A client";
}

export function statusForRating(rating: number): ReviewStatus {
  return rating >= PUBLISH_THRESHOLD ? "published" : "private";
}

/**
 * The quotes for the home page.
 *
 * Read with the anon client, so the RLS policy is doing the filtering rather
 * than this function being trusted to. Empty on any failure — the section
 * falls back to her original four rather than rendering a hole.
 *
 * Reviews with no comment are skipped: five stars and nothing to read is a
 * rating, not a testimonial.
 */
export async function loadPublishedReviews(
  supabase: SupabaseClient,
  limit = 12
): Promise<Review[]> {
  try {
    const { data, error } = await supabase
      .from("reviews")
      .select("id, client_name, rating, comment, status, submitted_at, published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("loadPublishedReviews failed:", error);
      return [];
    }

    return (data || []).filter(
      (row): row is Review => Boolean((row.comment || "").trim())
    );
  } catch (err) {
    console.error("loadPublishedReviews threw:", err);
    return [];
  }
}

import type { NextConfig } from "next";

// Stamped into the bundle at build time so the footer can show which deploy is
// live. The SHA alone isn't enough: redeploying the same commit leaves it
// unchanged, which reads as "the deploy didn't land". The timestamp moves every
// build, so the pair together always answers "is this new?".
const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local";
// Formatted in Eastern rather than UTC so the stamp reads in salon-local time.
// `timeZoneName` resolves to EDT or EST on its own, so this stays correct across
// the DST change without anything to remember in November.
const builtAt = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZoneName: "short",
}).format(new Date());

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_ID: `${commit} · ${builtAt}`,
  },
  images: {
    // AVIF is not on by default (Next only ships image/webp). At a given
    // quality AVIF keeps noticeably more detail than WebP, which matters
    // because our source photos are already being upscaled to fit their slots.
    formats: ["image/avif", "image/webp"],
    // Next 16 only serves qualities that are allow-listed here; the default
    // list is [75]. 90 is used for the photographic images.
    qualities: [75, 90],
    // Optimized images were being sent with `max-age=0, must-revalidate`, so
    // returning visitors re-fetched every photo on every page view. 30 days.
    //
    // NOTE: the cache key is the URL, so replacing a file in /public under the
    // SAME name can serve the old version to repeat visitors for up to 30 days.
    // When swapping in a new photo, give it a new filename.
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
};

export default nextConfig;

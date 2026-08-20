import type { NextConfig } from "next";

// Stamped into the bundle at build time so the footer can show which deploy is
// live. The SHA alone isn't enough: redeploying the same commit leaves it
// unchanged, which reads as "the deploy didn't land". The timestamp moves every
// build, so the pair together always answers "is this new?".
// Single source of truth is package.json, so bumping the footer is one edit.
// A trailing ".0" patch is dropped ("1.5.0" reads as "v1.5") since the patch
// digit is noise for a release like that — but a real one ("1.5.2") is kept.
import { version } from "./package.json";

const displayVersion = `v${version.replace(/\.0$/, "")}`;
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

// Hostname of the Supabase project, for the image allow-list below. Parsed
// defensively: an unset or malformed URL must not crash the build.
const supabaseHost = (() => {
  const raw =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  try {
    return raw ? new URL(raw).hostname : "";
  } catch {
    return "";
  }
})();

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_ID: `${displayVersion} · ${builtAt}`,
  },
  images: {
    // Service photos are uploaded to Supabase Storage, so next/image has to be
    // told that host is allowed or every card throws at runtime. Derived from
    // the configured project URL rather than hardcoded, so a project change
    // does not silently break every photo.
    remotePatterns: supabaseHost
      ? [{ protocol: "https" as const, hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }]
      : [],
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
  // Apple requires its verification file at this exact path. Next ignores
  // directories beginning with a dot under app/, so the handler lives at a
  // normal route and is mapped onto the well-known path here.
  async rewrites() {
    return [
      {
        source: "/.well-known/apple-developer-merchantid-domain-association",
        destination: "/apple-pay-domain-association",
      },
    ];
  },
};

export default nextConfig;

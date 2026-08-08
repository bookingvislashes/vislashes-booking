import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // AVIF is not on by default (Next only ships image/webp). At a given
    // quality AVIF keeps noticeably more detail than WebP, which matters
    // because our source photos are already being upscaled to fit their slots.
    formats: ["image/avif", "image/webp"],
    // Next 16 only serves qualities that are allow-listed here; the default
    // list is [75]. 90 is used for the photographic images.
    qualities: [75, 90],
  },
};

export default nextConfig;

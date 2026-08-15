import fs from "node:fs";
import path from "node:path";

/**
 * True when a file actually exists under /public.
 *
 * Server-side only — call it from a server component at render time.
 *
 * The home page sections built from Figma reference photos that are exported
 * from the design by hand. Pointing <Image> at a file that isn't there yet
 * produces a broken-image icon on a live page, so those sections check first
 * and fall back to the same tinted placeholder block the booking flow already
 * uses. Drop the file in and it appears on the next build, with no code change.
 */
export function hasAsset(publicRelativePath: string): boolean {
  try {
    return fs.existsSync(
      path.join(process.cwd(), "public", publicRelativePath.replace(/^\//, ""))
    );
  } catch {
    return false;
  }
}

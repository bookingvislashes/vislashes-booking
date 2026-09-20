import type { CSSProperties } from "react";

/**
 * Crop for a service photo: where it's anchored (as object-position
 * percentages) and how far it's zoomed in past the plain object-cover fit.
 *
 * Zoom is a scale transform around that same anchor point, so dialling it up
 * tightens the crop toward the anchor instead of just resizing the image —
 * object-cover alone can only choose which part of the existing crop shows,
 * not crop in past it.
 */
export function getServicePhotoStyle(
  focusX: number,
  focusY: number,
  zoom: number
): CSSProperties {
  const objectPosition = `${focusX}% ${focusY}%`;
  return {
    objectPosition,
    transformOrigin: objectPosition,
    transform: zoom !== 100 ? `scale(${zoom / 100})` : undefined,
  };
}

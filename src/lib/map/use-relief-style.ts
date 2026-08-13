"use client";

import { useMemo } from "react";
import type { StyleSpecification } from "maplibre-gl";
import { buildReliefStyle } from "./relief-style";

/**
 * The bathymetric relief style, built against this browser's origin.
 *
 * The style's tile, glyph and GeoJSON URLs are absolute, so it needs an origin
 * — and on the server there isn't one. Every MapLibre surface was writing the
 * same `typeof window !== "undefined" ? window.location.origin : ""` guard by
 * hand; this is that line, once.
 *
 * Built once per mount. The style is a plain object with no reactive inputs,
 * and handing MapLibre a new one on every render makes it tear down and
 * rebuild the map.
 */
export function useReliefStyle(): StyleSpecification {
  return useMemo(
    () =>
      buildReliefStyle(
        typeof window !== "undefined" ? window.location.origin : "",
      ) as unknown as StyleSpecification,
    [],
  );
}

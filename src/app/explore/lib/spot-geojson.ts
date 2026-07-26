// Builds the GeoJSON FeatureCollection the Explore map's spot source
// renders. Pin color/opacity/label are baked into feature properties so the GL
// paint expressions stay cheap. Matches BlueCaster's MapExplorer pins 1:1
// (app/map/MapExplorer.tsx + scoring-ui.ts).

import type { RailSpot } from "./explore-data";

// BlueCaster's continuous score→color scale (scoring-ui.ts). Scores are 0–100
// here (RailSpot.score), so thresholds are ×100 of BlueCaster's 0..1 stops.
const SCALE: Array<[number, string]> = [
  [78, "#059669"], // emerald-600 — Prime
  [62, "#65a30d"], // lime-600 — Good
  [46, "#ca8a04"], // amber-600 — Fair
  [30, "#ea580c"], // orange-600 — Slow
  [0, "#e11d48"], //  rose-600 — Poor
];
export const NO_DATA_COLOR = "#9ca3af"; // zinc-400 — unscored dot
export const SELECT_HEX = "#1F40E0"; // cobalt — selected stroke
export const FRESH_HEX = "#10b981"; // emerald-500 — (reserved; no fresh data yet)

export function scoreColor(score: number | null): string {
  if (score === null) return NO_DATA_COLOR;
  for (const [t, c] of SCALE) if (score >= t) return c;
  return SCALE[SCALE.length - 1][1];
}

export interface SpotFeatureProps {
  spotId: string;
  slug: string;
  name: string;
  /** Score numeral (0–100) when scored, else a centered "·". */
  label: string;
  color: string;
  txtColor: string;
  opacity: number;
  /** 1 when the viewer created this spot — drives the brand-blue ring layer. */
  isCustom: number;
}

export type SpotFeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    id: number;
    geometry: { type: "Point"; coordinates: [number, number] };
    properties: SpotFeatureProps;
  }>;
};

/** Hour-aware effective score — the same fallback the pin color/label uses. */
function effectiveScore(s: RailSpot, hour?: number | null): number | null {
  return hour != null ? (s.hours24?.[hour] ?? s.score) : s.score;
}

export function spotsToFeatureCollection(
  spots: RailSpot[],
  /** When set (0–23), pins color/label by that hour's score instead of the
   *  day peak; spots without an hourly value that hour fall back to the peak. */
  hour?: number | null,
): SpotFeatureCollection {
  // Ascending score so the best pin paints LAST — when two pins still touch
  // after decluttering, the higher score sits on top and wins the click.
  const ordered = [...spots].sort(
    (a, b) => (effectiveScore(a, hour) ?? -1) - (effectiveScore(b, hour) ?? -1),
  );
  return {
    type: "FeatureCollection",
    features: ordered.map((s, i) => {
      const raw = effectiveScore(s, hour);
      const has = raw !== null;
      return {
        type: "Feature" as const,
        id: i,
        geometry: { type: "Point" as const, coordinates: [s.lng, s.lat] as [number, number] },
        properties: {
          spotId: s.id,
          slug: s.slug,
          name: s.name,
          label: has ? String(raw) : "·",
          color: scoreColor(raw),
          txtColor: has ? "#ffffff" : "#374151",
          opacity: has ? 1 : 0.6,
          // Drives the brand-blue ring that marks a spot as yours. 1/0 rather
          // than a boolean: MapLibre filter expressions compare numbers.
          isCustom: s.isCustom ? 1 : 0,
        },
      };
    }),
  };
}

// ── Screen-space pin decluttering ─────────────────────────────────────────
//
// The Explore map is deliberately unclustered, so co-located spots (e.g.
// Brotchie Ledge on the Victoria waterfront) would stack their pins at any
// zoom where their pixel distance is under a pin diameter. Rather than
// cluster, hide the lower-scored pin of any overlapping pair; it reappears
// as the user zooms in and the pair separates. Overlap depends only on zoom
// (Web Mercator, no rotation), so this recomputes per zoom step — not on pan.

/** Pin radius at a zoom level — mirror of the circle layer's interpolate stops. */
export function pinRadius(zoom: number): number {
  if (zoom <= 8) return 11;
  if (zoom <= 12) return 11 + ((zoom - 8) / 4) * 3;
  if (zoom <= 15) return 14 + ((zoom - 12) / 3) * 2;
  return 16;
}

/** World-pixel position at a zoom (512px tiles, standard Web Mercator). */
function worldPx(lat: number, lng: number, zoom: number): [number, number] {
  const scale = 512 * 2 ** zoom;
  const x = ((lng + 180) / 360) * scale;
  const sin = Math.sin((lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale;
  return [x, y];
}

// Pins hide at the first pixel of contact (2 radii) plus a small allowance
// for the white stroke ring, so kept pins always read fully separated.
const STROKE_PAD = 4;

/**
 * Greedy screen-space declutter: slugs whose pins should HIDE at this zoom.
 * Spots are kept best-score-first, so the winner of an overlapping pair is
 * always the pin an angler would want. `keepSlug` (the selected spot) is
 * immune — selecting a spot from the rail must never leave it invisible.
 */
export function declutterHiddenSlugs(
  spots: RailSpot[],
  hour: number | null | undefined,
  zoom: number,
  keepSlug: string | null,
): string[] {
  if (spots.length < 2) return [];
  const minDist = pinRadius(zoom) * 2 + STROKE_PAD;
  const ranked = [...spots].sort((a, b) => {
    if (a.slug === keepSlug) return -1;
    if (b.slug === keepSlug) return 1;
    return (effectiveScore(b, hour) ?? -1) - (effectiveScore(a, hour) ?? -1);
  });
  const kept: Array<[number, number]> = [];
  const hidden: string[] = [];
  for (const s of ranked) {
    const p = worldPx(s.lat, s.lng, zoom);
    const collides = kept.some(
      (k) => Math.hypot(k[0] - p[0], k[1] - p[1]) < minDist,
    );
    if (collides && s.slug !== keepSlug) hidden.push(s.slug);
    else kept.push(p);
  }
  return hidden;
}

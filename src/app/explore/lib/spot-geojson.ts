// Builds the GeoJSON FeatureCollection the Explore map's clustered source
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
export const SELECT_HEX = "#1F40E0"; // cobalt — selected stroke + cluster
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

export function spotsToFeatureCollection(
  spots: RailSpot[],
  /** When set (0–23), pins color/label by that hour's score instead of the
   *  day peak; spots without an hourly value that hour fall back to the peak. */
  hour?: number | null,
): SpotFeatureCollection {
  return {
    type: "FeatureCollection",
    features: spots.map((s, i) => {
      const raw =
        hour != null ? (s.hours24?.[hour] ?? s.score) : s.score;
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
        },
      };
    }),
  };
}

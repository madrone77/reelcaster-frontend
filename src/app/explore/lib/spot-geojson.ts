// Builds the GeoJSON FeatureCollection the Explore map's spot source
// renders. Pin color/opacity/label are baked into feature properties so the GL
// paint expressions stay cheap. Matches BlueCaster's MapExplorer pins 1:1
// (app/map/MapExplorer.tsx + scoring-ui.ts).

import { TIER_PIN, tierFor, type RailSpot } from "./explore-data";
import { PIN_MIN_DIST } from "./score-puck";

export const NO_DATA_COLOR = "#9ca3af"; // zinc-400 — unscored dot
export const SELECT_HEX = "#1F40E0"; // cobalt — selected stroke
export const FRESH_HEX = "#10b981"; // emerald-500 — (reserved; no fresh data yet)

/**
 * Pin fill: the score tiers, cut at 75/55 like everything else that puts a
 * colour next to a score.
 *
 * This was a five-stop ramp (78/62/46/30) mirrored from bluecaster's
 * scoring-ui.ts, which is now on the same three stops. The two extra stops
 * were shade pairs, prime-vs-good and slow-vs-poor, and at pin size over
 * bathymetry nobody resolves which green they are looking at. What they did do
 * was disagree with the rest of the page: a 76 drew a lime pin and read "Good"
 * everywhere else.
 *
 * `null` keeps its own grey rather than the tier's `none`, because an unscored
 * pin is a different statement from a badly scored one.
 */
export function scoreColor(score: number | null): string {
  if (score === null) return NO_DATA_COLOR;
  return TIER_PIN[tierFor(score)];
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
  /** 1 when scraped catch reports exist here AND this viewer may see that.
   *  Drives the emerald collar. Pro-only, like the tag below. */
  fresh: number;
  /**
   * 1 when the puck should wear the "Hot" tag: a Pro viewer, on a scored spot
   * that has reports.
   *
   * It reads the same underlying signal as `fresh` rather than a stronger one.
   * has_reports is all the map payload carries, and deliberately so: presence
   * is the one public fact about reports, while the counts and the verdict
   * stay behind the Pro gate on /map/fresh-catches. BlueCaster's own map sets
   * a higher bar for the tag (a report saying fish were actually CAUGHT, not
   * merely that someone posted), but matching that here would mean serving a
   * Pro-gated number in a shared, CDN-cached body.
   *
   * Kept separate from `fresh` because the tag additionally needs a score to
   * sit above, while the collar does not.
   */
  hot: number;
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

/**
 * The only fields the declutter and its ranking actually read.
 *
 * Widened out of `RailSpot` so a surface with rows of a different shape — the
 * city page's map, whose marks come from the hub payload — can share the one
 * screen-space overlap rule instead of growing a second copy of it that drifts.
 */
export type DeclutterSpot = Pick<RailSpot, "slug" | "lat" | "lng" | "score"> &
  Partial<Pick<RailSpot, "hours24">>;

/** Hour-aware effective score — the same fallback the pin color/label uses. */
function effectiveScore(s: DeclutterSpot, hour?: number | null): number | null {
  return hour != null ? (s.hours24?.[hour] ?? s.score) : s.score;
}

export function spotsToFeatureCollection(
  spots: RailSpot[],
  /** When set (0–23), pins color/label by that hour's score instead of the
   *  day peak; spots without an hourly value that hour fall back to the peak. */
  hour?: number | null,
  /**
   * Whether this viewer may see that a spot has catch reports at all. Gates
   * BOTH report signals on the map: the "Hot" tag and the emerald collar.
   *
   * Defaults to OFF so a surface that never resolves a tier (the public city
   * pages) cannot show them by omission. Note the caller must not pass a tier
   * it is still loading: `useSubscription` reports `isPaid: false` until it
   * resolves, which biases correctly to hidden, but means a Pro viewer's
   * signals arrive a beat after first paint rather than never.
   */
  showReports = false,
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
          fresh: showReports && s.hasReports ? 1 : 0,
          // A tag reading "Hot" next to no score at all would contradict
          // itself, so it needs a number to sit above.
          hot: showReports && has && s.hasReports ? 1 : 0,
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

/** World-pixel position at a zoom (512px tiles, standard Web Mercator). */
function worldPx(lat: number, lng: number, zoom: number): [number, number] {
  const scale = 512 * 2 ** zoom;
  const x = ((lng + 180) / 360) * scale;
  const sin = Math.sin((lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale;
  return [x, y];
}

// Pins hide at the first pixel of contact (2 radii) plus a small allowance
// for the white stroke ring, so kept pins always read fully separated. The
// distance itself lives with the puck (score-puck.ts PIN_MIN_DIST).

/**
 * Greedy screen-space declutter: slugs whose pins should HIDE at this zoom.
 * Spots are kept best-score-first, so the winner of an overlapping pair is
 * always the pin an angler would want. `keepSlug` (the selected spot) is
 * immune — selecting a spot from the rail must never leave it invisible.
 */
export function declutterHiddenSlugs(
  spots: DeclutterSpot[],
  hour: number | null | undefined,
  zoom: number,
  keepSlug: string | null,
): string[] {
  if (spots.length < 2) return [];
  // Pucks are a constant size at every zoom (the Zillow behaviour, and what
  // keeps the baked numeral crisp), so the overlap threshold no longer varies
  // with zoom the way the circles' 11→16 radii did. It is also wider, so
  // co-located spots separate at a closer zoom than they used to.
  void zoom;
  const minDist = PIN_MIN_DIST;
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

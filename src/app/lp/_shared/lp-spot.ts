import { fetchFreshCatches, fetchHierarchy, fetchMapSpots } from "@/lib/bluecaster";
import { buildExploreData, tierFor } from "@/app/explore/lib/explore-data";
import { formatHour12 } from "@/lib/time-format";

/**
 * The score card's data, resolved per city.
 *
 * This replaces the hardcoded Oak Bay card these pages shipped with. A Seattle
 * ad landing on a Victoria spot is worse than no card at all — it tells a cold
 * visitor, in the one element meant to prove the product knows their water,
 * that it does not.
 *
 * The representative spot is the city's BUSIEST one — most catch reports in the
 * intel window — not its top-scoring one. Those are different spots and the
 * difference matters on an ad: ranking Victoria by score returns a Dungeness
 * crab mark on the waterfront, while ranking by activity returns Constance
 * Bank, which is the water a Victoria salmon angler actually recognises. A cold
 * visitor judges the product on whether the spot name means something to them.
 *
 * Score is the tie-break and the fallback, so a city with no recent reports
 * still gets its best-scoring spot rather than nothing. Note this deliberately
 * diverges from /lp/1/[city], which ranks purely by score.
 *
 * Every upstream call here goes through bcGet, which sets `next: { revalidate }`
 * (300s for spots, 600s for fresh catches). They ride the Data Cache, so the
 * dynamic render these pages do — forced by reading `searchParams` for the
 * angle — costs a React pass against warm cache entries rather than the
 * uncached round trips lp-entry.ts's redirect argument is about.
 */
export interface LpCard {
  /** Real city display name, e.g. "Friday Harbor". */
  cityName: string;
  spotName: string;
  /** Driver species display name, e.g. "Chinook". */
  species: string;
  /** Mono sub-line under the spot name. */
  meta: string;
  score: number;
  /** GOOD · FAIR · POOR, matching the card's colour token. */
  tagWord: string;
  tier: "good" | "fair" | "poor" | "none";
  /** "6:00 AM – 1:00 PM", or null when the day has no usable peak. */
  windowTime: string | null;
  windowNote: string | null;
  /** 24 bar heights, 0–100, midnight → midnight. Nulls flattened to 0. */
  hours: number[];
  /** Inclusive bar indices to paint as the best window. -1/-2 = none. */
  bestFrom: number;
  bestTo: number;
  freshCatches: number;
  freshWindowDays: number;
}

/**
 * Widen from the peak hour while the score stays within `PEAK_BAND` of it.
 *
 * A single peak hour is not what an angler plans around, and "best window"
 * promises a stretch of time. Ten points is wide enough to keep a genuine
 * shoulder on a flat-topped day and tight enough that a day with one real spike
 * does not get reported as an all-day bite.
 */
const PEAK_BAND = 8;

/**
 * Hard cap on how long a "best window" may claim to be.
 *
 * Without it, a flat day widens until the window is the whole daylight period —
 * the first build of this returned "6 AM – 9 PM" for several cities. A
 * fifteen-hour window is not a window, and printing one under a headline that
 * promises the exact hours to fish argues against the product on its own
 * landing page. Six hours is a tide cycle's worth of fishing: long enough to
 * plan a trip around, short enough to still be a claim.
 */
const MAX_WINDOW_HOURS = 6;

function bestWindow(hours: number[]): { from: number; to: number; peak: number } | null {
  let peak = -1;
  let peakIdx = -1;
  hours.forEach((h, i) => {
    if (h > peak) {
      peak = h;
      peakIdx = i;
    }
  });
  if (peakIdx < 0 || peak <= 0) return null;

  // Grow out from the peak toward whichever neighbour still scores higher,
  // staying inside the band and stopping at the cap.
  const floor = Math.max(0, peak - PEAK_BAND);
  let from = peakIdx;
  let to = peakIdx;
  while (to - from + 1 < MAX_WINDOW_HOURS) {
    const left = from > 0 ? hours[from - 1] : -1;
    const right = to < hours.length - 1 ? hours[to + 1] : -1;
    if (Math.max(left, right) < floor) break;
    if (right >= left) to++;
    else from--;
  }
  return { from, to, peak };
}

/**
 * Returns the card for a city, or null when there is nothing to show — unknown
 * slug, or no published spot with a score. Callers 404 on null rather than
 * falling back to another city: a silent swap would spend one city's ad budget
 * on another city's page and make the campaign read as a success.
 */
export async function resolveLpCard(citySlug: string): Promise<LpCard | null> {
  const [hierarchy, payload, fresh] = await Promise.all([
    fetchHierarchy(),
    fetchMapSpots({ city: citySlug }),
    fetchFreshCatches({ city: citySlug, days: 14 }),
  ]);
  if (!hierarchy || !payload) return null;

  const data = buildExploreData(hierarchy, payload);
  const candidates = data.spots.filter((s) => s.citySlug === citySlug && s.score !== null);
  if (!candidates.length) return null;

  // Busiest first, score as tie-break and as the fallback when nothing in this
  // city has been reported recently.
  const catchesFor = (id: string) => fresh?.spots[id]?.count ?? 0;
  const rep = candidates.sort((a, b) => {
    const byCatches = catchesFor(b.id) - catchesFor(a.id);
    return byCatches !== 0 ? byCatches : (b.score ?? 0) - (a.score ?? 0);
  })[0];

  const hours = rep.hours24.map((h) => (h == null ? 0 : Math.round(h)));
  const window = bestWindow(hours);
  const tier = tierFor(rep.score);
  const species = rep.driverSpecies ?? "Fish";

  const freshEntry = fresh?.spots[rep.id] ?? null;

  return {
    cityName: rep.cityName,
    spotName: rep.name,
    species,
    // Species and city, nothing more. The old card said "NEAR YOU" about a
    // fixed spot, which stopped being true the moment the route carried a city;
    // and a "top spot" claim would be the wrong one to make here, since the
    // ranking is by activity. The catch line below the bars carries that fact
    // with a real number behind it.
    meta: `${species} · ${rep.cityName}`.toUpperCase(),
    score: rep.score ?? 0,
    tagWord: tier === "none" ? "" : tier.toUpperCase(),
    tier,
    windowTime: window
      ? `${formatHour12(window.from)} – ${formatHour12(Math.min(window.to + 1, 23))}`
      : null,
    windowNote: window ? `Peaks at ${window.peak}` : null,
    hours,
    bestFrom: window?.from ?? -1,
    bestTo: window?.to ?? -2,
    freshCatches: freshEntry?.count ?? 0,
    freshWindowDays: fresh?.days ?? 14,
  };
}

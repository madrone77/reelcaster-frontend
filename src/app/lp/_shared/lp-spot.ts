import {
  fetchFreshCatches,
  fetchHierarchy,
  fetchMapSpots,
  type FreshCatchesPayload,
  type MapSpeciesStrip,
  type MapSpotsPayload,
} from "@/lib/bluecaster";
import { buildExploreData, tierFor } from "@/app/explore/lib/explore-data";
import { formatHour12 } from "@/lib/time-format";
import { resolveLpSpecies, type LpSpecies } from "./lp-species";

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
 * Target species come first, ahead of activity: the ad copy sells salmon,
 * halibut and lingcod, and Sidney's busiest mark is a Dungeness crab spot. A
 * crab card under a headline about the bite is off-message even when the
 * underlying number is honest.
 *
 * Then activity, then score as the final tie-break. Each rule is a fallback for
 * the one before it, so a city with no target-species spot still shows its
 * busiest, and a city with no recent reports still shows its best-scoring.
 * Note this deliberately diverges from /lp/1/[city], which ranks purely by
 * score.
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
  /**
   * The spot's own province code, e.g. "BC" or "WA". Carried so the page can
   * name the right fisheries authority: these pages ship in two countries, and
   * a Seattle page citing DFO tide stations and PFMA areas is wrong about the
   * one subject a regulations feature exists to be right about.
   */
  provinceCode: string;
  spotName: string;
  /** Driver species display name, e.g. "Chinook". */
  species: string;
  /** Mono sub-line under the spot name. */
  meta: string;
  score: number;
  /** GOOD · FAIR · POOR, matching the card's colour token. */
  tagWord: string;
  tier: "good" | "fair" | "poor" | "none";
  /** "6 AM – 1 PM", or null when the day has no usable peak. */
  windowTime: string | null;
  windowNote: string | null;
  /** 24 bar heights, 0–100, midnight → midnight. Nulls flattened to 0. */
  hours: number[];
  /** Inclusive bar indices to paint as the best window. -1/-2 = none. */
  bestFrom: number;
  bestTo: number;
  freshCatches: number;
  freshWindowDays: number;
  /**
   * The species the ad asked for, when the whole card was built around it.
   * Null on the untargeted path, which is every variant except /lp/4 and /lp/4
   * itself whenever the requested species has nothing scored in this city.
   * The page reads it to decide whether it may name a species in the copy: the
   * headline and the card have to agree or neither is believed.
   */
  targetedSpecies: string | null;
}

/**
 * Widen from the peak hour while the score stays within `PEAK_BAND` of it.
 *
 * A single peak hour is not what an angler plans around, and "best window"
 * promises a stretch of time. Ten points is wide enough to keep a genuine
 * shoulder on a flat-topped day and tight enough that a day with one real spike
 * does not get reported as an all-day bite.
 */
/**
 * Species the landing pages are allowed to lead with.
 *
 * Matched on a letters-only lowercase form of the display name, so "Pacific
 * Halibut" and "Ling Cod" both land — species names carry qualifiers, and
 * "Pacific" in particular is stripped at display time but not in the data, so
 * an exact-match list would quietly miss rows. Substring matching also covers
 * every salmon (Chinook, Coho, Sockeye, Pink, Chum) with one entry.
 */
const PREFERRED_SPECIES = ["salmon", "halibut", "lingcod"];

function isPreferredSpecies(name: string | null): boolean {
  if (!name) return false;
  const normalized = name.toLowerCase().replace(/[^a-z]/g, "");
  return PREFERRED_SPECIES.some((p) => normalized.includes(p));
}

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

/** One entry of the explore build, which is what the ranking works over. */
type LpCandidate = ReturnType<typeof buildExploreData>["spots"][number];

/**
 * The card for a species the ad asked for, or null when this city scores
 * nothing for it today.
 *
 * Null is a real answer and the caller falls back to the untargeted card. A
 * chinook link landing on a city with no chinook water should quietly become
 * the generic page, not a fabricated chinook card: the number on the card is
 * the one thing on the page a cold visitor can check.
 *
 * Everything here reads the requested species' own strip out of the payload
 * that has already been fetched, so a targeted card costs no extra round trip.
 * That matters more than it sounds: the score, the bars, and the best window
 * all describe the same species the headline names, rather than the spot's
 * best species with a different label pasted over it.
 *
 * Ranking is season, then reports for this species, then the species' own
 * peak. Season leads because an out-of-season spot is a bad ad even when its
 * arithmetic is fine, and reports lead score for the reason the untargeted
 * ranking uses activity: a cold visitor judges the product on whether the spot
 * name means something to them.
 */
function cardForSpecies(
  species: LpSpecies,
  candidates: LpCandidate[],
  payload: MapSpotsPayload,
  fresh: FreshCatchesPayload | null,
): LpCard | null {
  const entries = new Map(payload.spots.map((e) => [e.id, e]));
  const scored = candidates
    .map((spot) => ({ spot, strip: entries.get(spot.id)?.scores?.[species.id] }))
    .filter((c): c is { spot: LpCandidate; strip: MapSpeciesStrip } => Boolean(c.strip));
  if (!scored.length) return null;

  const seasonRank = (strip: MapSpeciesStrip) =>
    strip.season === "peak" ? 0 : strip.season === "mid" ? 1 : 2;
  const reportsFor = (id: string) => fresh?.spots[id]?.species?.[species.id]?.count ?? 0;

  const rep = scored.sort((a, b) => {
    const bySeason = seasonRank(a.strip) - seasonRank(b.strip);
    if (bySeason !== 0) return bySeason;
    const byReports = reportsFor(b.spot.id) - reportsFor(a.spot.id);
    if (byReports !== 0) return byReports;
    return b.strip.peak - a.strip.peak;
  })[0];

  const hours = rep.strip.hours.map((h) => (h ? Math.round(h.s * 100) : 0));
  const window = bestWindow(hours);
  const score = Math.round(rep.strip.peak * 100);
  const tier = tierFor(score);

  return {
    cityName: rep.spot.cityName,
    provinceCode: rep.spot.provinceCode,
    spotName: rep.spot.name,
    species: species.label,
    meta: `${species.label} · ${rep.spot.cityName}`.toUpperCase(),
    score,
    tagWord: tier === "none" ? "" : tier.toUpperCase(),
    tier,
    windowTime: window
      ? `${formatHour12(window.from)} – ${formatHour12(Math.min(window.to + 1, 23))}`
      : null,
    windowNote: window ? `Peaks at ${window.peak}` : null,
    hours,
    bestFrom: window?.from ?? -1,
    bestTo: window?.to ?? -2,
    // This species' reports, not the spot's. A halibut card claiming the
    // spot's 40 salmon reports would be the kind of true-but-wrong number that
    // costs more trust than it buys.
    freshCatches: reportsFor(rep.spot.id),
    freshWindowDays: fresh?.days ?? 14,
    targetedSpecies: species.label,
  };
}

/**
 * Returns the card for a city, or null when there is nothing to show — unknown
 * slug, or no published spot with a score. Callers 404 on null rather than
 * falling back to another city: a silent swap would spend one city's ad budget
 * on another city's page and make the campaign read as a success.
 *
 * `opts.species` is the ad link's `?species=`. When it resolves and the city
 * has water scored for it, the card is built around that species; otherwise
 * this is exactly the function /lp/1 through /lp/3 have always called.
 */
export async function resolveLpCard(
  citySlug: string,
  opts?: { species?: string | string[] | null },
): Promise<LpCard | null> {
  const [hierarchy, payload, fresh] = await Promise.all([
    fetchHierarchy(),
    fetchMapSpots({ city: citySlug }),
    fetchFreshCatches({ city: citySlug, days: 14 }),
  ]);
  if (!hierarchy || !payload) return null;

  const data = buildExploreData(hierarchy, payload);
  const candidates = data.spots.filter((s) => s.citySlug === citySlug && s.score !== null);
  if (!candidates.length) return null;

  const target = opts?.species ? resolveLpSpecies(payload, opts.species) : null;
  if (target) {
    const targeted = cardForSpecies(target, candidates, payload, fresh);
    if (targeted) return targeted;
    // Nothing scored for that species here today. Fall through to the
    // untargeted card, and the page drops the species from its copy with it.
  }

  // Target species, then busiest, then best-scoring. Each step falls through to
  // the next, so no city is left without a card.
  const catchesFor = (id: string) => fresh?.spots[id]?.count ?? 0;
  const speciesRank = (s: (typeof candidates)[number]) =>
    isPreferredSpecies(s.driverSpecies) ? 0 : 1;
  const rep = candidates.sort((a, b) => {
    const bySpecies = speciesRank(a) - speciesRank(b);
    if (bySpecies !== 0) return bySpecies;
    const byCatches = catchesFor(b.id) - catchesFor(a.id);
    if (byCatches !== 0) return byCatches;
    return (b.score ?? 0) - (a.score ?? 0);
  })[0];

  const hours = rep.hours24.map((h) => (h == null ? 0 : Math.round(h)));
  const window = bestWindow(hours);
  const tier = tierFor(rep.score);
  const species = rep.driverSpecies ?? "Fish";

  const freshEntry = fresh?.spots[rep.id] ?? null;

  return {
    cityName: rep.cityName,
    provinceCode: rep.provinceCode,
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
    targetedSpecies: null,
  };
}

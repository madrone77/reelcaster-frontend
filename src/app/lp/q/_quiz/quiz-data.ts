import {
  fetchCityPage,
  fetchFreshCatches,
  fetchMapSpots,
  type MapSpotsPayload,
} from "@/lib/bluecaster";
import { spotAccessOf, shoreTypeLabel } from "@/lib/spot-access";
import { inflateMapSpotsBody } from "@/lib/map-pins";
import { speciesDisplayName } from "@/app/explore/lib/explore-data";
import { windowAround } from "../../_reel/city-proof";
import { lpRegionFor } from "../../_shared/lp-region";
import {
  distanceKm,
  pickSpot,
  rankSpecies,
  type EvidenceSource,
  type EvidenceSpot,
  type KeptByArea,
  type ReportCounts,
  type SpeciesRef,
} from "./evidence";

/**
 * Everything the quiz needs from the server, resolved once per city.
 *
 * The quiz runs entirely in the browser, so every possible result is built
 * here before the first tap: for each species on offer, the spot a boat
 * angler should go and the spot a shore angler should go. That is at most
 * ten small objects.
 *
 * The species on offer and the spots are chosen from REAL catches (see
 * ./evidence.ts), over a wide box around the city: the evidence decides how
 * far out the answer is, not the city's own roster.
 *
 * No counts reach the browser. Report counts are Pro data behind the app's
 * own proxy; the page only learns which KIND of evidence picked a spot.
 */

export interface QuizPick {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  access: "boat" | "shore";
  shoreKind: string | null;
  /** Today's peak, 0..100. */
  score: number;
  /** Local hours of today's best window, -1 when there is none. */
  bestFrom: number;
  bestTo: number;
  /** What picked it: reports at the spot, fish kept in its area, or score. */
  source: EvidenceSource;
  /** "Marine Area 9" when kept fish in that area picked it. */
  areaLabel: string | null;
  /** Straight line from the city, rounded. */
  distanceKm: number;
}

export interface QuizSpecies {
  slug: string;
  name: string;
  /** Somebody is landing this fish right now (reports or kept). */
  proven: boolean;
  boat: QuizPick | null;
  shore: QuizPick | null;
}

export interface QuizData {
  citySlug: string;
  cityName: string;
  provinceCode: string;
  regulator: string;
  isUS: boolean;
  /** Spots with any score today inside the evidence box. */
  spotCount: number;
  /** Up to five, most evidence first. */
  species: QuizSpecies[];
}

const MAX_SPECIES = 5;
/** Reports window. A month catches a run without dredging up last season. */
const REPORT_DAYS = 30;
/**
 * Half-size of the evidence box, in degrees. About 100 km north-south and
 * 100 km east-west at these latitudes: far enough for Seattle's halibut in
 * Admiralty Inlet, not so far that a Victoria reader is sent to Tofino.
 */
const BOX_LAT = 0.9;
const BOX_LNG = 1.3;

/**
 * "Pacific Halibut" reads as "Halibut" to everyone who fishes for one, and the
 * roster's casing is uneven ("Coho Salmon" beside "Pink salmon").
 */
function shortSpecies(name: string): string {
  return speciesDisplayName(name)
    .replace(/^Pacific /, "")
    // "Rockfish (Aggregate)" is a scoring bucket, not a name anyone says.
    .replace(/\s*\(.*?\)\s*/g, " ")
    .trim()
    .replace(/\b([a-z])/g, (c) => c.toUpperCase());
}

function toEvidenceSpots(payload: MapSpotsPayload): EvidenceSpot[] {
  const out: EvidenceSpot[] = [];
  for (const s of payload.spots) {
    const scores: EvidenceSpot["scores"] = {};
    for (const [id, strip] of Object.entries(s.scores ?? {})) {
      if (!strip || typeof strip.peak !== "number") continue;
      scores[id] = {
        score: Math.round(strip.peak * 100),
        peakHour: strip.peak_hour,
        hours: strip.hours.map((h) => (h && typeof h.s === "number" ? Math.round(h.s * 100) : 0)),
      };
    }
    if (!Object.keys(scores).length) continue;
    const access = spotAccessOf(s.access, s.shore_type);
    out.push({
      id: s.id,
      slug: s.slug,
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      access,
      shoreKind: access === "shore" ? shoreTypeLabel(s.shore_type) : null,
      area: s.area ?? null,
      areaAgency: s.area_agency ?? null,
      trackRecord: s.track_record ?? null,
      scores,
    });
  }
  return out;
}

export async function loadQuizData(citySlug: string): Promise<QuizData | null> {
  const page = await fetchCityPage(citySlug);
  const city = page?.hierarchy?.city;
  if (!page || !city || typeof city.lat !== "number") return null;

  const bbox = [city.lng - BOX_LNG, city.lat - BOX_LAT, city.lng + BOX_LNG, city.lat + BOX_LAT]
    .map((n) => n.toFixed(3))
    .join(",");
  // The slim pins body: the full one for a box this size is ~3 MB, over the
  // Data Cache's 2 MB ceiling, so every render would refetch it uncached.
  const [body, fresh] = await Promise.all([
    fetchMapSpots({ bbox, shape: "pins" }),
    fetchFreshCatches({ days: REPORT_DAYS }),
  ]);
  const payload = body ? inflateMapSpotsBody(body) : null;
  if (!payload) return null;

  // Same regulator only. A Seattle reader is never sent to a Victoria mark:
  // different rules, a border, and a licence they do not hold. A spot with no
  // area on record is kept only when it is plainly local.
  const provinceCode = page.hierarchy.province.code.toUpperCase();
  const region = lpRegionFor(provinceCode);
  const ownAgency = region.isUS ? (provinceCode === "WA" ? "WDFW" : null) : "DFO";
  const spots = toEvidenceSpots(payload).filter((s) => {
    const agency = (s.areaAgency ?? "").toUpperCase();
    if (agency) return ownAgency ? agency === ownAgency : agency !== "DFO";
    return distanceKm(city, s) <= 25;
  });
  if (!spots.length) return null;

  const reports: ReportCounts = {};
  for (const [spotId, entry] of Object.entries(fresh?.spots ?? {})) {
    const bySpecies: Record<string, number> = {};
    for (const [speciesId, s] of Object.entries(entry.species ?? {})) {
      if (s.positive > 0) bySpecies[speciesId] = s.positive;
    }
    reports[spotId] = bySpecies;
  }

  const kept: KeptByArea = {};
  for (const a of page.creel?.areas ?? []) {
    const byName: Record<string, number> = {};
    for (const k of a.kept) if (k.kept > 0) byName[k.species] = k.kept;
    kept[a.area_number] = byName;
  }
  const isWdfwArea = (s: EvidenceSpot) => (s.areaAgency ?? "").toUpperCase() === "WDFW" && !!s.area;

  const refs: Record<string, SpeciesRef> = {};
  for (const [id, s] of Object.entries(payload.species)) refs[id] = { id, slug: s.slug, name: s.name };

  let ranked = rankSpecies(spots, refs, reports, kept, isWdfwArea, city).map((e) => ({ ref: e.species, proven: true }));
  if (!ranked.length) {
    // No catches anywhere in the box. Offer what is scored most widely rather
    // than nothing, and the result page will not claim a catch for any of it.
    const coverage = new Map<string, number>();
    for (const s of spots) for (const id of Object.keys(s.scores)) coverage.set(id, (coverage.get(id) ?? 0) + 1);
    ranked = [...coverage.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => refs[id])
      .filter(Boolean)
      .map((ref) => ({ ref, proven: false }));
  }

  const toPick = (p: ReturnType<typeof pickSpot>): QuizPick | null => {
    if (!p) return null;
    const sc = p.spot.scores[p.speciesId];
    const win = sc ? windowAround(sc.hours, sc.peakHour) : null;
    return {
      slug: p.spot.slug,
      name: p.spot.name,
      lat: p.spot.lat,
      lng: p.spot.lng,
      access: p.spot.access,
      shoreKind: p.spot.shoreKind,
      score: sc?.score ?? 0,
      bestFrom: win?.from ?? -1,
      bestTo: win?.to ?? -1,
      source: p.source,
      areaLabel: p.areaLabel,
      distanceKm: Math.round(distanceKm(city, p.spot)),
    };
  };

  const built: QuizSpecies[] = ranked.map(({ ref, proven }) => ({
    slug: ref.slug,
    name: shortSpecies(ref.name),
    proven,
    boat: toPick(pickSpot(spots, ref.id, ref.name, "boat", reports, kept, isWdfwArea, city)),
    shore: toPick(pickSpot(spots, ref.id, ref.name, "shore", reports, kept, isWdfwArea, city)),
  }));
  // A fish is offered only when there is a spot to send the reader to where
  // it is actually being caught. Being landed somewhere in the area is not
  // enough if every water it is open on today has no catches: that is the
  // Chinook a Seattle reader would drive to Tacoma for on a score alone.
  const hasEvidence = (p: QuizPick | null) => !!p && p.source !== "score";
  const provenSpecies = built.filter((s) => s.proven && (hasEvidence(s.boat) || hasEvidence(s.shore)));
  const species = (provenSpecies.length ? provenSpecies : built).slice(0, MAX_SPECIES);

  return {
    citySlug,
    cityName: city.name,
    provinceCode,
    regulator: region.regulator.name,
    isUS: region.isUS,
    spotCount: spots.length,
    species,
  };
}

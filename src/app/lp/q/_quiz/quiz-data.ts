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
import { timezoneFor } from "@/lib/regions";
import {
  NEAR_KM,
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
  /** The scoring species id, for the live screen the result page fetches. */
  speciesId: string;
  /** Today's peak, 0..100. */
  score: number;
  /** Today's 24 hourly scores at this spot for this fish, 0..100. */
  hours: number[];
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

/** A scored spot on the result page's map. */
export interface QuizPin {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  score: number;
  access: "boat" | "shore";
  /** Straight line from the city, rounded. The page keeps a kayak's map
   *  inside KAYAK_REACH_KM. */
  distanceKm: number;
}

export interface QuizSpecies {
  slug: string;
  name: string;
  /** Somebody is landing this fish right now (reports or kept). */
  proven: boolean;
  boat: QuizPick | null;
  /** The boat pick inside a paddle of the city, or null. */
  kayak: QuizPick | null;
  shore: QuizPick | null;
  /** The best-scored spots for this fish near the city, for the map. Boat
   *  and shore mixed; the page filters by the reader's own access and reach. */
  pins: QuizPin[];
  /** Offered to boat readers. */
  boatOffer: boolean;
  /** Offered to kayak readers: a boat spot within KAYAK_REACH_KM has catches. */
  kayakOffer: boolean;
  /** Offered to shore readers. */
  shoreOffer: boolean;
}

export interface QuizData {
  citySlug: string;
  cityName: string;
  provinceCode: string;
  regulator: string;
  isUS: boolean;
  /** The city's clock, for the live screen. */
  tz: string;
  /** Spots with any score today inside the evidence box. */
  spotCount: number;
  /** Most evidence first. The quiz shows up to five of those offered for
   *  the reader's own access (see speciesFor in persona.ts). */
  species: QuizSpecies[];
}

/** Reports window. A month catches a run without dredging up last season. */
const REPORT_DAYS = 30;
/**
 * Half-size of the evidence box, in degrees. About 100 km north-south and
 * 100 km east-west at these latitudes: far enough for Seattle's halibut in
 * Admiralty Inlet, not so far that a Victoria reader is sent to Tofino.
 */
const BOX_LAT = 0.9;
const BOX_LNG = 1.3;
/** Pins per access on the result map. Enough to read as a roster, few enough
 *  that the payload stays small. */
const PINS_PER_ACCESS = 8;

/**
 * How far a spot may be from the city, straight line, by how the reader
 * gets there. The evidence box is 100 km wide so a Seattle reader's halibut
 * can be found in Admiralty Inlet, but the box is where evidence is LOOKED
 * FOR, not where a reader is sent. Vancouver's best lingcod reports are at
 * Thrasher Rock, 42 km away across the open Strait of Georgia: a run for a
 * big boat on a calm day and no place to send a kayak, ever (Casey,
 * 2026-09-25). So a boat is sent at most 30 km and a kayak at most 15 km,
 * and a fish with no spot inside that reach is simply not offered to that
 * reader, the same rule the shore reader already had.
 */
export const BOAT_REACH_KM = 30;
export const KAYAK_REACH_KM = 15;

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

  const hasEvidence = (p: QuizPick | null) => !!p && p.source !== "score";

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
      speciesId: p.speciesId,
      score: sc?.score ?? 0,
      hours: sc?.hours ?? [],
      bestFrom: win?.from ?? -1,
      bestTo: win?.to ?? -1,
      source: p.source,
      areaLabel: p.areaLabel,
      distanceKm: Math.round(distanceKm(city, p.spot)),
    };
  };

  // Crab is what a shore reader most often comes for, and it is steady
  // rather than a run that posts announce, so a crab scored at a shore spot
  // near the city is offered to shore readers even without recent posts. The
  // card then says "best-rated today", never that crab are being caught.
  const nearShoreCrab = new Set<string>();
  for (const s of spots) {
    if (s.access !== "shore" || distanceKm(city, s) > NEAR_KM) continue;
    for (const id of Object.keys(s.scores)) if (/crab/i.test(refs[id]?.name ?? "")) nearShoreCrab.add(id);
  }
  const pool = [...ranked];
  for (const id of nearShoreCrab) {
    if (!pool.some((r) => r.ref.id === id) && refs[id]) pool.push({ ref: refs[id], proven: false });
  }

  // The map behind the result: the best-scored spots for the fish within the
  // near ring, most of them boat marks, every shore spot kept so a shore
  // reader's map is not empty. Eight boat and eight shore at most.
  const pinsFor = (speciesId: string): QuizPin[] => {
    const near = spots.filter((s) => s.scores[speciesId] && distanceKm(city, s) <= BOAT_REACH_KM);
    const take = (access: "boat" | "shore") =>
      near
        .filter((s) => s.access === access)
        .sort((a, b) => b.scores[speciesId].score - a.scores[speciesId].score)
        .slice(0, PINS_PER_ACCESS)
        .map((s) => ({
          slug: s.slug,
          name: s.name,
          lat: s.lat,
          lng: s.lng,
          score: s.scores[speciesId].score,
          access,
          distanceKm: Math.round(distanceKm(city, s)),
        }));
    return [...take("boat"), ...take("shore")];
  };

  // Where each kind of reader can be sent. Shore keeps the evidence ring
  // (a drive); a boat and a kayak get the reach above.
  const boatWater = spots.filter((s) => distanceKm(city, s) <= BOAT_REACH_KM);
  const kayakWater = spots.filter((s) => distanceKm(city, s) <= KAYAK_REACH_KM);

  const built: QuizSpecies[] = pool.map(({ ref, proven }) => {
    const boat = toPick(pickSpot(boatWater, ref.id, ref.name, "boat", reports, kept, isWdfwArea, city));
    const kayak = toPick(pickSpot(kayakWater, ref.id, ref.name, "boat", reports, kept, isWdfwArea, city));
    const shore = toPick(pickSpot(spots, ref.id, ref.name, "shore", reports, kept, isWdfwArea, city));
    const crab = /crab/i.test(ref.name);
    return {
      slug: ref.slug,
      name: shortSpecies(ref.name),
      proven,
      boat,
      kayak,
      shore,
      pins: pinsFor(ref.id),
      // Boat: only where a spot has catches of it, inside the boat's reach.
      // That is the Chinook a Seattle reader would otherwise drive to Tacoma
      // for on a score alone, and the lingcod a Vancouver reader would
      // otherwise be sent across the Strait for.
      boatOffer: proven && hasEvidence(boat),
      kayakOffer: proven && hasEvidence(kayak),
      // Shore: a shore spot exists for it (never halibut or lingcod off a
      // pier, see evidence.ts) and somebody is landing it, or it is crab.
      shoreOffer: !!shore && (proven || (crab && nearShoreCrab.has(ref.id))),
    };
  });
  const offered = built.filter((s) => s.boatOffer || s.kayakOffer || s.shoreOffer);
  const species = offered.length
    ? offered
    : built.map((s) => ({ ...s, boatOffer: !!s.boat, kayakOffer: !!s.kayak, shoreOffer: !!s.shore }));

  return {
    citySlug,
    cityName: city.name,
    provinceCode,
    regulator: region.regulator.name,
    isUS: region.isUS,
    tz: timezoneFor(provinceCode),
    spotCount: spots.length,
    species,
  };
}

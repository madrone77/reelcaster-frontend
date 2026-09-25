/**
 * Which fish are actually being caught around a city, and where.
 *
 * The quiz only offers a species that somebody is landing right now, and the
 * spot it shows is the one the catches point to, even when that water is a
 * long run from the city. A Seattle reader who picks Halibut is sent up to
 * Admiralty Inlet, because that is where the halibut are being kept, not to
 * the best-scoring halibut mark in Elliott Bay.
 *
 * Two kinds of evidence, both real:
 *
 *   reports  Forum and report posts resolved to a spot and a species
 *            (BlueCaster's fresh-catches counts, positive posts only).
 *            Spot grain. This is most of BC.
 *   kept     WDFW dockside checks: fish kept per species per Marine Area.
 *            Area grain, and nearly the whole of Washington's evidence,
 *            because Puget Sound anglers barely post.
 *
 * Pure: no fetches, so it can be tested with `npx tsx`.
 */

export type EvidenceSource = "reports" | "kept" | "score";

export interface EvidenceSpot {
  id: string;
  slug: string;
  name: string;
  lat: number;
  lng: number;
  access: "boat" | "shore";
  shoreKind: string | null;
  /** WDFW Marine Area or DFO subarea, as the regulator writes it. */
  area: string | null;
  areaAgency: string | null;
  /** "popular" | "known" | "sparse" | null: a year of reports, as an order. */
  trackRecord: string | null;
  /** Today's score (0..100) per species id, where scored. */
  scores: Record<string, { score: number; peakHour: number; hours: number[] }>;
}

export interface SpeciesRef {
  id: string;
  slug: string;
  name: string;
}

/** Positive report posts per spot id per species id. */
export type ReportCounts = Record<string, Record<string, number>>;

/** Fish kept per Marine Area number per lower-cased species name. */
export type KeptByArea = Record<string, Record<string, number>>;

/**
 * "Near" is a normal run from the city's ramps: about an hour at cruising
 * speed, or a drive for a shore angler. Evidence inside it is always
 * preferred; the page only sends a reader further when nothing near is
 * being caught.
 */
export const NEAR_KM = 45;

/** Below these, the evidence is a rumour, not a run. */
export const MIN_REPORTS = 2;
export const MIN_KEPT = 5;

/** "Pacific Halibut" and "Halibut" are the same fish on this coast. */
export function speciesKey(name: string): string {
  return name.toLowerCase().replace(/^pacific /, "").replace(/\s*\(.*?\)\s*/g, " ").trim();
}

export interface SpeciesEvidence {
  species: SpeciesRef;
  reports: number;
  kept: number;
  /** Comparable weight across the two sources. */
  weight: number;
}

/**
 * The species worth offering, most evidence first. Only species scored today
 * at one or more of these spots: an open fish we can show a score for.
 */
export function rankSpecies(
  spots: EvidenceSpot[],
  species: Record<string, SpeciesRef>,
  reports: ReportCounts,
  kept: KeptByArea,
  isWdfwArea: (spot: EvidenceSpot) => boolean,
  center: { lat: number; lng: number },
): SpeciesEvidence[] {
  const scored = new Set<string>();
  for (const s of spots) for (const id of Object.keys(s.scores)) scored.add(id);

  // Raw posts decide whether a fish is offered at all; distance-weighted
  // posts decide the order, so a run on the reader's own water outranks a
  // bigger one an hour and a half away.
  const reportTotal = new Map<string, number>();
  const reportNear = new Map<string, number>();
  for (const s of spots) {
    const r = reports[s.id];
    if (!r) continue;
    const decay = 1 / (1 + distanceKm(center, s) / NEAR_KM);
    for (const [id, n] of Object.entries(r)) {
      reportTotal.set(id, (reportTotal.get(id) ?? 0) + n);
      reportNear.set(id, (reportNear.get(id) ?? 0) + n * decay);
    }
  }

  // Kept is per area, so count each area once, and only areas these spots sit in.
  const areas = new Set(spots.filter(isWdfwArea).map((s) => s.area!).filter(Boolean));
  const keptByKey = new Map<string, number>();
  for (const a of areas) {
    for (const [name, n] of Object.entries(kept[a] ?? {})) {
      const k = speciesKey(name);
      keptByKey.set(k, (keptByKey.get(k) ?? 0) + n);
    }
  }

  const out: SpeciesEvidence[] = [];
  for (const id of scored) {
    const ref = species[id];
    if (!ref) continue;
    const r = reportTotal.get(id) ?? 0;
    const k = keptByKey.get(speciesKey(ref.name)) ?? 0;
    if (r < MIN_REPORTS && k < MIN_KEPT) continue;
    // A kept fish is a certainty and a post is a claim, but checks run to
    // thousands a fortnight: scale them onto the posts' range.
    out.push({ species: ref, reports: r, kept: k, weight: (reportNear.get(id) ?? 0) + Math.sqrt(k) * 2 });
  }
  return out.sort((a, b) => b.weight - a.weight);
}

export interface SpotPick {
  spot: EvidenceSpot;
  speciesId: string;
  source: EvidenceSource;
  /** Positive posts at this spot for this species (reports source). */
  reports: number;
  /** Fish kept across this spot's area (kept source). */
  kept: number;
  /** "Marine Area 9" style label for the kept source. */
  areaLabel: string | null;
}

const TRACK_ORDER: Record<string, number> = { popular: 0, known: 1, sparse: 2 };

/**
 * The spot to show for one species and one kind of access.
 *
 * 1. Spots with reports of this fish, most reports first, score breaking ties.
 * 2. Spots in the Marine Area where the most of this fish is being kept, the
 *    busiest water first (a year of reports), then score.
 * 3. Only when neither exists: the best score today, and the page says so
 *    rather than claiming a catch.
 *
 * Shore readers get a shore spot or nothing from tiers 1 and 2; a boat mark
 * a mile offshore is no use to someone standing on a pier.
 */
export function pickSpot(
  spots: EvidenceSpot[],
  speciesId: string,
  speciesName: string,
  access: "boat" | "shore",
  reports: ReportCounts,
  kept: KeptByArea,
  isWdfwArea: (spot: EvidenceSpot) => boolean,
  center: { lat: number; lng: number },
): SpotPick | null {
  const eligible = spots.filter((s) => s.scores[speciesId] && s.access === access);
  const near = eligible.filter((s) => distanceKm(center, s) <= NEAR_KM);

  // Shore: a drive, never a ferry. And a fish nobody lands from shore here
  // (halibut, lingcod off a pier) gets no shore spot at all rather than a
  // good score on water it does not come to.
  if (access === "shore") {
    const pick = pickIn(near, speciesId, speciesName, reports, kept, isWdfwArea, center);
    if (!pick) return null;
    if (pick.source === "score" && !SHORE_FISH.test(speciesName)) return null;
    return pick;
  }

  // Boat: the nearest water with evidence; further out only when the near
  // water has none, and the page says how far.
  const nearPick = pickIn(near, speciesId, speciesName, reports, kept, isWdfwArea, center);
  if (nearPick && nearPick.source !== "score") return nearPick;
  const farPick = pickIn(eligible, speciesId, speciesName, reports, kept, isWdfwArea, center);
  if (farPick && farPick.source !== "score") return farPick;
  return nearPick ?? farPick;
}

/** Fish a shore angler here can reasonably target without evidence. */
const SHORE_FISH = /salmon|coho|chinook|pink|chum|crab|perch|flounder|sole|herring|squid|rockfish|greenling|sculpin/i;

function pickIn(
  pool: EvidenceSpot[],
  speciesId: string,
  speciesName: string,
  reports: ReportCounts,
  kept: KeptByArea,
  isWdfwArea: (spot: EvidenceSpot) => boolean,
  center: { lat: number; lng: number },
): SpotPick | null {
  if (!pool.length) return null;
  const score = (s: EvidenceSpot) => s.scores[speciesId]?.score ?? 0;

  const reported = pool
    .map((s) => ({ s, n: reports[s.id]?.[speciesId] ?? 0 }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || score(b.s) - score(a.s));
  // Two posts at a spot is a pattern; one is an anecdote, and it must not
  // outvote an area where thousands of the same fish were checked this
  // fortnight. A lone post still beats nothing, after the kept tier.
  const asReport = (x: { s: EvidenceSpot; n: number }): SpotPick => ({
    spot: x.s, speciesId, source: "reports", reports: x.n, kept: 0, areaLabel: null,
  });
  if (reported.length && reported[0].n >= MIN_REPORTS) return asReport(reported[0]);

  const key = speciesKey(speciesName);
  const areaKept = (s: EvidenceSpot) => (isWdfwArea(s) && s.area ? kept[s.area] : undefined);
  const keptFor = (s: EvidenceSpot) => {
    const byName = areaKept(s);
    if (!byName) return 0;
    let n = 0;
    for (const [name, k] of Object.entries(byName)) if (speciesKey(name) === key) n += k;
    return n;
  };
  // Areas are compared on fish kept, discounted for the run out to the
  // area's nearest spot, so the reader's own water wins a near tie with the
  // next area over. Inside the winning area the busiest water leads (a year
  // of reports), then today's score: not simply the closest spot, which in
  // Seattle is an industrial waterway.
  const nearness = (km: number) => 1 / (1 + km / NEAR_KM);
  const areaNearest = new Map<string, number>();
  for (const s of pool) {
    if (!s.area) continue;
    const d = distanceKm(center, s);
    areaNearest.set(s.area, Math.min(areaNearest.get(s.area) ?? Infinity, d));
  }
  const areaWeight = (s: EvidenceSpot, k: number) => k * nearness(areaNearest.get(s.area ?? "") ?? 0);
  const inKeptWater = pool
    .map((s) => ({ s, k: keptFor(s) }))
    .filter((x) => x.k >= MIN_KEPT)
    .sort(
      (a, b) =>
        areaWeight(b.s, b.k) - areaWeight(a.s, a.k) ||
        (TRACK_ORDER[a.s.trackRecord ?? ""] ?? 3) - (TRACK_ORDER[b.s.trackRecord ?? ""] ?? 3) ||
        score(b.s) - score(a.s),
    );
  if (inKeptWater.length) {
    const top = inKeptWater[0];
    return {
      spot: top.s,
      speciesId,
      source: "kept",
      reports: 0,
      kept: top.k,
      areaLabel: top.s.area ? `Marine Area ${top.s.area}` : null,
    };
  }

  if (reported.length) return asReport(reported[0]);

  const best = [...pool].sort((a, b) => score(b) - score(a))[0];
  return { spot: best, speciesId, source: "score", reports: 0, kept: 0, areaLabel: null };
}

/** Great-circle distance in km, for "how far out" copy. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

import { fetchMapSpots, type MapSpotsPayload } from "@/lib/bluecaster";
import { spotAccessOf, shoreTypeLabel } from "@/lib/spot-access";
import { speciesDisplayName } from "@/app/explore/lib/explore-data";
import { windowAround } from "../../_reel/city-proof";
import { resolveLpCard } from "../../_shared/lp-spot";
import { lpRegionFor } from "../../_shared/lp-region";

/**
 * Everything the quiz needs from the server, resolved once per city.
 *
 * The quiz runs entirely in the browser (one page, no navigation between
 * questions, so nothing is lost to a slow network between taps), which means
 * every possible result has to be on the page before the first tap. That is
 * cheap: one best spot per species per access kind, plus the "whatever's
 * biting" pick, is a few dozen small objects.
 *
 * Today only, because today is what a signed-out reader is shown on the map
 * the result links to. Promising a spot the map then hides would be the worst
 * possible hand-off.
 */

export interface QuizPick {
  slug: string;
  name: string;
  /** 0..100 */
  score: number;
  /** Local hours, -1 when the day has no usable window. */
  bestFrom: number;
  bestTo: number;
  access: "boat" | "shore";
  /** "Pier", "Beach"... on shore spots. */
  shoreKind: string | null;
  /** Display name of the species the score is for. */
  species: string;
}

export interface QuizSpecies {
  slug: string;
  name: string;
  boat: QuizPick | null;
  shore: QuizPick | null;
}

export interface QuizData {
  citySlug: string;
  cityName: string;
  provinceCode: string;
  regulator: string;
  /** Spots with any score today, for the loading screen and the result. */
  spotCount: number;
  shoreCount: number;
  /** Up to five, most widely scored first. */
  species: QuizSpecies[];
  /** Best spot today on any species. */
  any: { boat: QuizPick | null; shore: QuizPick | null };
}

/** Shown on the species question. More than five and it scrolls on a phone. */
const MAX_SPECIES = 5;

/**
 * "Pacific Halibut" reads as "Halibut" to everyone who fishes for one, and the
 * roster's casing is uneven ("Coho Salmon" beside "Pink salmon"), so every
 * word is capitalised the same way on the buttons.
 */
function shortSpecies(name: string): string {
  return speciesDisplayName(name)
    .replace(/^Pacific /, "")
    // "Rockfish (Aggregate)" is a scoring bucket, not a name anyone says.
    .replace(/\s*\(.*?\)\s*/g, " ")
    .trim()
    .replace(/\b([a-z])/g, (c) => c.toUpperCase());
}

export function buildQuizData(
  payload: MapSpotsPayload,
  city: { slug: string; name: string; provinceCode: string },
): QuizData {
  const coverage = new Map<string, number>();
  const best = new Map<string, { boat: QuizPick | null; shore: QuizPick | null }>();
  const any: QuizData["any"] = { boat: null, shore: null };
  let spotCount = 0;
  let shoreCount = 0;

  for (const spot of payload.spots) {
    const strips = Object.entries(spot.scores ?? {});
    if (!strips.length) continue;
    spotCount++;
    const access = spotAccessOf(spot.access, spot.shore_type);
    if (access === "shore") shoreCount++;

    for (const [speciesId, strip] of strips) {
      if (!strip || typeof strip.peak !== "number") continue;
      coverage.set(speciesId, (coverage.get(speciesId) ?? 0) + 1);
      const hours = strip.hours.map((h) => (h && typeof h.s === "number" ? Math.round(h.s * 100) : 0));
      const win = windowAround(hours, strip.peak_hour);
      const pick: QuizPick = {
        slug: spot.slug,
        name: spot.name,
        score: Math.round(strip.peak * 100),
        bestFrom: win?.from ?? -1,
        bestTo: win?.to ?? -1,
        access,
        shoreKind: access === "shore" ? shoreTypeLabel(spot.shore_type) : null,
        species: shortSpecies(payload.species[speciesId]?.name ?? "Fish"),
      };
      const slot = best.get(speciesId) ?? { boat: null, shore: null };
      if (!slot[access] || pick.score > slot[access]!.score) slot[access] = pick;
      best.set(speciesId, slot);
      if (!any[access] || pick.score > any[access]!.score) any[access] = pick;
    }
  }

  const species: QuizSpecies[] = [...coverage.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_SPECIES)
    .map(([id]) => {
      const s = payload.species[id];
      const slot = best.get(id) ?? { boat: null, shore: null };
      return {
        slug: s?.slug ?? id,
        name: shortSpecies(s?.name ?? "Fish"),
        boat: slot.boat,
        shore: slot.shore,
      };
    });

  return {
    citySlug: city.slug,
    cityName: city.name,
    provinceCode: city.provinceCode,
    regulator: lpRegionFor(city.provinceCode).regulator.name,
    spotCount,
    shoreCount,
    species,
    any,
  };
}

/** Null when the city is unknown or has nothing scored today. */
export async function loadQuizData(citySlug: string): Promise<QuizData | null> {
  const [card, payload] = await Promise.all([
    resolveLpCard(citySlug),
    fetchMapSpots({ city: citySlug }),
  ]);
  if (!card || !payload) return null;
  const data = buildQuizData(payload, {
    slug: citySlug,
    name: card.cityName,
    provinceCode: card.provinceCode,
  });
  return data.spotCount > 0 ? data : null;
}

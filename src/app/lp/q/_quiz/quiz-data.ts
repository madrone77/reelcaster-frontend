import { fetchMapSpots, type MapSpotsPayload } from "@/lib/bluecaster";
import { speciesDisplayName } from "@/app/explore/lib/explore-data";
import { resolveLpCard } from "../../_shared/lp-spot";
import { lpRegionFor } from "../../_shared/lp-region";

/**
 * Everything the quiz needs from the server, resolved once per city: the
 * city's name and regulator, how many spots it scores, and the species it
 * scores today (the species question's options).
 *
 * The quiz runs entirely in the browser (one page, no navigation between
 * questions), so all of it has to be on the page before the first tap.
 * Today only: a species that is not scored today is not offered, so nobody
 * builds a plan around a fish the product cannot show them.
 */

export interface QuizSpecies {
  slug: string;
  name: string;
}

export interface QuizData {
  citySlug: string;
  cityName: string;
  provinceCode: string;
  regulator: string;
  /** Spots with any score today. */
  spotCount: number;
  /** Up to five, most widely scored first. */
  species: QuizSpecies[];
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
  let spotCount = 0;

  for (const spot of payload.spots) {
    const strips = Object.entries(spot.scores ?? {});
    if (!strips.length) continue;
    spotCount++;
    for (const [speciesId, strip] of strips) {
      if (!strip || typeof strip.peak !== "number") continue;
      coverage.set(speciesId, (coverage.get(speciesId) ?? 0) + 1);
    }
  }

  const species: QuizSpecies[] = [...coverage.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_SPECIES)
    .map(([id]) => {
      const s = payload.species[id];
      return { slug: s?.slug ?? id, name: shortSpecies(s?.name ?? "Fish") };
    });

  return {
    citySlug: city.slug,
    cityName: city.name,
    provinceCode: city.provinceCode,
    regulator: lpRegionFor(city.provinceCode).regulator.name,
    spotCount,
    species,
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

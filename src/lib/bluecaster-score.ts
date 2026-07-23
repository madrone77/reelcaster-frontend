/**
 * Bluecaster spot-score lookup for score-threshold alerts.
 *
 * Score alerts are anchored to a real ReelCaster spot + species (the same score
 * the user sees on the map/spot page), NOT the Open-Meteo score the generic
 * trigger engine computes. This fetches that score from the bluecaster API.
 *
 * Auth: `x-api-key: BLUECASTER_API_KEY` against `BLUECASTER_API_URL`.
 */

import 'server-only';

const API_URL = process.env.BLUECASTER_API_URL;
const API_KEY = process.env.BLUECASTER_API_KEY;

/** Shape of the bits of GET /api/v1/spots/[slug]/spot-page we consume. */
interface SpotPageScoreShape {
  species?: Array<{ id: string; slug: string; name?: string }>;
  // Today's PEAK score per species id, already scaled 0–100.
  topScoreTodayBySpecies?: Record<string, number>;
}

export interface SpotSpeciesScore {
  /** Today's peak score, 0–100. */
  score: number;
  /** True when we matched the requested species; false = best-species fallback. */
  speciesMatched: boolean;
  /** The species slug we actually scored on (may differ on fallback). */
  scoredSpeciesSlug: string | null;
}

/**
 * Today's peak fishing score (0–100) for a spot + species from bluecaster.
 *
 * Returns null when the API is unconfigured/unreachable, the slug is unknown,
 * or no species is scored at the spot — callers treat null as "cannot evaluate,
 * do not trigger" rather than a crash.
 */
export async function fetchTodaySpotSpeciesScore(
  spotSlug: string,
  speciesSlug: string | null,
): Promise<SpotSpeciesScore | null> {
  if (!API_URL || !API_KEY) {
    console.error('[bluecaster-score] BLUECASTER_API_URL / BLUECASTER_API_KEY not set');
    return null;
  }

  const base = API_URL.replace(/\/+$/, '');
  const url = `${base}/api/v1/spots/${encodeURIComponent(spotSlug)}/spot-page`;

  let data: SpotPageScoreShape;
  try {
    const res = await fetch(url, {
      headers: { 'x-api-key': API_KEY },
      cache: 'no-store',
    });
    if (!res.ok) {
      console.error(`[bluecaster-score] ${spotSlug}: HTTP ${res.status}`);
      return null;
    }
    data = (await res.json()) as SpotPageScoreShape;
  } catch (err) {
    console.error(`[bluecaster-score] ${spotSlug}: fetch failed`, err);
    return null;
  }

  const peaks = data.topScoreTodayBySpecies ?? {};
  const speciesList = data.species ?? [];

  // Resolve the requested species slug -> id -> today's peak.
  if (speciesSlug) {
    const match = speciesList.find((s) => s.slug === speciesSlug);
    if (match && typeof peaks[match.id] === 'number') {
      return {
        score: peaks[match.id],
        speciesMatched: true,
        scoredSpeciesSlug: match.slug,
      };
    }
  }

  // Fallback: best species scored at the spot today. Keeps the alert functional
  // if the species mapping drifts, at the cost of species specificity.
  let bestId: string | null = null;
  let bestScore = -1;
  for (const [id, score] of Object.entries(peaks)) {
    if (typeof score === 'number' && score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  }
  if (bestId === null) return null;

  return {
    score: bestScore,
    speciesMatched: false,
    scoredSpeciesSlug: speciesList.find((s) => s.id === bestId)?.slug ?? null,
  };
}

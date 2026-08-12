/**
 * Bluecaster spot-score lookup for score-threshold alerts.
 *
 * Score alerts are anchored to a real ReelCaster spot + species (the same score
 * the user sees on the map/spot page), NOT the Open-Meteo score the generic
 * trigger engine computes. This fetches that score from the bluecaster API.
 *
 * Alerts need the whole forecast window, not just today, so the read is the
 * 14-day outlook and "today" is simply day 0 of it. A day-of alert and a
 * lookahead alert therefore cannot disagree about what today's number is.
 *
 * Auth: `x-api-key: BLUECASTER_API_KEY` against `BLUECASTER_API_URL`.
 */

import 'server-only';

const API_URL = process.env.BLUECASTER_API_URL;
const API_KEY = process.env.BLUECASTER_API_KEY;

/**
 * Daytime hour window, inclusive, matching how bluecaster builds the 14-day
 * day tiles (`daily14[].score`).
 *
 * Worth knowing: bluecaster's `topScoreTodayBySpecies` takes the peak across
 * all 24 hours, while its day tiles take hours 5 to 21. This file uses 5 to 21
 * everywhere, for both reasons that matter. It is the number the angler already
 * saw when they set their threshold (the create-alert dialog's "~N days a week
 * match this" runs off the day tiles), and a peak at 3am is not a thing anyone
 * can act on.
 */
const DAYTIME_START_HOUR = 5;
const DAYTIME_END_HOUR = 21;

/** Shape of the bits of GET /api/v1/spots/[slug]/spot-page we consume. */
interface SpotPageScoreShape {
  species?: Array<{ id: string; slug: string; name?: string }>;
  // Today's PEAK score per species id, already scaled 0–100.
  topScoreTodayBySpecies?: Record<string, number>;
}

/** Shape of the bits of GET /api/v1/spots/[slug]/forecast-14d we consume. */
interface Forecast14dShape {
  // One entry per day. `iso` is the day's date label, the same one the spot
  // page prints on its day tiles.
  daily14?: Array<{ iso: string; score: number | null }>;
  // species id -> [day][hour] score, 0–100. Null where the forecast horizon
  // does not reach that far yet.
  hourlyScoreGrid?: Record<string, (number | null)[][]>;
}

export interface OutlookDay {
  /** Day label, YYYY-MM-DD, as bluecaster dates it for this spot. */
  date: string;
  /** 0 = today. */
  dayIndex: number;
  /** Peak score across daytime hours for the scored species, 0–100. */
  peak: number;
}

export interface SpotSpeciesOutlook {
  /**
   * Up to 14 days, today first. Days the forecast horizon does not reach are
   * omitted rather than zeroed: a missing day must never read as a bad day.
   */
  days: OutlookDay[];
  /** True when we matched the requested species; false = best-species fallback. */
  speciesMatched: boolean;
  /** The species slug we actually scored on (may differ on fallback). */
  scoredSpeciesSlug: string | null;
}

/**
 * The next 14 days of peak scores for a spot + species from bluecaster.
 *
 * Returns null when the API is unconfigured or unreachable, the slug is
 * unknown, or no species is scored at the spot. Callers treat null as "cannot
 * evaluate, do not fire" rather than a crash. An alert that goes quiet is
 * recoverable; an alert that fires on a guess is not.
 *
 * Two fetches, deliberately. `/forecast-14d` carries the score grid but not the
 * species list, and the grid is keyed by species id while alerts store a slug,
 * so `/spot-page` is still needed to resolve one to the other.
 */
export async function fetchSpotSpeciesOutlook(
  spotSlug: string,
  speciesSlug: string | null,
): Promise<SpotSpeciesOutlook | null> {
  if (!API_URL || !API_KEY) {
    console.error('[bluecaster-score] BLUECASTER_API_URL / BLUECASTER_API_KEY not set');
    return null;
  }

  const base = API_URL.replace(/\/+$/, '');
  const slug = encodeURIComponent(spotSlug);

  let page: SpotPageScoreShape;
  let forecast: Forecast14dShape;
  try {
    const [pageRes, forecastRes] = await Promise.all([
      fetch(`${base}/api/v1/spots/${slug}/spot-page`, {
        headers: { 'x-api-key': API_KEY },
        cache: 'no-store',
      }),
      fetch(`${base}/api/v1/spots/${slug}/forecast-14d`, {
        headers: { 'x-api-key': API_KEY },
        cache: 'no-store',
      }),
    ]);
    if (!pageRes.ok || !forecastRes.ok) {
      console.error(
        `[bluecaster-score] ${spotSlug}: spot-page HTTP ${pageRes.status}, forecast-14d HTTP ${forecastRes.status}`,
      );
      return null;
    }
    page = (await pageRes.json()) as SpotPageScoreShape;
    forecast = (await forecastRes.json()) as Forecast14dShape;
  } catch (err) {
    console.error(`[bluecaster-score] ${spotSlug}: fetch failed`, err);
    return null;
  }

  const speciesList = page.species ?? [];
  const grid = forecast.hourlyScoreGrid ?? {};
  const days = forecast.daily14 ?? [];
  if (days.length === 0) return null;

  // Resolve the requested species slug to the id the grid is keyed by.
  let speciesId: string | null = null;
  let speciesMatched = false;
  if (speciesSlug) {
    const match = speciesList.find((s) => s.slug === speciesSlug);
    if (match && grid[match.id]) {
      speciesId = match.id;
      speciesMatched = true;
    }
  }

  // Fallback: the best species at the spot TODAY, then that same species for
  // the whole window. Picking the best species per day instead would let the
  // alert hop between species across the window, which makes the message
  // impossible to write honestly and the threshold impossible to reason about.
  if (speciesId === null) {
    const peaks = page.topScoreTodayBySpecies ?? {};
    let bestScore = -1;
    for (const [id, score] of Object.entries(peaks)) {
      if (typeof score === 'number' && score > bestScore && grid[id]) {
        bestScore = score;
        speciesId = id;
      }
    }
  }
  if (speciesId === null) return null;

  const speciesGrid = grid[speciesId] ?? [];
  const outlookDays: OutlookDay[] = [];

  for (let d = 0; d < days.length; d++) {
    const hours = speciesGrid[d];
    if (!hours) continue;

    let peak: number | null = null;
    for (let h = DAYTIME_START_HOUR; h <= DAYTIME_END_HOUR; h++) {
      const v = hours[h];
      if (typeof v === 'number' && (peak === null || v > peak)) peak = v;
    }
    // No scored daytime hour means the horizon does not reach this day yet.
    // Skip it. Treating it as 0 would be indistinguishable from a genuinely
    // terrible day, and a stand-down message on a day we simply cannot see
    // would be worse than saying nothing.
    if (peak === null) continue;

    outlookDays.push({ date: days[d].iso, dayIndex: d, peak });
  }

  if (outlookDays.length === 0) return null;

  return {
    days: outlookDays,
    speciesMatched,
    scoredSpeciesSlug: speciesList.find((s) => s.id === speciesId)?.slug ?? null,
  };
}

// `fetchTodaySpotSpeciesScore` used to live here and returned only today's
// peak. Nothing calls it any more: day-of alerts are day 0 of the outlook and
// go through the same beat machinery as every other day, so there is one code
// path and no way for "today" to disagree with itself.

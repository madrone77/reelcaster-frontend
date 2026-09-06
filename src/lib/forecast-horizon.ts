/**
 * How many forecast days a caller may see, and how to remove the rest.
 *
 * Three surfaces need the same answer — the viewport-strip proxy, the
 * per-spot-outlook proxy, and now the Explore page's server-side prefetch —
 * and "days past the horizon are nulled" is exactly the kind of rule that
 * drifts when it is written three times. `resolveEntitlement` already
 * consolidated *who* is Pro; this consolidates *what that buys*.
 *
 * The day entries themselves always survive: the strip needs 14 dates to draw
 * 14 cells, and it renders its own lock tile off the null score. Only the
 * scores leave.
 */

import type {
  MapForecast14dPayload,
  MapSpotsPayload,
  SpotsOutlook14dPayload,
} from "@/lib/bluecaster";

/** Free: signed out, no account. The first 2 days. */
export const ANON_FORECAST_DAYS = 2;
/** Member: signed in, paying nothing. The first 7; days 8–14 are Pro. */
export const FREE_FORECAST_DAYS = 7;
/** The whole strip. */
export const PRO_FORECAST_DAYS = 14;

/** Days visible to a caller, from the two facts a route can establish. */
export function visibleForecastDays(
  signedIn: boolean,
  isPro: boolean,
): number {
  if (!signedIn) return ANON_FORECAST_DAYS;
  return isPro ? PRO_FORECAST_DAYS : FREE_FORECAST_DAYS;
}

/** Viewport strip: null out `best` and every per-species series past the horizon. */
export function stripViewportForecast(
  data: MapForecast14dPayload,
  visibleDays: number,
): MapForecast14dPayload {
  if (visibleDays >= PRO_FORECAST_DAYS) return data;
  const locked = (i: number) => i >= visibleDays;
  return {
    ...data,
    best: data.best.map((cell, i) => (locked(i) ? null : cell)),
    by_species: Object.fromEntries(
      Object.entries(data.by_species).map(([speciesId, cells]) => [
        speciesId,
        cells.map((cell, i) => (locked(i) ? null : cell)),
      ]),
    ),
    // A locked tile draws a padlock, never an icon, so past the horizon this
    // is bytes nobody renders. Strip it on the same line as the scores so
    // "past the horizon" keeps meaning exactly one thing.
    hourly_conditions: data.hourly_conditions?.map((cell, i) =>
      locked(i) ? null : cell,
    ),
  };
}

/** Per-spot outlook: same rule, applied to every spot's 14 cells. */
export function stripSpotsOutlook(
  data: SpotsOutlook14dPayload,
  visibleDays: number,
): SpotsOutlook14dPayload {
  if (visibleDays >= PRO_FORECAST_DAYS) return data;
  return {
    ...data,
    by_spot: Object.fromEntries(
      Object.entries(data.by_spot).map(([spotId, cells]) => [
        spotId,
        cells.map((cell, i) => (i >= visibleDays ? null : cell)),
      ]),
    ),
  };
}

/**
 * Which strip day a calendar date is, counted from today: 0 today, 1
 * tomorrow, 13 the last tile. Both arguments are YYYY-MM-DD in the forecast's
 * own zone (America/Vancouver, the `date` the map payloads carry), so the
 * arithmetic is on whole calendar days and never touches a clock.
 */
export function forecastDayIndex(todayIso: string, dateIso: string): number {
  const day = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  return Math.round((day(dateIso) - day(todayIso)) / 86_400_000);
}

/**
 * The map's per-day spots: the same rule, applied to one day at a time.
 *
 * The strip nulls its cells past the horizon, but the pins and cards under it
 * come from `/map/spots?date=`, which used to answer any date for anyone. So
 * a locked tile sat over a map coloured with the day it was locking: tap a
 * tile the rail had not yet resolved, or type `?day=` into the URL, and the
 * whole Pro fortnight was on screen for a signed-out visitor.
 *
 * A date past the caller's horizon keeps its spots (the roster, coordinates
 * and weather are not paid data and the map still needs pins to draw) and
 * loses every score, the same way a locked strip cell keeps its date and
 * loses its number. A date inside the horizon comes back untouched.
 */
export function stripMapSpotsPastHorizon(
  data: MapSpotsPayload,
  visibleDays: number,
  todayIso: string,
): MapSpotsPayload {
  if (visibleDays >= PRO_FORECAST_DAYS) return data;
  if (forecastDayIndex(todayIso, data.date) < visibleDays) return data;
  return {
    ...data,
    spots: data.spots.map((spot) => ({
      ...spot,
      best_species_id: null,
      scores: {},
    })),
  };
}

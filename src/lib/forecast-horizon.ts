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

import type { MapForecast14dPayload, SpotsOutlook14dPayload } from "@/lib/bluecaster";

/** Signed-out visitors see the first 2 days. */
export const ANON_FORECAST_DAYS = 2;
/** Free accounts see the first 7; days 8–14 are Pro. */
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

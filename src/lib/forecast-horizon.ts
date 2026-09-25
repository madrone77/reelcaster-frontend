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
import type { SpotScorePayload } from "@/lib/bluecaster/live-spot-types";

/** Free: signed out, no account. Today only. */
export const ANON_FORECAST_DAYS = 1;
/** Member: signed in, paying nothing. The first 7; days 8–14 are Pro. */
export const FREE_FORECAST_DAYS = 7;
/** The whole strip. */
export const PRO_FORECAST_DAYS = 14;

/**
 * A horizon as words: "today" for one day, "the next 7 days" otherwise.
 * Copy that quotes a horizon goes through this so "the next 1 days" can't ship.
 */
export function horizonPhrase(
  days: number,
  { sentenceStart = false }: { sentenceStart?: boolean } = {},
): string {
  const phrase = days === 1 ? "today" : `the next ${days} days`;
  return sentenceStart ? phrase[0].toUpperCase() + phrase.slice(1) : phrase;
}

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
  // The horizon travels with the payload so a card can tell a locked day
  // from a day that simply has no score (see spotDaysFrom).
  if (visibleDays >= PRO_FORECAST_DAYS) return { ...data, visible_days: visibleDays };
  return {
    ...data,
    visible_days: visibleDays,
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
    // A slim `shape=pins` body carries its scores as `pins`; those go too.
    spots: data.spots.map((spot) => ({
      ...spot,
      best_species_id: null,
      scores: {},
      ...("pins" in spot ? { pins: {} } : {}),
    })),
  };
}

/** The zone every forecast horizon is counted in. The strip's days are Pacific. */
const HORIZON_TZ = "America/Vancouver";

/**
 * The UTC instant that ends a caller's horizon: Pacific midnight at the end
 * of day `visibleDays - 1`, counted from the Pacific date of `now`. Pacific
 * midnight is 07:00 or 08:00 UTC, so the two candidates are checked rather
 * than pulling in a timezone library.
 */
export function horizonEndUtcMs(visibleDays: number, now: Date = new Date()): number {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: HORIZON_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now); // YYYY-MM-DD
  const [y, m, d] = today.split("-").map(Number);
  const hourIn = new Intl.DateTimeFormat("en-US", {
    timeZone: HORIZON_TZ,
    hour: "2-digit",
    hourCycle: "h23",
  });
  for (const utcHour of [7, 8]) {
    const t = Date.UTC(y, m - 1, d + visibleDays, utcHour);
    if (hourIn.format(t) === "00") return t;
  }
  return Date.UTC(y, m - 1, d + visibleDays, 8);
}

/**
 * Score breakdown (fishing-spots/[id]/score): drop every hour past the
 * caller's horizon. Its days are UTC dates, so a Pacific day spans two of
 * them and a whole-day cut would either leak tomorrow morning or lose
 * tonight; the cut is by hour. A day left with no hours goes, and each
 * species' best is recomputed from the hours that stay.
 */
export function stripSpotScorePastHorizon(
  data: SpotScorePayload,
  visibleDays: number,
  now: Date = new Date(),
): SpotScorePayload {
  if (visibleDays >= PRO_FORECAST_DAYS) return data;
  const end = horizonEndUtcMs(visibleDays, now);
  const days = data.days
    .map((day) => ({
      ...day,
      species: Object.fromEntries(
        Object.entries(day.species).map(([speciesId, entry]) => {
          const hours = entry.hours.filter((h) => Date.parse(h.hour_utc) < end);
          let best: { score: number; hour: string } | null = null;
          for (const h of hours) {
            for (const st of h.stocks) {
              if (best === null || st.score > best.score) {
                best = { score: st.score, hour: h.hour_utc };
              }
            }
          }
          return [
            speciesId,
            {
              ...entry,
              hours,
              best_score: best?.score ?? null,
              best_hour_utc: best?.hour ?? null,
            },
          ];
        }),
      ),
    }))
    .filter((day) => Object.values(day.species).some((e) => e.hours.length > 0));
  return {
    ...data,
    days,
    meta: data.meta ? { ...data.meta, days_returned: days.length } : data.meta,
  };
}

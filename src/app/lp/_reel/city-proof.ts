import type { LpCard } from "../_shared/lp-spot";
import { lpRegionFor } from "../_shared/lp-region";
import type { MapSpotsPayload } from "@/lib/bluecaster";
import { formatConditions, speciesDisplayName } from "@/app/explore/lib/explore-data";

/**
 * The city-wide numbers a reel hero and its page are built from, derived
 * rather than written down.
 *
 * `resolveLpCard` deliberately returns ONE spot, because every other variant
 * shows one score card. This page also shows the roster around it, so the
 * counts come straight off the same map payload the card was built from and
 * cannot drift from what the product would render on Explore.
 *
 * Every figure here is counted, never estimated. A landing page that invents
 * its own scale is one screenshot away from being disproved by the app.
 */
export interface CityProof {
  /** Published marks in this city that carry at least one scored species. */
  spotCount: number;
  /** Distinct species scored anywhere in the city today. */
  speciesCount: number;
  /**
   * Hourly scores this city gets across the forecast horizon: every mark,
   * every hour, every day.
   *
   * Deliberately NOT counted off the payload's own cells. The public map
   * response carries only the species scoring today — Seattle returns two of
   * an eighteen-species roster — so summing its strips reported 528 for a
   * city holding 31,920 rows, which undersells the product by a factor of
   * sixty on its own landing page. Marks x 24 x horizon is a floor that is
   * true for every city and checkable against the app.
   */
  hoursScored: number;
  /** Local hour of the featured card's peak, for the score-explainer caption. */
  peakHour: number;
  /** Today's peak per mark for the card's species, best first. */
  /** Today's peak per spot, best first. `slug` deep-links to the spot page. */
  marks: Array<{ name: string; score: number; slug: string }>;
  /** The species `marks` is ranked on, which is not always the card's. */
  marksSpecies: string;
  /**
   * The highest-scoring mark for the hero species today, rebuilt from its own
   * strip.
   *
   * `resolveLpCard` picks the city's BUSIEST published spot, which is the
   * right choice for a single score card and the wrong one for a page that
   * also prints the roster underneath. On Victoria it featured Constance Bank
   * at 88 directly above a list whose top row read Victoria Waterfront 91, so
   * the page disagreed with itself in the reader's first screen. The hero now
   * reads off the same ranking the list does. Null when the payload cannot
   * support it, in which case the card's own spot stands.
   */
  hero: HeroMark | null;
  /** "Wind 4 kt" or similar, from the featured spot's own conditions strip. */
  conditionNote: string | null;
  /**
   * Everything the animated Explore reel needs to draw one spot: where the pin
   * goes, and what its preview card says when the reel lands on it.
   *
   * Same ranking and same species as `marks`, so the phone in the hero and the
   * list further down cannot end up talking about different water. Ordered
   * best first; the reel walks them geographically, which is a display
   * decision and belongs with the component.
   */
  pins: ReelPin[];
}

export interface ReelPin {
  name: string;
  slug: string;
  score: number;
  lat: number;
  lng: number;
  /** Display name, "Pacific" already stripped. */
  species: string;
  /**
   * The management area the mark is regulated under, already labelled for its
   * jurisdiction: "MA 10" in Washington, "Area 19-3" in BC. Null when the
   * payload carries no area for the spot.
   *
   * Read straight off the map payload, which reads it off the column the
   * regulatory gate resolves against. Deliberately NOT derived here by testing
   * the spot's coordinates against the area polygons the map draws: that would
   * be a second answer to "which area is this mark in", free to disagree with
   * the one the spot was actually scored under, and a landing page is the
   * worst place to discover the two had drifted.
   */
  area: string | null;
  /**
   * The three readings the real Explore preview card shows, formatted by the
   * product's OWN formatter rather than re-derived here. A landing page that
   * rounds wind or names a sea state its own way is a second vocabulary that
   * disagrees with the app the moment either moves.
   */
  wind: string | null;
  sea: string | null;
  current: string | null;
  /**
   * The card's 24-hour sparkline, and the window to light up inside it.
   *
   * The real Explore card carries this (see components/spot-trend.tsx) and the
   * reel's card looked wrong without it -- the meta row ended in dead space
   * where the product puts the shape of the day. Same 24 values and the same
   * window function the hero bars use, so the two cannot disagree.
   */
  hours: number[];
  bestFrom: number;
  bestTo: number;
}

export interface HeroMark {
  name: string;
  score: number;
  /** 24 bar heights, 0-100, midnight to midnight. Nulls flattened to 0. */
  hours: number[];
  /** Inclusive bar indices to paint as the best window. -1 = none. */
  bestFrom: number;
  bestTo: number;
  peakHour: number;
}

/**
 * How far either side of the peak still counts as the window.
 *
 * Mirrors `_shared/lp-spot.ts`, deliberately: two different definitions of
 * "best window" on one page is the same class of bug as two different best
 * marks. Ten points keeps a real shoulder on a flat-topped day, and the
 * six-hour cap stops a flat day widening into "6 AM to 9 PM", which is not a
 * window and argues against the product on its own landing page.
 */
const PEAK_BAND = 10;
const MAX_WINDOW_HOURS = 6;

/** The Pro horizon, and the window this page advertises. */
export const FORECAST_HORIZON_DAYS = 14;

/** 0..1 from the scoring API, 0..100 everywhere a person reads it. */
function toScore(v: number): number {
  return Math.round(v * 100);
}


/** Widen from the peak while the score holds within PEAK_BAND, then cap. */
function windowAround(
  hours: number[],
  peakHour: number,
): { from: number; to: number } | null {
  const peak = hours[peakHour];
  if (!peak || peak <= 0) return null;
  const floor = peak - PEAK_BAND;
  let from = peakHour;
  let to = peakHour;
  while (from - 1 >= 0 && hours[from - 1] >= floor) from--;
  while (to + 1 < hours.length && hours[to + 1] >= floor) to++;
  // Trim from the weaker end until the window is a window again.
  while (to - from + 1 > MAX_WINDOW_HOURS) {
    if (hours[from] <= hours[to]) from++;
    else to--;
  }
  return { from, to };
}

export function buildCityProof(
  payload: MapSpotsPayload,
  card: LpCard,
): CityProof {
  const speciesIds = new Set<string>();
  let spotCount = 0;

  // The species the hero is talking about, matched by display name because
  // LpCard carries the name rather than the id. Names are stripped of
  // "Pacific" at display time, so compare on a letters-only form.
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
  const wanted = norm(card.species);
  /**
   * The species the spot band ranks on.
   *
   * NOT simply the card's species. `resolveLpCard` picks the city's headline
   * species, and on 2026-08-25 that was Halibut for Seattle: scored at 2 spots
   * out of 16, against Coho at 15. Ranking on it produced a two-row band, the
   * section's own `length > 2` guard hid the whole thing, and the page silently
   * lost its spot list on a day when 15 spots were scored perfectly well.
   *
   * So the card's species wins only if it is scored at most of the spots that
   * carry any score at all; otherwise the widest-covered species does. A band
   * that claims to have scored every spot has to be ranked on something most
   * of them actually have.
   */
  const coverage = new Map<string, number>();
  for (const spot of payload.spots) {
    for (const id of Object.keys(spot.scores ?? {})) {
      coverage.set(id, (coverage.get(id) ?? 0) + 1);
    }
  }
  const widest = [...coverage.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const cardSpeciesId =
    Object.values(payload.species).find((s) => norm(s.name).includes(wanted))
      ?.id ?? null;
  const bestCount = widest ? (coverage.get(widest) ?? 0) : 0;
  const cardCount = cardSpeciesId ? (coverage.get(cardSpeciesId) ?? 0) : 0;
  const heroSpeciesId =
    cardSpeciesId && cardCount >= bestCount * 0.6 ? cardSpeciesId : widest;

  const region = lpRegionFor(card.provinceCode);
  const marks: Array<{ name: string; score: number; slug: string }> = [];
  const pins: ReelPin[] = [];
  let heroMark: HeroMark | null = null;
  let peakHour = card.bestFrom >= 0 ? card.bestFrom : 12;
  let conditionNote: string | null = null;

  for (const spot of payload.spots) {
    const strips = Object.entries(spot.scores ?? {});
    if (!strips.length) continue;
    spotCount++;

    for (const [speciesId] of strips) speciesIds.add(speciesId);

    if (heroSpeciesId) {
      const strip = spot.scores[heroSpeciesId];
      if (strip) {
        const score = toScore(strip.peak);
        marks.push({ name: spot.name, score, slug: spot.slug });
        // Conditions AT THE PEAK, which is the hour the score is about. The
        // card would otherwise quote midnight's wind beside a 6 AM number.
        const cond = formatConditions(spot.conditions?.[strip.peak_hour] ?? null);
        const pinHours = strip.hours.map((h) =>
          h && typeof h.s === "number" ? toScore(h.s) : 0,
        );
        const pinWin = windowAround(pinHours, strip.peak_hour);
        pins.push({
          name: spot.name,
          slug: spot.slug,
          score,
          lat: spot.lat,
          lng: spot.lng,
          species: speciesDisplayName(
            payload.species[heroSpeciesId]?.name ?? card.species,
          ),
          area: spot.area ? `${region.areaShort} ${spot.area}` : null,
          wind: cond.wind,
          sea: cond.sea,
          current: cond.current,
          hours: pinHours,
          bestFrom: pinWin?.from ?? -1,
          bestTo: pinWin?.to ?? -1,
        });
        if (!heroMark || score > heroMark.score) {
          const hours = strip.hours.map((h) =>
            h && typeof h.s === "number" ? toScore(h.s) : 0,
          );
          const win = windowAround(hours, strip.peak_hour);
          heroMark = {
            name: spot.name,
            score,
            hours,
            bestFrom: win?.from ?? -1,
            bestTo: win?.to ?? -1,
            peakHour: strip.peak_hour,
          };
        }
      }
    }

    if (spot.name === card.spotName) {
      const strip = heroSpeciesId ? spot.scores[heroSpeciesId] : null;
      if (strip) peakHour = strip.peak_hour;
      const cell = spot.conditions?.[peakHour] ?? null;
      if (cell && typeof cell.wkt === "number") {
        conditionNote = `Wind ${Math.round(cell.wkt)} kt`;
      }
    }
  }

  marks.sort((a, b) => b.score - a.score);
  pins.sort((a, b) => b.score - a.score);

  return {
    hero: heroMark,
    spotCount,
    marksSpecies:
      (heroSpeciesId ? payload.species[heroSpeciesId]?.name : null) ??
      card.species,
    speciesCount: speciesIds.size,
    hoursScored: spotCount * 24 * FORECAST_HORIZON_DAYS,
    peakHour,
    marks,
    conditionNote,
    pins,
  };
}

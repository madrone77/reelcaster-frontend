import { fetchSpotLivePage } from "@/lib/bluecaster";
import { tideRangeFrom } from "@/app/explore/lib/terminal-hours";
import { timezoneFor } from "@/lib/regions";
import type {
  HourlyConditions,
  RightNowSnapshot,
  SunHours,
} from "@/lib/bluecaster/live-spot-types";
import type { CityProof } from "../_reel/city-proof";

/**
 * One real day at one real mark, for the phone in the WHERE / WHAT / WHEN slot.
 *
 * Day 0 only, and that is not a horizon decision to revisit: the phone draws
 * TODAY at the mark the hero is already about. There is nothing here an
 * anonymous reader is not entitled to, so unlike the instrument's feed this
 * carries no slice and no gate — the moment it grows a second day it does, and
 * @/lib/forecast-horizon is where that lives.
 */
export interface ConditionsFeed {
  /** The mark drawn, spelled as `fishing_spots.name` spells it. */
  spotName: string;
  /** The species the score row is for, as the page names it elsewhere. */
  speciesName: string | null;
  /** For the currents call the phone makes after mount. */
  lat: number;
  lng: number;
  /** The mark's own clock, which is not the reader's. */
  tz: string;
  /** Local date of the day drawn, for the currents call's window. */
  iso: string | null;
  /** Today's 24 hourly scores, 0–100, for `speciesName`. */
  scores: (number | null)[];
  /** Today's 24 hourly conditions cells. */
  conditions: HourlyConditions[];
  /** Tide min/max across the whole payload, so the row's scale is not today's. */
  tideRange: { min: number; max: number } | null;
  sun: SunHours;
  rightNow: RightNowSnapshot | null;
}

/**
 * Load the hero mark's own day.
 *
 * Reads the mark off `proof`, not off the LpCard, for the same reason the hero
 * score does: `resolveLpCard` returns one spot picked its own way, and a phone
 * drawing a different mark from the one named two inches above it is a page
 * disagreeing with itself. Same mark, same species, same numbers.
 *
 * Returns null rather than throwing on every miss. This is the second picture
 * on a landing page: a city whose payload came back thin should lose the
 * phone, not the page.
 */
export async function loadConditionsFeed(
  proof: CityProof | null,
  provinceCode: string,
): Promise<ConditionsFeed | null> {
  const hero = proof?.hero;
  if (!hero?.slug) return null;

  const page = await fetchSpotLivePage(hero.slug).catch(() => null);
  if (!page) return null;

  // Keyed by id, and the city payload and the spot payload are scored
  // independently — a species leading the mark on one can be missing from the
  // other after a re-bake, which is why this falls back rather than blanking.
  const grid =
    (proof?.heroSpeciesId
      ? page.hourlyScoreGrid[proof.heroSpeciesId]
      : undefined) ?? Object.values(page.hourlyScoreGrid)[0];
  const scores = grid?.[0];
  const conditions = page.hourlyConditionsGrid?.[0];
  // A phone with a chart and no numbers in it is worse than no phone.
  if (!scores?.length || !conditions?.length) return null;

  const pin = proof?.pins.find((p) => p.slug === hero.slug) ?? null;
  if (!pin) return null;

  return {
    spotName: hero.name,
    speciesName:
      page.species.find((s) => s.id === proof?.heroSpeciesId)?.name ??
      proof?.marksSpecies ??
      null,
    lat: pin.lat,
    lng: pin.lng,
    // The jurisdiction the rest of the page already cites, so the phone's
    // clock cannot disagree with the regulator named beside it. Every covered
    // region is Pacific today, which is exactly why this is worth writing
    // down rather than assuming.
    tz: timezoneFor(provinceCode),
    iso: page.daily14?.[0]?.iso ?? null,
    scores,
    conditions,
    tideRange: tideRangeFrom(page.hourlyConditionsGrid),
    sun: page.sun,
    rightNow: page.rightNow,
  };
}

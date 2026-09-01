import { fetchSpotLivePage } from "@/lib/bluecaster";
import { tideRangeFrom } from "@/app/explore/lib/terminal-hours";
import { timezoneFor } from "@/lib/regions";
import type {
  HourlyConditions,
  RightNowSnapshot,
  SunHours,
} from "@/lib/bluecaster/live-spot-types";
import type { CityProof } from "../_reel/city-proof";
import type { City1Mark } from "./city1-city";

/**
 * One real day at one real mark, for the phone in the WHERE / WHAT / WHEN slot.
 *
 * Day 0 only, and that is not a horizon decision to revisit: the phone draws
 * TODAY at one named mark. There is nothing here an anonymous reader is not
 * entitled to, so unlike the instrument's feed this carries no slice and no
 * gate -- the moment it grows a second day it does, and @/lib/forecast-horizon
 * is where that lives.
 */
export interface ConditionsFeed {
  /** The mark drawn, spelled as `fishing_spots.name` spells it. */
  spotName: string;
  /** The species the score row is actually for, whatever was asked for. */
  speciesName: string | null;
  /** For the currents call the phone makes after mount. */
  lat: number;
  lng: number;
  /** The mark's own clock, which is not the reader's. */
  tz: string;
  /** Local date of the day drawn, for the currents call's window. */
  iso: string | null;
  /** Today's 24 hourly scores, 0-100, for `speciesName`. */
  scores: (number | null)[];
  /** Today's 24 hourly conditions cells. */
  conditions: HourlyConditions[];
  /** Tide min/max across the whole payload, so the row's scale is not today's. */
  tideRange: { min: number; max: number } | null;
  sun: SunHours;
  rightNow: RightNowSnapshot | null;
}

/** Letters only, so "Chinook" matches "Chinook Salmon". */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

/** True when a day row actually carries a score, not 24 nulls. */
const scored = (day: (number | null)[] | undefined) =>
  !!day?.some((v) => typeof v === "number" && Number.isFinite(v));

/**
 * Load the day the phone draws.
 *
 * WHICH MARK, AND WHY IT IS SETTABLE
 *
 * By default the page's own hero mark, so the phone cannot draw one mark while
 * the reel and the H1 are about another. But `conditionsMark` on the City1City
 * overrides it, and Vancouver uses that to pin the phone to The Bell Buoy for
 * Chinook.
 *
 * That is not a special case fighting the ranking -- it is the section going
 * back to being about the thing it was always about. This slot held a
 * PHOTOGRAPH of a named spot page, and `City1Shot.mark` names it in the
 * caption; the live phone replacing it drawing some other mark is the odd
 * outcome, not this one. The hero ranking is still what the reel and the marks
 * band run on, and neither reads this.
 *
 * WHICH SPECIES
 *
 * The named one when it is scored at that mark today, and matched against the
 * SPOT's own roster rather than the city's, because the two are scored
 * independently and a re-bake can leave a species on one and not the other.
 * When it is not scored, this falls through to whatever is -- and the caption
 * follows, because `speciesName` is read back off the species actually used
 * rather than off what was asked for. A page that names a fish its own chart
 * is not drawing is worse than a page naming a different fish.
 *
 * Returns null rather than throwing on every miss. This is the second picture
 * on a landing page: a mark whose payload came back thin should lose the
 * phone, not the page -- the still is still there to fall back to.
 */
export async function loadConditionsFeed(
  proof: CityProof | null,
  provinceCode: string,
  pick?: City1Mark,
): Promise<ConditionsFeed | null> {
  const slug = pick?.slug ?? proof?.hero?.slug;
  if (!slug) return null;

  const page = await fetchSpotLivePage(slug).catch(() => null);
  if (!page) return null;

  // The named species, then the city's hero species, then anything scored.
  // `find` over the grid rather than over `page.species`, because the roster
  // lists what lives there and the grid holds what was scored today.
  const named = pick
    ? (page.species.find((s) => norm(s.name).includes(norm(pick.species)))?.id ??
      null)
    : null;
  const preferred = named ?? proof?.heroSpeciesId ?? null;
  const speciesId =
    (preferred && scored(page.hourlyScoreGrid[preferred]?.[0])
      ? preferred
      : null) ??
    Object.keys(page.hourlyScoreGrid).find((id) =>
      scored(page.hourlyScoreGrid[id]?.[0]),
    ) ??
    null;

  const scores = speciesId ? page.hourlyScoreGrid[speciesId]?.[0] : undefined;
  const conditions = page.hourlyConditionsGrid?.[0];
  // A phone with a chart and no numbers in it is worse than no phone.
  if (!scores?.length || !conditions?.length) return null;

  return {
    // Off the spot payload, so the caption names whatever was actually drawn.
    spotName: page.spot.name,
    speciesName:
      page.species.find((s) => s.id === speciesId)?.name ??
      proof?.marksSpecies ??
      null,
    lat: page.spot.lat,
    lng: page.spot.lng,
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

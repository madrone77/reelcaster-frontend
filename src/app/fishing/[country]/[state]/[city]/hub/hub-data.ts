// Leaderboard data, derived from the same map/spots payload the map draws.
//
// This does NOT reuse Explore's `RailSpot`. RailSpot keeps one 24-hour strip —
// the best species' — plus a peak per species, which is enough to rank cards
// but not enough to give each card a clock window for the species the reader
// picked. The raw payload carries every species' full strip, so the derivation
// happens here instead of being reconstructed from a lossy intermediate.

import type {
  MapCondStrip,
  MapSpeciesStrip,
  MapSpotsPayload,
} from "@/lib/bluecaster";

/**
 * Hours within this fraction of the peak count as "good".
 *
 * 0.05 is not a local choice: it mirrors GOOD_BAND in BlueCaster's
 * `build-city-today.ts`. The hero's window and a spot card's window are two
 * renderings of the same idea, and a page that computed them from different
 * bands would show "best 6:30 to 8:30" above a card reading "7 to 11".
 */
const GOOD_BAND = 0.05;

/** The daylight bounds the scoring fold uses. Nothing outside them is a
 *  window anyone is being sent to. */
const DAY_START_HOUR = 5;
const DAY_END_HOUR = 21;

export interface HubWindow {
  start_hour: number;
  end_hour: number;
}

export interface HubSpeciesEntry {
  /** 0–100. */
  peak: number;
  peak_hour: number;
  /**
   * Daylight mean, 0–100. The leaderboard's TIE-BREAK, not its badge.
   *
   * Peak alone cannot order these. Since the midday rescale a healthy Seattle
   * day peaks 89 to 92 at a dozen marks at once, so sorting on it yields
   * 91, 91, 91, 90, 90 with the order inside each group decided by whatever
   * the payload happened to list first. The mean is what separates a wide
   * plateau from a sharp dawn bite, so it breaks those ties — and it is the
   * same measure BlueCaster ranks on upstream.
   *
   * It is not the number on the badge. A card showing the mean would
   * disagree with the score the spot page shows for the same water, and a
   * reader who taps through to find a different number stops trusting both.
   */
  day_mean: number;
  /** Contiguous good run around the peak, or null if the peak sits outside
   *  daylight. */
  window: HubWindow | null;
  /** Daylight hours within the good band. A COUNT, not a run: a species can
   *  hold six good hours split across a dawn bite and an evening one, which
   *  is why `window` exists separately. */
  good_hours: number;
  /** All 24 hours, 0–100, null where unscored. Already in the map payload, so
   *  charting it costs no request — which is the only reason a landing page
   *  built to a 1.2s budget can afford to draw one. */
  hours24: (number | null)[];
}

export interface HubSpot {
  id: string;
  slug: string;
  /**
   * Canonical page path, or null when the caller supplied no path index.
   *
   * A city page ranks the spots it can REACH, which includes marks homed in a
   * neighbouring city, so this cannot be derived from the page's own city:
   * 9 of 228 spots would get a link to the wrong one. Render it through
   * spotHref(), which falls back to the retired URL when this is null.
   */
  path: string | null;
  name: string;
  lat: number;
  lng: number;
  /** "Rock reef", "Sand flat"… or null. See MapSpotEntry.bottom for why this
   *  is the only physical descriptor a card gets. */
  bottom: string | null;
  /** Scraped reports exist here in the 21-day intel window. Presence only —
   *  the counts are Pro-gated. */
  hasReports: boolean;
  /**
   * Track record over the trailing year.
   *
   * `"unfished"` — no catch report resolved to this mark in that year — only
   * ever appears under `pool: "all"`; the default pool drops those spots
   * before they get here. See the pool note on `buildHubData`.
   */
  trackRecord: "popular" | "known" | "sparse" | "unfished";
  /**
   * Position by report volume among the spots in the payload, 1-based, most
   * fished first. `Infinity` when the mark has no reports in the trailing
   * year, so it sorts last without a special case at every call site.
   */
  trackRank: number;
  /** Tide phase at this spot's peak hour, for the "on the late ebb" clause
   *  and the best-current-window badge. */
  condStrip: MapCondStrip | null;
  /** Keyed by species id. Absent species simply did not score here today. */
  bySpecies: Record<string, HubSpeciesEntry>;
  /** Highest-peaking species at this spot, for the unfiltered ranking. */
  bestSpeciesId: string | null;
}

export interface HubSpecies {
  id: string;
  slug: string;
  name: string;
  /** How many spots scored this species today — the number on the chip. */
  spotCount: number;
  /** Best peak across the city, used to order the chips. */
  bestPeak: number;
}

export interface HubData {
  date: string;
  spots: HubSpot[];
  species: HubSpecies[];
}

/** A window is a session, not a plateau. Three hours is what somebody
 *  actually plans around, and it is the length the day strip and the spot
 *  page already talk in. */
const WINDOW_HOURS = 3;

/**
 * How far behind the best run a run may sit and still be preferred for
 * starting earlier, in score points.
 *
 * This is a guard over a known gap in the model, not a claim that mornings
 * always fish better. Scoring gives dawn and dusk near-identical light credit
 * — "dawn/dusk monotony" is an open item — and the post-rescale band is
 * narrow, so the two ends of a day routinely land within a point or two of
 * each other. Oak Bay Flats today: 08:00 reads 80.6 and 20:00 reads 82.3, and
 * on that 1.7 the page was sending a reader out at sunset, with 21:00 already
 * collapsed to 38. The difference between those two answers matters far more
 * to the reader than the difference between the numbers.
 *
 * A genuinely better evening still wins: a run has to be within this margin
 * to be overtaken, not merely later.
 */
const PREFER_EARLIER_MARGIN = 3;

/**
 * The best few hours to be on the water.
 *
 * Every contiguous daylight run of `WINDOW_HOURS` is scored by its mean, and
 * the earliest run within `PREFER_EARLIER_MARGIN` of the best one wins.
 *
 * This replaces walking outward from the peak while hours stayed within five
 * points of it. That definition broke in both directions at once. On a
 * plateau it ran away: Apple Tree Point halibut holds 85 to 91 all day, so it
 * returned 06:00 to 16:00 and called eleven hours a window. And on a
 * two-ended day it took whichever end held the maximum by a hair and threw
 * the other away entirely, which is how a morning fishery came to be
 * advertised as an evening one.
 */
function bestWindow(strip: MapSpeciesStrip): HubWindow | null {
  const at = (h: number): number | null => strip.hours[h]?.s ?? null;

  const runs: Array<{ start: number; end: number; mean: number }> = [];
  for (let start = DAY_START_HOUR; start + WINDOW_HOURS - 1 <= DAY_END_HOUR; start++) {
    let sum = 0;
    let n = 0;
    for (let h = start; h < start + WINDOW_HOURS; h++) {
      const v = at(h);
      // A run with an unscored hour in it is not a session anyone can plan;
      // drop it rather than averaging over the gap.
      if (v == null) { n = 0; break; }
      sum += v;
      n += 1;
    }
    if (n === WINDOW_HOURS) {
      runs.push({ start, end: start + WINDOW_HOURS - 1, mean: sum / n });
    }
  }

  if (!runs.length) {
    // Too few scored daylight hours to form a run. Fall back to the peak hour
    // alone rather than inventing a span around it.
    const { peak_hour } = strip;
    if (peak_hour < DAY_START_HOUR || peak_hour > DAY_END_HOUR) return null;
    if (at(peak_hour) == null) return null;
    return { start_hour: peak_hour, end_hour: peak_hour };
  }

  const best = runs.reduce((a, b) => (b.mean > a.mean ? b : a));
  const floor = best.mean - PREFER_EARLIER_MARGIN / 100;
  const chosen = runs.find((r) => r.mean >= floor) ?? best;
  return { start_hour: chosen.start, end_hour: chosen.end };
}

/** Scores arrive 0..1 and are multiplied by 100 exactly once, here. */
function pct(score: number): number {
  return Math.round(score * 100);
}

/** Daylight hours scoring within GOOD_BAND of this spot's own peak. */
function goodHours(strip: MapSpeciesStrip): number {
  const floor = strip.peak - GOOD_BAND;
  let n = 0;
  for (let h = DAY_START_HOUR; h <= DAY_END_HOUR; h++) {
    const v = strip.hours[h]?.s;
    if (typeof v === "number" && v >= floor) n += 1;
  }
  return n;
}

/** Mean of the daylight hours that scored. Hours with no score are skipped
 *  rather than counted as zero, which would punish a spot for a gap in the
 *  feed instead of for the fishing. */
function daylightMean(strip: MapSpeciesStrip): number {
  let sum = 0;
  let n = 0;
  for (let h = DAY_START_HOUR; h <= DAY_END_HOUR; h++) {
    const v = strip.hours[h]?.s;
    if (typeof v === "number") {
      sum += v;
      n += 1;
    }
  }
  return n === 0 ? pct(strip.peak) : pct(sum / n);
}

/**
 * The leaderboard's pool is spots people actually fish.
 *
 * A spot with no catch report in the trailing year is excluded outright
 * rather than ranked last. The reason is that the scores do not separate:
 * a healthy Victoria day puts eighteen marks within a point of each other, so
 * the ordering fell to a tie-break on the daylight mean and produced a
 * leaderboard led by Trial Islands (15 reports all time) with Brodie Rock
 * (ONE report, ever) second — while Victoria Waterfront (150), Oak Bay Flats
 * (116) and Constance Bank (96) placed fourth, second and nowhere. Every one
 * of those numbers was already in the database.
 *
 * This bites unevenly, because the intel coverage does. Victoria keeps 17
 * of 18 spots and Vancouver 22 of 32, but Seattle keeps 3 of 16 and
 * Bellingham 1 of 7 — the Washington forums we read are thin, which is a
 * coverage fact rather than a bug in this filter. The map further down the
 * page still carries the full roster, so nothing is hidden from a reader who
 * wants it; this is only about which marks the page RECOMMENDS.
 */
export function buildHubData(
  payload: MapSpotsPayload | null,
  /** Spot ids the page is actually rendering. The payload is already scoped
   *  to the city, but a shared spot can be a member of another city too, so
   *  the caller's set is what decides. */
  inCity: Set<string>,
  /**
   * Which marks are eligible.
   *
   * `"fished"` is the note above: an unreported mark is not ranked last, it is
   * not ranked. That is right for a list that RECOMMENDS a handful.
   *
   * `"all"` keeps the whole roster, for a surface that orders every mark it
   * draws rather than picking a few. The instrument page's map carries all of
   * them and its list ranks all of them, so a pool that hid thirteen of
   * Seattle's sixteen would leave the map answering a question the list
   * refused to. Popularity still leads that order (see `rankByRecognition`);
   * an unreported mark sorts last rather than vanishing.
   */
  pool: "fished" | "all" = "fished",
  /**
   * spot slug → canonical path, from a caller that has the hierarchy.
   *
   * Optional because the weekend digest builds hub rows in a cron with no tree
   * to hand; its links go out through spotHref() and take the redirect, which
   * is the right trade in an email that has to survive being read a week late
   * anyway.
   */
  pathBySlug?: Map<string, string>,
): HubData {
  if (!payload) return { date: "", spots: [], species: [] };

  // Does the payload know about track records at all? Absent everywhere is a
  // version signal; absent on SOME spots is real data about those spots.
  const inScope = payload.spots.filter((s) => inCity.has(s.id));
  const trackRecordKnown = inScope.some((s) => !!s.track_record);

  const spotCountBySpecies = new Map<string, number>();
  const bestPeakBySpecies = new Map<string, number>();

  const spots: HubSpot[] = [];

  for (const entry of inScope) {
    // The pool. See the note above — an unreported mark is not ranked last,
    // it is not ranked. Unless nothing in the payload has a track record, in
    // which case there is no pool to apply and every spot stands.
    if (pool === "fished" && trackRecordKnown && !entry.track_record) continue;

    const bySpecies: Record<string, HubSpeciesEntry> = {};
    let bestId: string | null = null;
    let bestPeak = -1;

    for (const [speciesId, strip] of Object.entries(entry.scores)) {
      const peak = pct(strip.peak);
      bySpecies[speciesId] = {
        peak,
        peak_hour: strip.peak_hour,
        day_mean: daylightMean(strip),
        window: bestWindow(strip),
        good_hours: goodHours(strip),
        hours24: Array.from({ length: 24 }, (_, h) => {
          const v = strip.hours[h]?.s;
          return typeof v === "number" ? pct(v) : null;
        }),
      };
      if (peak > bestPeak) {
        bestPeak = peak;
        bestId = speciesId;
      }
      spotCountBySpecies.set(
        speciesId,
        (spotCountBySpecies.get(speciesId) ?? 0) + 1,
      );
      const seen = bestPeakBySpecies.get(speciesId) ?? -1;
      if (peak > seen) bestPeakBySpecies.set(speciesId, peak);
    }

    spots.push({
      id: entry.id,
      slug: entry.slug,
      path: pathBySlug?.get(entry.slug) ?? null,
      name: entry.name,
      lat: entry.lat,
      lng: entry.lng,
      bottom: entry.bottom ?? null,
      hasReports: entry.has_reports === true,
      // "known" is the neutral middle band, so a payload without the field
      // ranks on score alone rather than having every spot promoted or
      // demoted together.
      //
      // Only when the payload has no track records AT ALL, though. Once some
      // spots carry one, an absent value is real data about that mark — it has
      // no report in the trailing year — and defaulting it into the middle
      // band would rank thirteen unfished Seattle marks above the two people
      // actually fish. `"unfished"` is that state said out loud.
      trackRecord: entry.track_record ?? (trackRecordKnown ? "unfished" : "known"),
      trackRank: entry.track_rank ?? Infinity,
      condStrip: entry.conditions ?? null,
      bySpecies,
      bestSpeciesId: bestId,
    });
  }

  const species: HubSpecies[] = [...spotCountBySpecies.entries()]
    .map(([id, spotCount]) => ({
      id,
      slug: payload.species[id]?.slug ?? id,
      name: payload.species[id]?.name ?? "Unknown",
      spotCount,
      bestPeak: bestPeakBySpecies.get(id) ?? 0,
    }))
    // Chips are ordered by how good the fishing is, which is the order
    // someone scanning them cares about. The hero's headline species is
    // pinned to the front by the caller, because that follows the city's
    // target roster rather than today's arithmetic.
    .sort((a, b) => b.bestPeak - a.bestPeak);

  return { date: payload.date, spots, species };
}

/**
 * The leaderboard for one species, or for "best species per spot" when
 * `speciesId` is null.
 *
 * Ranked on the peak, descending. Spots that did not score the selected
 * species are dropped rather than ranked last at zero: a chip that says
 * "Coho (7)" and then lists sixteen cards, nine of them blank, is worse than
 * one that lists seven.
 */
export const TRACK_RANK: Record<string, number> = {
  popular: 0,
  known: 1,
  sparse: 2,
  unfished: 3,
};

export function rankSpots(
  spots: HubSpot[],
  speciesId: string | null,
  limit: number,
): Array<{ spot: HubSpot; speciesId: string; entry: HubSpeciesEntry }> {
  const rows: Array<{ spot: HubSpot; speciesId: string; entry: HubSpeciesEntry }> = [];

  for (const spot of spots) {
    const id = speciesId ?? spot.bestSpeciesId;
    if (!id) continue;
    const entry = spot.bySpecies[id];
    if (!entry) continue;
    rows.push({ spot, speciesId: id, entry });
  }

  // Peak first, so the badges descend and the number on the card is the
  // number that ordered it.
  //
  // TRACK RECORD second, and this is the part that matters. Peak does not
  // separate these: every Victoria mark reads 82 today, so the tie-break was
  // deciding the whole order — and it was the daylight mean, which put Brodie
  // Rock (one report, ever) above Victoria Waterfront (150). Restricting the
  // pool to fished spots was not enough on its own, because both are in it.
  // A hundredth of a point of modelled mean is a worse reason to rank one
  // mark over another than a year of people actually catching fish there.
  //
  // It only ever breaks a TIE. A better-scoring quiet spot still outranks a
  // popular one, so this stays a forecast rather than becoming a popularity
  // chart — which is the thing the whole product is an alternative to.
  //
  // Mean third, for the ties still left inside a band.
  rows.sort(
    (a, b) =>
      b.entry.peak - a.entry.peak ||
      (TRACK_RANK[a.spot.trackRecord] ?? 9) - (TRACK_RANK[b.spot.trackRecord] ?? 9) ||
      b.entry.day_mean - a.entry.day_mean,
  );
  return rows.slice(0, limit);
}

// ── Reader-facing vocabulary ────────────────────────────────────────────

/** Seabed, as a phrase rather than a database enum. */
export function bottomLabel(bottom: string | null): string | null {
  switch (bottom) {
    case "rock":
      return "Rock reef";
    case "mixed":
      return "Mixed bottom";
    case "sand":
      return "Sand flat";
    case "mud":
      return "Mud bottom";
    case "kelp":
      return "Kelp";
    default:
      return null;
  }
}

/** Tide phase codes as the reader sees them. Exported because the landing
 *  cards name the phase a window opens on and must not invent a second
 *  vocabulary for it. */
export const PHASE_LABEL: Record<string, string> = {
  flood_early: "Early flood",
  flood_mid: "Mid flood",
  flood_late: "Late flood",
  slack_high: "High slack",
  ebb_early: "Early ebb",
  ebb_mid: "Mid ebb",
  ebb_late: "Late ebb",
  slack_low: "Low slack",
};

/** The tide phase a spot's window opens on. Null when the strip has no phase
 *  at that hour — there is no generic fallback, because "on the tide" is
 *  filler and a wrong phase is worse than a shorter card. */
export function phaseAt(spot: HubSpot, hour: number | null): string | null {
  if (hour == null) return null;
  const phase = spot.condStrip?.[hour]?.tph ?? null;
  return phase ? (PHASE_LABEL[phase] ?? null) : null;
}

/**
 * Sea state in the words someone uses looking out of the window.
 *
 * Derived from wave height where the model has it and wind speed where it
 * does not, because the two disagree in a way worth respecting: a 15 kt wind
 * that has just come up has not built a sea yet. Height wins when present.
 */
export function chopLabel(cell: { wkt: number | null; wav: number | null } | null): string | null {
  if (!cell) return null;
  const { wav, wkt } = cell;
  if (typeof wav === "number") {
    if (wav < 0.2) return "Flat";
    if (wav < 0.5) return "Light ripple";
    if (wav < 1.0) return "Chop";
    if (wav < 2.0) return "Lumpy";
    return "Rough";
  }
  if (typeof wkt === "number") {
    if (wkt < 5) return "Flat";
    if (wkt < 12) return "Light ripple";
    if (wkt < 20) return "Chop";
    return "Lumpy";
  }
  return null;
}

/** The conditions cell at a spot's peak hour. */
export function cellAt(spot: HubSpot, hour: number | null) {
  if (hour == null) return null;
  return spot.condStrip?.[hour] ?? null;
}

export interface HubBadge {
  label: string;
  /** `accent` is the one badge per list that earns emerald; everything else
   *  is quiet. More than one accent and there is no focal point again. */
  tone: "accent" | "quiet";
}

/**
 * One distinguishing badge per card, so marks stop reading as repeated
 * numbers.
 *
 * ── Why these four and not the obvious fifth ─────────────────────────────
 *
 * "Best depth drop-off" is the tag this list most wants and cannot have.
 * Depth is absent from the product at every grain — `depth_avg_m` is null on
 * all 164 published spots, `depth_profiles` holds 7 rows, and the scraped
 * `catch_signals.depth_ft` 2 of 1,860 — so a drop-off badge would be a guess
 * printed in the same typeface as four measurements.
 *
 * ── Why they are assigned across the set ─────────────────────────────────
 *
 * They are superlatives. "Calmest drift" is true once, and a badge every card
 * carries is a badge no card is distinguished by — which is the state this
 * exists to fix. Each is also guarded on a real spread: on a glassy morning
 * every mark is calm and the word means nothing, so it is withheld rather
 * than printed on an arbitrary winner.
 */
export function assignBadges(
  rows: Array<{ spot: HubSpot; entry: HubSpeciesEntry }>,
): Map<string, HubBadge> {
  const out = new Map<string, HubBadge>();
  if (!rows.length) return out;

  /** Best row by some measure, skipping any already badged. */
  const claim = (
    pick: (spot: HubSpot, entry: HubSpeciesEntry) => number | null,
    better: (a: number, b: number) => boolean,
    spread: number,
    label: (v: number) => string,
    tone: HubBadge["tone"],
  ) => {
    let best: { id: string; v: number } | null = null;
    let lo = Infinity;
    let hi = -Infinity;
    for (const { spot, entry } of rows) {
      const v = pick(spot, entry);
      if (typeof v !== "number") continue;
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
      if (!out.has(spot.id) && (!best || better(v, best.v))) best = { id: spot.id, v };
    }
    // No spread, no superlative. Naming the "calmest" of five identical marks
    // invents a distinction the reader will act on.
    if (!best || hi - lo < spread) return;
    out.set(best.id, { label: label(best.v), tone });
  };

  // The tide phase the top window opens on. First claim, and the only accent:
  // more than one accent and there is no focal point again.
  const lead = rows[0];
  const leadPhase = phaseAt(lead.spot, lead.entry.window?.start_hour ?? null);
  if (leadPhase) {
    out.set(lead.spot.id, { label: `${leadPhase} window`, tone: "accent" });
  }

  // Strongest tidal current at its own peak hour. The seam is where the bait
  // stacks, and it is a genuinely different reason to pick a mark than "calm".
  claim(
    (spot, entry) => cellAt(spot, entry.peak_hour)?.cur ?? null,
    (a, b) => a > b,
    0.4,
    () => "Peak current seam",
    "quiet",
  );

  // Calmest wind at its own peak hour.
  claim(
    (spot, entry) => cellAt(spot, entry.peak_hour)?.wkt ?? null,
    (a, b) => a < b,
    3,
    () => "Calmest drift",
    "quiet",
  );

  // Longest good run. "Widest window" is the honest way to say a plateau, and
  // it is a real reason to choose a mark when you cannot leave at dawn.
  claim(
    (_spot, entry) =>
      entry.window ? entry.window.end_hour - entry.window.start_hour + 1 : null,
    (a, b) => a > b,
    3,
    (v) => `Widest window, ${v}h`,
    "quiet",
  );

  // Presence only. The counts behind this are Pro-gated and the reports are
  // never quoted, so this says "reported", never how many times.
  const reported = rows.find((r) => r.spot.hasReports && !out.has(r.spot.id));
  if (reported) out.set(reported.spot.id, { label: "Recent reports", tone: "quiet" });

  return out;
}

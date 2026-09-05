// WDFW dockside creel checks, as they reach the spot page and the city page.
//
// The state's samplers stand at the ramps and count the boats coming in and
// the fish they kept, per marine area, per day. BlueCaster folds those rows
// into one summary per area over a trailing fortnight. It is the only catch
// evidence most Washington water has: the forums that feed "Recent reports"
// are barely scraped there, so a WA spot page with no report band at all is
// the normal case, and this is what fills the gap.
//
// Two facts every renderer has to respect, because the numbers lie otherwise:
//
//   AREA GRAIN. "Shilshole ramp, Area 10" means anglers who launched at
//   Shilshole and fished somewhere in Area 10, most of central Puget Sound.
//   Nothing here is this spot's own tally. Say "across Marine Area 10",
//   never "at Jefferson Head".
//
//   KEPT FISH ONLY. Released and undersize fish are not counted. A zero is
//   nothing boxed, not nothing hooked, and the word is "kept", never "caught".
//
// Official public data: unlike the forum-fed report it needs no source
// stripping and no Pro gate. It renders for everyone, crawlers included.

export type CreelKept = {
  species: string;
  kept: number;
  /** Kept per angler checked, two decimals. Null when nobody was counted. */
  perAngler: number | null;
};

export type CreelTrend = {
  species: string;
  recentPerAngler: number;
  priorPerAngler: number;
  direction: "building" | "steady" | "fading";
};

export type CreelRamp = {
  ramp: string;
  anglers: number;
  kept: Array<{ species: string; kept: number }>;
};

export type CreelAreaReport = {
  areaNumber: string;
  /** "Marine Area 10 (Seattle-Bremerton Area)". Ready to print. */
  areaLabel: string;
  windowStart: string;
  windowEnd: string;
  windowDays: number;
  /** Distinct days a sampler was out. */
  surveyDays: number;
  interviews: number;
  anglers: number;
  latestSurveyDate: string | null;
  /** WDFW's own published Chinook-per-angler, angler-weighted. */
  chinookPerAngler: number | null;
  /** Species with at least one fish kept, most kept first. */
  kept: CreelKept[];
  trend: CreelTrend | null;
  topRamps: CreelRamp[];
};

/** The city page carries the same summary in snake_case, plus how many of
 *  the city's spots sit in the area. */
export type CreelAreaWire = {
  area_number: string;
  area_label: string;
  window_days: number;
  window_start: string;
  window_end: string;
  survey_days: number;
  interviews: number;
  anglers: number;
  latest_survey_date: string | null;
  chinook_per_angler: number | null;
  kept: Array<{ species: string; kept: number; per_angler: number | null }>;
  trend: {
    species: string;
    recent_per_angler: number;
    prior_per_angler: number;
    direction: CreelTrend["direction"];
  } | null;
  top_ramps: CreelRamp[];
  spot_count: number;
};

export function creelAreaFromWire(w: CreelAreaWire): CreelAreaReport {
  return {
    areaNumber: w.area_number,
    areaLabel: w.area_label,
    windowStart: w.window_start,
    windowEnd: w.window_end,
    windowDays: w.window_days,
    surveyDays: w.survey_days,
    interviews: w.interviews,
    anglers: w.anglers,
    latestSurveyDate: w.latest_survey_date,
    chinookPerAngler: w.chinook_per_angler,
    kept: w.kept.map((k) => ({ species: k.species, kept: k.kept, perAngler: k.per_angler })),
    trend: w.trend
      ? {
          species: w.trend.species,
          recentPerAngler: w.trend.recent_per_angler,
          priorPerAngler: w.trend.prior_per_angler,
          direction: w.trend.direction,
        }
      : null,
    topRamps: w.top_ramps,
  };
}

/**
 * A rate an angler can read at a glance. "0.94 per angler" is a spreadsheet;
 * "about 1 per angler" and "1 per 70 anglers" are what someone at the ramp
 * would say. Anything under one fish per two hundred anglers is "hardly any".
 */
export function describePerAngler(perAngler: number | null): string {
  if (perAngler == null) return "";
  if (perAngler >= 0.95) return `about ${Math.round(perAngler)} per angler`;
  if (perAngler >= 0.1) return `${perAngler.toFixed(1)} per angler`;
  if (perAngler >= 0.005) return `1 per ${Math.round(1 / perAngler)} anglers`;
  return "hardly any";
}

/** Locale-formatted count: 2,310. */
export function fmtCount(n: number): string {
  return n.toLocaleString("en-US");
}

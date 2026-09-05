// Area-wide catch checks, as they reach the Recent reports band.
//
// BlueCaster folds Washington's ramp-sampling rows into one summary per
// marine area over a trailing fortnight: anglers checked and the fish they
// kept, per species. It is the only catch evidence most Washington water
// has, because the forums that feed the written report are barely scraped
// there, so it rides in the same band and under the same gate as the report
// rather than standing on its own.
//
// Two facts every renderer has to respect, because the numbers lie otherwise:
//
//   AREA GRAIN. A row is somebody who launched at a ramp and fished somewhere
//   in the marine area. Nothing here is this spot's own tally. Say "across
//   Marine Area 10", never "at Jefferson Head".
//
//   KEPT FISH ONLY. Released and undersize fish are not counted. A zero is
//   nothing boxed, not nothing hooked, and the word is "kept", never "caught".
//
// Language: the reader is told what is being kept in the area and how much
// effort that rests on. They are not told who counted it or where the boats
// launched; that is our plumbing, and the band already speaks in one voice.

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
  /** The regulator's own published Chinook-per-angler, angler-weighted. */
  chinookPerAngler: number | null;
  /** Species with at least one fish kept, most kept first. */
  kept: CreelKept[];
  trend: CreelTrend | null;
  /** Carried on the wire; not rendered to readers. */
  topRamps: CreelRamp[];
};

/** The city page carries the same summary in snake_case, plus how many of
 *  the city's spots sit in the area. Carried on the wire, not rendered. */
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

/** "Marine Area 10", without the descriptive tail in brackets. */
export function shortAreaLabel(report: CreelAreaReport): string {
  return report.areaLabel.replace(/\s*\(.*\)\s*$/, "");
}

/**
 * The one-line verdict, written the way the report band writes its own
 * headline: what is being kept, and where. This is also the teaser a free
 * reader sees, so it must stand on its own and must not lean on the count.
 */
export function creelHeadline(report: CreelAreaReport): string {
  const area = shortAreaLabel(report);
  const lead = report.kept[0];
  if (!lead) return `Nothing has been kept across ${area} lately`;
  const second = report.kept[1];
  const leadRate = lead.perAngler ?? 0;
  const pace =
    leadRate >= 0.75
      ? "coming steadily"
      : leadRate >= 0.25
        ? "being kept"
        : "the odd one being kept";
  const tail =
    second && second.perAngler != null && second.perAngler < leadRate * 0.2
      ? `, ${second.species} hard to come by`
      : "";
  return `${lead.species} ${pace} across ${area}${tail}`;
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

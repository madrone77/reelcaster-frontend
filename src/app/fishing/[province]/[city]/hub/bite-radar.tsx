// The hero: today's bite radar.
//
// Dark on a light page, and that is the whole design argument. Everything
// below it is white cards on paper, so the one band that has to be read in
// three seconds by somebody arriving from an ad is the one band that does not
// look like the others. Emerald is the accent because it reads at 8:1 on
// navy; --rc-good, the score green, would not, and means something else.
//
// It states a verdict, a clock window and four numbers, and it draws no
// charts. Everything on it is computed upstream — nothing here re-ranks or
// re-scores, because a hero that disagreed with the list under it would be
// worse than no hero.
//
// Client component so the chips can re-point it, but it takes the server's
// payload as props and renders whole on the server, so the words are in the
// HTML rather than a hydration away.

import type {
  BlueCasterCityConditions,
  BlueCasterCityTodaySpecies,
} from "@/lib/bluecaster";
import { formatHour12 } from "@/lib/time-format";
import type { HubWindow } from "./hub-data";

/**
 * Verdict → the pill.
 *
 * The upstream vocabulary is excellent/good/fair/slow and it is not re-banded
 * here. "Prime" is a label on `excellent`, not a fifth state invented to make
 * more days sound good.
 */
const VERDICT: Record<string, { label: string; dot: string; text: string }> = {
  excellent: { label: "Prime conditions", dot: "bg-rc-emerald", text: "text-rc-emerald" },
  good: { label: "Good windows", dot: "bg-rc-emerald", text: "text-rc-emerald" },
  fair: { label: "Fair windows", dot: "bg-amber-300", text: "text-amber-300" },
  slow: { label: "Slow day", dot: "bg-slate-400", text: "text-slate-300" },
};

/**
 * A window as a span someone can read off a clock.
 *
 * `end_hour` names the last GOOD hour, so a window of 6..8 is good through
 * 08:59 and closes at 9. Printing "6 AM to 8 AM" would quietly shorten every
 * window on the page by an hour.
 */
export function windowLabel(w: HubWindow | null): string | null {
  if (!w) return null;
  return `${formatHour12(w.start_hour)} to ${formatHour12((w.end_hour + 1) % 24)}`;
}

/** °C in Canada, °F in the States. The number is stored in °C either way. */
export function tempLabel(c: number | null, provinceCode: string): string | null {
  if (c == null) return null;
  return provinceCode === "BC"
    ? `${Math.round(c)}°C`
    : `${Math.round((c * 9) / 5 + 32)}°F`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="rc-label text-[9px] text-slate-400">{label}</div>
      <div className="font-rc-mono text-[15px] text-white mt-0.5 truncate">
        {value}
      </div>
    </div>
  );
}

export default function BiteRadar({
  cityName,
  provinceCode,
  areaLabel,
  areaNumbers,
  verdict,
  species,
  conditions,
  chop,
  scoredSpots,
  memberSpots,
  reports,
  reportWindowDays,
  tideStationName,
  tidePhrase,
}: {
  cityName: string;
  provinceCode: string;
  /** "Marine Area" in WA, "PFMA" in BC. Never hardcode one. */
  areaLabel: string;
  areaNumbers: string[];
  verdict: string | null;
  /** The species the radar is pointed at — the roster headline by default, or
   *  whatever chip the reader picked. */
  species: BlueCasterCityTodaySpecies | null;
  conditions: BlueCasterCityConditions | null;
  /** "Light ripple", from wave height where the model has it. */
  chop: string | null;
  scoredSpots: number;
  memberSpots: number;
  /** Catch reports in the trailing window. Volume only; nothing about this
   *  number can be traced to a source, which is why it is publishable. */
  reports: number;
  reportWindowDays: number;
  tideStationName: string | null;
  /** "on the late ebb", from the leading spot's tide phase at the peak hour. */
  tidePhrase: string | null;
}) {
  const v = verdict ? (VERDICT[verdict] ?? VERDICT.fair) : null;
  const win = windowLabel(species?.window ?? null);
  const water = tempLabel(conditions?.water_temp_c ?? null, provinceCode);

  const wind =
    conditions?.wind_speed_kt == null
      ? null
      : conditions.wind_from
        ? `${conditions.wind_speed_kt} kt ${conditions.wind_from}`
        : // No prevailing direction in the sample. Light scattered air is the
          // normal cause and naming a point would be invention.
          `${conditions.wind_speed_kt} kt`;

  // Seattle's spots span five WDFW areas. Either name them all or count them:
  // a truncated list showed 8-1, 8-2 and 9 while hiding 10 and 11, the two
  // areas the city is actually named for.
  const areaBadge = !areaNumbers.length
    ? null
    : areaNumbers.length <= 3
      ? `${areaLabel}${areaNumbers.length > 1 ? "s" : ""} ${areaNumbers.join(", ")}`
      : // Same acronym trap as the regulations note: "5 pfmas" is wrong and
        // "5 marine areas" is right, and the difference is whether the label
        // is a phrase.
        `${areaNumbers.length} ${areaLabel.includes(" ") ? areaLabel.toLowerCase() : areaLabel}s`;

  return (
    <section
      aria-labelledby="radar"
      className="rounded-2xl bg-rc-navy-deep text-white overflow-hidden shadow-rc-panel"
    >
      {/* Live pulse. A count of reports read, never a count of people — there
          is no user-activity metric behind this page, and inventing one on a
          page that sells a subscription is not a design choice. */}
      {/* The emerald here already measures 10.9:1 on the band, so this was
          never a contrast defect — it read faint because 11px of light mono
          sat on a green ground, which is the one background that stops green
          text looking like an accent. Neutral ground, a size up and a real
          weight fix what the colour could not. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 bg-white/[0.07] px-5 py-3 border-b border-white/10">
        <span className="relative flex h-2 w-2" aria-hidden>
          <span className="absolute inline-flex h-full w-full rounded-full bg-rc-emerald opacity-70 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-rc-emerald" />
        </span>
        <span className="font-rc-mono text-[12px] font-medium text-rc-emerald">
          {reports} catch report{reports === 1 ? "" : "s"} read around{" "}
          {cityName} in {reportWindowDays} days
        </span>
      </div>

      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="rc-label text-[9px] text-slate-400">
            {cityName}
            {areaBadge ? ` · ${areaBadge}` : ""}
          </span>
          {v && (
            <span className="inline-flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${v.dot}`} aria-hidden />
              <span
                className={`font-rc-mono text-[10px] uppercase tracking-wider ${v.text}`}
              >
                {v.label}
              </span>
            </span>
          )}
        </div>

        {/* The page's only H1. Two jobs at once — carry the phrase people
            search ("fishing in Seattle, WA") and confirm the promise in the ad
            that sent them ("today") — so it says both rather than picking. */}
        <h1
          id="radar"
          className="text-[15px] font-semibold text-slate-300 mt-2"
        >
          Fishing in {cityName}, {provinceCode}: today&apos;s forecast
        </h1>

        {species ? (
          <>
            <p className="text-[30px] sm:text-[38px] font-bold mt-2 leading-[1.05] tracking-tight">
              {win ? (
                <>
                  <span className="text-slate-400 text-[20px] sm:text-[24px] font-semibold block">
                    Best window
                  </span>
                  <span className="text-rc-emerald">{win}</span>
                </>
              ) : (
                <span className="text-rc-emerald">
                  {species.good_hours} fishable hours
                </span>
              )}
            </p>
            <p className="text-[14px] text-slate-300 mt-2.5 max-w-[52ch]">
              {/* No leading spot named here. The spotlight directly below is
                  the answer to "where", and two rankings on one screen only
                  ever get to disagree. */}
              {species.good_hours} fishable hour
              {species.good_hours === 1 ? "" : "s"} for{" "}
              <span className="text-white font-medium">{species.species_name}</span>
              {tidePhrase ? ` ${tidePhrase}` : ""}.
              {tideStationName ? ` Tides read from ${tideStationName}.` : ""}
            </p>
          </>
        ) : (
          <p className="text-[15px] text-slate-300 mt-3">
            Nothing is scored around {cityName} today.
          </p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 mt-5 pt-4 border-t border-white/10">
          <Metric label="Water" value={water ?? "No reading"} />
          <Metric label="Wind" value={wind ?? "No reading"} />
          <Metric label="Sea" value={chop ?? "No reading"} />
          <Metric label="Spots scored" value={`${scoredSpots} of ${memberSpots}`} />
        </div>
      </div>
    </section>
  );
}

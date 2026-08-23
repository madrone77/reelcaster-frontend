// The hero: today's regional bite radar.
//
// One job — confirm the promise in the ad before the reader decides to leave.
// So it states a verdict, a clock window, and three numbers, and it draws no
// charts. Everything on it is already computed upstream; nothing here re-ranks
// or re-scores, because a hero that disagreed with the leaderboard under it
// would be worse than no hero.
//
// It is a client component so the species chips can re-point it, but it takes
// the server's payload as props and renders whole on the server, so the words
// are in the HTML rather than a hydration away.

import type {
  BlueCasterCityConditions,
  BlueCasterCityTodaySpecies,
} from "@/lib/bluecaster";
import { formatHour12 } from "@/lib/time-format";
import type { HubWindow } from "./hub-data";

/**
 * Verdict → the pill.
 *
 * The upstream vocabulary is excellent/good/fair/slow and it is not
 * re-banded here. "Prime" is a label on `excellent`, not a fifth state.
 */
const VERDICT: Record<string, { label: string; tone: string }> = {
  excellent: {
    label: "Prime conditions",
    tone: "border-rc-good-border bg-rc-good-bg text-rc-good-ink",
  },
  good: {
    label: "Good windows",
    tone: "border-rc-good-border bg-rc-good-bg text-rc-good-ink",
  },
  fair: {
    label: "Fair windows",
    tone: "border-rc-fair-border bg-rc-fair-bg text-rc-fair-ink",
  },
  slow: {
    label: "Slow day",
    tone: "border-rc-poor-border bg-rc-poor-bg text-rc-poor-ink",
  },
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
    <div className="flex-1 min-w-[92px]">
      <div className="rc-label text-[9px] text-rc-ink-mute">{label}</div>
      <div className="font-rc-mono text-[15px] text-rc-ink mt-0.5">{value}</div>
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
  scoredSpots,
  memberSpots,
  tideStationName,
  tidePhrase,
}: {
  cityName: string;
  provinceCode: string;
  /** "Marine Area" in WA, "PFMA" in BC. Never hardcode one. */
  areaLabel: string;
  /** The city's own management areas. Empty is normal for a city whose spots
   *  have not been linked to areas yet, and the badge simply drops them. */
  areaNumbers: string[];
  verdict: string | null;
  /** The species the radar is currently pointed at — the roster headline by
   *  default, or whatever chip the reader picked. */
  species: BlueCasterCityTodaySpecies | null;
  conditions: BlueCasterCityConditions | null;
  scoredSpots: number;
  memberSpots: number;
  tideStationName: string | null;
  /** "on the morning flood", derived from the leading spot's tide phase at
   *  the peak hour. Null when the conditions strip has no phase for it. */
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
        : // No prevailing direction in the sample. Light scattered air is
          // the normal cause and naming a point would be invention.
          `${conditions.wind_speed_kt} kt`;

  // Seattle's spots span five WDFW areas. Either name them all or name none:
  // a truncated list picked whichever three sorted first, which on Seattle
  // meant showing 8-1, 8-2 and 9 while hiding 10 and 11, the two areas the
  // city is actually named for.
  const areaBadge = !areaNumbers.length
    ? null
    : areaNumbers.length <= 3
      ? `${areaLabel}${areaNumbers.length > 1 ? "s" : ""} ${areaNumbers.join(", ")}`
      : `${areaNumbers.length} ${areaLabel.toLowerCase()}s`;

  return (
    <section
      aria-labelledby="radar"
      className="rounded-xl border border-rc-rule bg-rc-panel p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="rc-label text-[9px] text-rc-ink-mute">
          {cityName}
          {areaBadge ? ` · ${areaBadge}` : ""}
        </span>
        {v && (
          <span
            className={`rounded-full border px-2.5 py-0.5 font-rc-mono text-[10px] uppercase tracking-wide ${v.tone}`}
          >
            {v.label}
          </span>
        )}
      </div>

      {/* The page's only H1. It has two jobs at once — carry the phrase
          people search ("fishing in Seattle, WA") and confirm the promise in
          the ad that sent them ("today") — so it says both rather than
          picking a side. */}
      <h1
        id="radar"
        className="text-[22px] sm:text-[26px] font-bold text-rc-ink mt-2 leading-tight"
      >
        Fishing in {cityName}, {provinceCode}: today&apos;s forecast
      </h1>

      {species ? (
        <>
          <p className="text-[26px] sm:text-[32px] font-bold text-rc-ink mt-3 leading-tight">
            {win ? `Best window ${win}` : `${species.good_hours} fishable hours`}
          </p>
          <p className="text-[14px] text-rc-ink-soft mt-1.5 max-w-[52ch]">
            {/* No leading spot named here. The leaderboard directly below
                is the answer to "where", and two rankings on one screen only
                ever get to disagree. */}
            {species.good_hours} fishable hour
            {species.good_hours === 1 ? "" : "s"} for {species.species_name}
            {tidePhrase ? ` ${tidePhrase}` : ""}.
            {tideStationName ? ` Tides read from ${tideStationName}.` : ""}
          </p>
        </>
      ) : (
        <p className="text-[15px] text-rc-ink-soft mt-3">
          Nothing is scored around {cityName} today.
        </p>
      )}

      <div className="flex flex-wrap gap-x-6 gap-y-3 mt-5 pt-4 border-t border-rc-rule">
        <Metric label="Water" value={water ?? "No reading"} />
        <Metric label="Wind" value={wind ?? "No reading"} />
        <Metric
          label="Spots scored"
          value={`${scoredSpots} of ${memberSpots}`}
        />
      </div>
    </section>
  );
}

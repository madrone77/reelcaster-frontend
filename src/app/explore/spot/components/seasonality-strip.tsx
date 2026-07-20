"use client";

import type { SeasonState } from "@/lib/bluecaster/live-spot-types";

// Cell fill per state. Off/no-data reads as a muted rail; peak/shoulder/closed
// borrow the app's tier language (good / fair / poor) so the strip speaks the
// same colour vocabulary as every score on the page.
const CELL: Record<SeasonState, string> = {
  peak: "bg-rc-good",
  shoulder: "bg-rc-fair",
  off: "bg-rc-rule",
  closed: "bg-rc-poor",
  nodata: "bg-rc-rule",
};

const STATE_LABEL: Record<SeasonState, string> = {
  peak: "Peak season",
  shoulder: "Shoulder season",
  off: "Off season",
  closed: "Closed",
  nodata: "No data",
};

// Header pill styling for the current state — tinted, matching the soft-tint
// callouts elsewhere on the page.
const STATE_PILL: Record<SeasonState, string> = {
  peak: "bg-rc-good-bg text-rc-good-ink",
  shoulder: "bg-rc-fair-bg text-rc-fair-ink",
  off: "bg-rc-surface text-rc-ink-mute",
  closed: "bg-rc-poor-bg text-rc-poor-ink",
  nodata: "bg-rc-surface text-rc-ink-mute",
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const LEGEND: [SeasonState, string][] = [
  ["peak", "Peak season"],
  ["shoulder", "Shoulder season"],
  ["off", "Off season"],
  ["closed", "Closed"],
];

/** Weeks remaining in the current run, counting forward from `todayWeek`. */
function weeksLeftInRun(weeks: SeasonState[], todayWeek: number): number {
  const state = weeks[todayWeek];
  if (state == null) return 0;
  let n = 0;
  for (let i = todayWeek + 1; i < weeks.length && weeks[i] === state; i++) n++;
  return n;
}

function runHeadline(state: SeasonState, left: number): string | null {
  if (state === "peak") return `~${left} more week${left === 1 ? "" : "s"} at peak`;
  if (state === "shoulder") return `~${left} more week${left === 1 ? "" : "s"} in shoulder`;
  return null;
}

/**
 * 52-week seasonality heatmap for the active species at this spot. One rounded
 * cell per ISO week, coloured by season state, with today's week ringed and
 * flagged. Real data from the spot payload (`seasonWeeksBySpecies` +
 * `seasonStateBySpecies` + `todayWeek`) — no synthetic calendar.
 */
export default function SeasonalityStrip({
  speciesName,
  weeks,
  state,
  todayWeek,
}: {
  speciesName: string;
  weeks: SeasonState[];
  state: SeasonState;
  todayWeek: number;
}) {
  if (!weeks || weeks.length === 0) return null;

  const left = weeksLeftInRun(weeks, todayWeek);
  const headline = runHeadline(state, left);
  const inSeasonVerb =
    state === "peak"
      ? `Currently in peak season for ${speciesName}`
      : state === "shoulder"
        ? `Shoulder season for ${speciesName}`
        : state === "closed"
          ? `${speciesName} is closed here right now`
          : `Off season for ${speciesName}`;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-lg font-bold text-rc-ink">Seasonality</h3>
        <span className="font-rc-mono text-[11px] text-rc-ink-mute shrink-0">
          52-week view · today highlighted
        </span>
      </div>
      <p className="text-sm text-rc-ink-soft mt-0.5">
        When {speciesName} is best at this spot
      </p>

      <div className="mt-4 rounded border border-rc-rule bg-rc-panel p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className={`shrink-0 px-2.5 py-1 rounded font-rc-mono text-[10px] font-bold uppercase tracking-[0.08em] ${STATE_PILL[state]}`}
            >
              {STATE_LABEL[state]}
            </span>
            <span className="text-sm font-semibold text-rc-ink truncate">
              {inSeasonVerb}
            </span>
          </div>
          {headline && (
            <span className="font-rc-mono text-[11px] text-rc-ink-mute shrink-0">
              {headline}
            </span>
          )}
        </div>

        {/* Week cells + today marker */}
        <div className="mt-5">
          <div
            className="grid gap-[3px]"
            style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}
          >
            {weeks.map((w, i) => {
              const isToday = i === todayWeek;
              return (
                <div key={i} className="relative">
                  <div
                    className={`h-8 rounded ${CELL[w] ?? CELL.off} ${
                      isToday
                        ? "ring-2 ring-rc-brand ring-offset-1 ring-offset-rc-panel"
                        : ""
                    }`}
                    title={`Week ${i + 1} · ${STATE_LABEL[w] ?? STATE_LABEL.off}`}
                  />
                </div>
              );
            })}
          </div>

          {/* Today pointer */}
          <div
            className="grid mt-1"
            style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}
            aria-hidden
          >
            {weeks.map((_, i) => (
              <div key={i} className="flex justify-center">
                {i === todayWeek && (
                  <span className="block w-0 h-0 border-l-[4px] border-r-[4px] border-b-[5px] border-l-transparent border-r-transparent border-b-rc-brand" />
                )}
              </div>
            ))}
          </div>

          {/* Month scale */}
          <div className="grid grid-cols-12 mt-1.5">
            {MONTHS.map((m) => (
              <span
                key={m}
                className="font-rc-mono text-[10px] text-rc-ink-mute uppercase tracking-[0.04em]"
              >
                {m}
              </span>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-5">
          {LEGEND.map(([s, label]) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${CELL[s]}`} />
              <span className="font-rc-mono text-[11px] text-rc-ink-soft">
                {label}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

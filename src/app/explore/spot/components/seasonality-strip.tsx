"use client";

import type { RegWeekState, SeasonState } from "@/lib/bluecaster/live-spot-types";

// Cell FILL per abundance state — pure biology. Closure is no longer a fill;
// it's a hatch overlay (see REG_HATCH). Off/no-data reads as a muted rail;
// peak/shoulder borrow the app's tier language (good / fair) so the strip
// speaks the same colour vocabulary as every score on the page.
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

// Regulatory OVERLAY — a diagonal hatch drawn on top of the abundance fill so
// a week can read "peak abundance, but you can't keep one." Two weights:
// release-only = slate hatch (fish it, release it); closed = red hatch + edge
// (hard stop). retention_open / nodata draw nothing (the fill speaks).
const REG_HATCH: Partial<Record<RegWeekState, React.CSSProperties>> = {
  release_only: {
    backgroundImage:
      "repeating-linear-gradient(45deg, transparent 0 3px, rgba(42,51,68,0.5) 3px 5px)",
  },
  closed: {
    backgroundImage:
      "repeating-linear-gradient(45deg, transparent 0 2px, var(--rc-poor) 2px 4.5px)",
    boxShadow: "inset 0 0 0 1.5px var(--rc-poor)",
  },
};

const REG_LABEL: Record<RegWeekState, string> = {
  retention_open: "Retention open",
  release_only: "Release only",
  closed: "Closed",
  nodata: "",
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
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

/** "2026-08-01" → "Aug 1". Null-safe. */
function fmtOpenDate(iso: string | null): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const month = MONTHS[Number(m[2]) - 1];
  if (!month) return null;
  return `${month} ${Number(m[3])}`;
}

type Status = {
  pillLabel: string;
  pillClass: string;
  sentence: string;
  /** Right-aligned mono line — run headline, or the retention-opens hint. */
  mono: string | null;
};

// The current-status header. Regulation reality leads: if you can't keep a
// fish right now, the strip says so instead of cheerfully announcing "peak."
// Abundance still colours the sentence so a peak run under a release-only
// window reads as the (genuinely useful) "peak, but release-only" story.
function buildStatus(
  abundance: SeasonState,
  reg: RegWeekState,
  speciesName: string,
  nextOpenDate: string | null,
  nextOpenSummary: string | null,
  runMono: string | null,
): Status {
  const abundanceWord =
    abundance === "peak" ? "Peak run" : abundance === "shoulder" ? "Shoulder season" : null;
  const openWhen = fmtOpenDate(nextOpenDate);
  const opensHint = openWhen
    ? `Retention opens ${openWhen}${nextOpenSummary ? ` · ${nextOpenSummary}` : ""}`
    : null;

  if (reg === "closed") {
    return {
      pillLabel: "Closed",
      pillClass: "bg-rc-poor-bg text-rc-poor-ink",
      sentence: `${speciesName} is closed here right now`,
      mono: openWhen ? `Reopens ${openWhen}` : null,
    };
  }
  if (reg === "release_only") {
    return {
      pillLabel: "Release only",
      pillClass: "bg-rc-surface text-rc-ink-soft",
      sentence: abundanceWord
        ? `${abundanceWord} for ${speciesName} — but catch-and-release only`
        : `Catch-and-release only for ${speciesName} right now`,
      mono: opensHint,
    };
  }
  // Retention open (or unknown) — abundance leads, as before.
  return {
    pillLabel: STATE_LABEL[abundance],
    pillClass:
      abundance === "peak"
        ? "bg-rc-good-bg text-rc-good-ink"
        : abundance === "shoulder"
          ? "bg-rc-fair-bg text-rc-fair-ink"
          : "bg-rc-surface text-rc-ink-mute",
    sentence:
      abundance === "peak"
        ? `Currently in peak season for ${speciesName}`
        : abundance === "shoulder"
          ? `Shoulder season for ${speciesName}`
          : `Off season for ${speciesName}`,
    mono: runMono,
  };
}

/**
 * 52-week seasonality heatmap for the active species at this spot. One rounded
 * cell per ISO week: the fill is biological abundance, and a diagonal hatch
 * overlays weeks where retention is restricted (release-only) or shut
 * (closed) — so a peak week under a closure reads honestly instead of green.
 * Real data from the spot payload (`seasonWeeksBySpecies` +
 * `regWeeksBySpecies` + `seasonStateBySpecies` + `todayWeek`).
 */
export default function SeasonalityStrip({
  speciesName,
  weeks,
  regWeeks,
  state,
  todayWeek,
  nextOpenDate = null,
  nextOpenSummary = null,
}: {
  speciesName: string;
  weeks: SeasonState[];
  regWeeks?: RegWeekState[];
  state: SeasonState;
  todayWeek: number;
  nextOpenDate?: string | null;
  nextOpenSummary?: string | null;
}) {
  if (!weeks || weeks.length === 0) return null;

  const regNow: RegWeekState = regWeeks?.[todayWeek] ?? "nodata";
  const runMono = runHeadline(state, weeksLeftInRun(weeks, todayWeek));
  const status = buildStatus(
    state,
    regNow,
    speciesName,
    nextOpenDate,
    nextOpenSummary,
    runMono,
  );

  // Only surface a hatch legend entry for states that actually appear.
  const hasRelease = regWeeks?.some((r) => r === "release_only") ?? false;
  const hasClosed = regWeeks?.some((r) => r === "closed") ?? false;

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
              className={`shrink-0 px-2.5 py-1 rounded font-rc-mono text-[10px] font-bold uppercase tracking-[0.08em] ${status.pillClass}`}
            >
              {status.pillLabel}
            </span>
            <span className="text-sm font-semibold text-rc-ink truncate">
              {status.sentence}
            </span>
          </div>
          {status.mono && (
            <span className="font-rc-mono text-[11px] text-rc-ink-mute shrink-0">
              {status.mono}
            </span>
          )}
        </div>

        {/* Week cells — abundance fill + regulatory hatch overlay + today marker */}
        <div className="mt-5">
          <div
            className="grid gap-[3px]"
            style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}
          >
            {weeks.map((w, i) => {
              const isToday = i === todayWeek;
              const reg = regWeeks?.[i];
              const overlay = reg ? REG_HATCH[reg] : undefined;
              const regNote = reg && REG_LABEL[reg] ? ` · ${REG_LABEL[reg]}` : "";
              return (
                <div key={i} className="relative">
                  <div
                    className={`h-8 rounded ${CELL[w] ?? CELL.off} ${
                      isToday
                        ? "ring-2 ring-rc-brand ring-offset-1 ring-offset-rc-panel"
                        : ""
                    }`}
                    title={`Week ${i + 1} · ${STATE_LABEL[w] ?? STATE_LABEL.off}${regNote}`}
                  />
                  {overlay && (
                    <div
                      className="absolute inset-0 rounded pointer-events-none"
                      style={overlay}
                      aria-hidden
                    />
                  )}
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

        {/* Legend — abundance (fill) on the left, regulatory (hatch) on the right */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-5">
          <LegendDot className="bg-rc-good" label="Peak season" />
          <LegendDot className="bg-rc-fair" label="Shoulder season" />
          <LegendDot className="bg-rc-rule" label="Off season" />
          {(hasRelease || hasClosed) && (
            <span className="w-px h-3.5 bg-rc-rule" aria-hidden />
          )}
          {hasRelease && (
            <LegendSwatch style={REG_HATCH.release_only!} label="Release only" />
          )}
          {hasClosed && (
            <LegendSwatch style={REG_HATCH.closed!} label="Closed" />
          )}
        </div>
      </div>
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-2.5 h-2.5 rounded-full ${className}`} />
      <span className="font-rc-mono text-[11px] text-rc-ink-soft">{label}</span>
    </span>
  );
}

function LegendSwatch({
  style,
  label,
}: {
  style: React.CSSProperties;
  label: string;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="w-3.5 h-3.5 rounded-[3px] bg-rc-rule"
        style={style}
        aria-hidden
      />
      <span className="font-rc-mono text-[11px] text-rc-ink-soft">{label}</span>
    </span>
  );
}

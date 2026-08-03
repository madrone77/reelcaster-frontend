"use client";

import { useEffect, useState } from "react";
import type {
  RegWeekState,
  UpcomingRegChange,
} from "@/lib/bluecaster/live-spot-types";

const HORIZON_DAYS = 30;
const DAY_MS = 86400000;

// Regulatory hatch — identical vocabulary to SeasonalityStrip so the year view
// and this near-term day view read as one language: release-only = slate hatch
// (fish it, release it); closed = red hatch + edge (hard stop). retention_open
// / nodata draw nothing (the fill speaks).
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

// Base fill per regulatory state for the day cells. This strip is purely
// regulatory (no abundance), so open days stay quiet — the restricted days are
// what the strip exists to surface.
const DAY_FILL: Record<RegWeekState, string> = {
  retention_open: "bg-rc-good-soft",
  release_only: "bg-rc-surface",
  closed: "bg-rc-poor-bg",
  nodata: "bg-rc-rule",
};

const REG_LABEL: Record<RegWeekState, string> = {
  retention_open: "Retention open",
  release_only: "Release only",
  closed: "Closed",
  nodata: "No data",
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const CHANGE_VERB: Record<UpcomingRegChange["changeType"], string> = {
  opening: "Opens",
  closure: "Closes",
  gear: "Gear change",
  limit: "Limit change",
  other: "Rule change",
};

// changeType → accent token. Valence only (opening good, closure hard-stop);
// certainty is carried separately by the confidence chip, never by colour.
const CHANGE_ACCENT: Record<
  UpcomingRegChange["changeType"],
  { dot: string; solidChip: string }
> = {
  opening: { dot: "bg-rc-good", solidChip: "bg-rc-good text-white" },
  closure: { dot: "bg-rc-poor", solidChip: "bg-rc-poor text-white" },
  gear: { dot: "bg-rc-fair", solidChip: "bg-rc-fair text-white" },
  limit: { dot: "bg-rc-fair", solidChip: "bg-rc-fair text-white" },
  other: { dot: "bg-rc-ink-mute", solidChip: "bg-rc-ink text-white" },
};

/** "2026-08-15" → { mon: "AUG", day: "15" }. Deterministic (no wall clock). */
function isoParts(iso: string): { mon: string; day: string } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const mon = MONTHS[Number(m[2]) - 1];
  if (!mon) return null;
  return { mon: mon.toUpperCase(), day: String(Number(m[3])) };
}

/**
 * Near-term regulation view for the active species: an always-on 30-day
 * forward day-strip (regulated days marked with the seasonality hatch) plus the
 * next few dated changes, each tagged confirmed (a published DFO notice) or
 * expected (projected from the season calendar). The two tiers are visually
 * distinct — an expected change is never dressed up as confirmed.
 */
export default function UpcomingRegulations({
  speciesName,
  speciesId,
  regWeeks,
  todayWeek,
  changes,
  maxChanges = 3,
}: {
  speciesName: string;
  speciesId: string | null;
  regWeeks?: RegWeekState[];
  todayWeek: number;
  changes: UpcomingRegChange[];
  maxChanges?: number;
}) {
  // The day-strip maps calendar days to week-regulation states via today's
  // position in its ISO week — wall-clock dependent, so render it client-side
  // only to avoid an SSR/CSR hydration mismatch. The list below uses payload
  // date strings (deterministic) and renders immediately.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Changes relevant to the selected species, plus spot-wide ones (speciesId
  // null = "all species" closures), nearest first, capped.
  const relevant = changes
    .filter((c) => c.speciesId === speciesId || c.speciesId === null)
    .slice(0, maxChanges);
  const extraCount = Math.max(
    0,
    changes.filter((c) => c.speciesId === speciesId || c.speciesId === null)
      .length - relevant.length,
  );

  const hasStrip = !!regWeeks && regWeeks.length > 0;
  if (!hasStrip && relevant.length === 0) return null;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-lg font-bold text-rc-ink">Upcoming changes</h3>
        <span className="font-rc-mono text-[11px] text-rc-ink-mute shrink-0">
          next 30 days
        </span>
      </div>
      <p className="text-sm text-rc-ink-soft mt-0.5">
        Regulation changes ahead for {speciesName} at this spot
      </p>

      <div className="mt-4 rounded border border-rc-rule bg-rc-panel p-5 space-y-5">
        {hasStrip && (
          <DayStrip regWeeks={regWeeks!} todayWeek={todayWeek} mounted={mounted} />
        )}

        {relevant.length > 0 ? (
          <ul className="space-y-2">
            {relevant.map((c, i) => (
              <ChangeRow key={`${c.speciesId}-${c.date}-${i}`} change={c} />
            ))}
            {extraCount > 0 && (
              <li className="font-rc-mono text-[11px] text-rc-ink-mute pt-0.5">
                +{extraCount} more in the next 60 days
              </li>
            )}
          </ul>
        ) : (
          hasStrip && (
            <p className="font-rc-mono text-[11px] text-rc-ink-mute">
              No dated changes announced in the next 30 days.
            </p>
          )
        )}
      </div>
    </div>
  );
}

function DayStrip({
  regWeeks,
  todayWeek,
  mounted,
}: {
  regWeeks: RegWeekState[];
  todayWeek: number;
  mounted: boolean;
}) {
  // Reserve height so the client-only fill doesn't shift the layout.
  if (!mounted) {
    return <div className="h-8 rounded bg-rc-surface" aria-hidden />;
  }

  const now = new Date();
  // Today's index within its ISO week (Mon=0 … Sun=6). Week boundaries crossed
  // by day offset d = floor((dow + d) / 7); the difference cancels whatever
  // absolute numbering the backend used for `todayWeek`, so this stays aligned
  // to regWeeks[todayWeek] = this week without recomputing ISO week numbers.
  const dow = (now.getUTCDay() + 6) % 7;
  const lastIdx = regWeeks.length - 1;

  const days = Array.from({ length: HORIZON_DAYS }, (_, d) => {
    const date = new Date(now.getTime() + d * DAY_MS);
    const wi = Math.min(todayWeek + Math.floor((dow + d) / 7), lastIdx);
    const reg: RegWeekState = regWeeks[wi] ?? "nodata";
    return { d, date, reg };
  });

  const hasRelease = days.some((x) => x.reg === "release_only");
  const hasClosed = days.some((x) => x.reg === "closed");

  // ~weekly date ticks under the strip (day 0, 7, 14, 21, 28).
  const ticks = [0, 7, 14, 21, 28];

  return (
    <div>
      <div
        className="grid gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${HORIZON_DAYS}, minmax(0, 1fr))` }}
      >
        {days.map(({ d, date, reg }) => {
          const overlay = REG_HATCH[reg];
          const isToday = d === 0;
          const label = `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()} · ${REG_LABEL[reg]}`;
          return (
            <div key={d} className="relative">
              <div
                className={`h-8 rounded ${DAY_FILL[reg]} ${
                  isToday
                    ? "ring-2 ring-rc-brand ring-offset-1 ring-offset-rc-panel"
                    : ""
                }`}
                title={label}
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

      {/* Date ticks */}
      <div
        className="grid mt-1.5"
        style={{ gridTemplateColumns: `repeat(${HORIZON_DAYS}, minmax(0, 1fr))` }}
        aria-hidden
      >
        {Array.from({ length: HORIZON_DAYS }, (_, d) => {
          const date = new Date(now.getTime() + d * DAY_MS);
          const tick = ticks.includes(d);
          return (
            <span
              key={d}
              className="font-rc-mono text-[10px] text-rc-ink-mute uppercase tracking-[0.04em] whitespace-nowrap"
              style={{ gridColumn: `${d + 1} / span 7` }}
            >
              {tick ? `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}` : ""}
            </span>
          );
        })}
      </div>

      {/* Legend — only the states that appear */}
      {(hasRelease || hasClosed) && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4">
          <LegendSwatch className="bg-rc-good-soft" label="Retention open" />
          {hasRelease && (
            <LegendSwatch
              className="bg-rc-surface"
              style={REG_HATCH.release_only}
              label="Release only"
            />
          )}
          {hasClosed && (
            <LegendSwatch
              className="bg-rc-poor-bg"
              style={REG_HATCH.closed}
              label="Closed"
            />
          )}
        </div>
      )}
    </div>
  );
}

function ChangeRow({ change: c }: { change: UpcomingRegChange }) {
  const parts = isoParts(c.date);
  const accent = CHANGE_ACCENT[c.changeType];
  const confirmed = c.confidence === "confirmed";
  const verb = CHANGE_VERB[c.changeType];

  // Confidence governs contrast: confirmed reads at full strength; expected is
  // muted throughout so it can never be mistaken for a ratified change.
  const titleTone = confirmed ? "text-rc-ink" : "text-rc-ink-mute";
  const bodyTone = confirmed ? "text-rc-ink-soft" : "text-rc-ink-mute";
  const dateTone = confirmed
    ? "bg-rc-surface text-rc-ink"
    : "bg-transparent text-rc-ink-mute";

  return (
    <li className="flex items-start gap-3">
      {/* Date block */}
      <span
        className={`shrink-0 w-11 rounded ${dateTone} px-1 py-1 text-center leading-tight`}
      >
        <span className="block font-rc-mono text-[9px] uppercase tracking-[0.06em] text-rc-ink-mute">
          {parts?.mon ?? "—"}
        </span>
        <span className={`block font-rc-mono text-[15px] font-bold ${titleTone}`}>
          {parts?.day ?? "?"}
        </span>
      </span>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${accent.dot}`} aria-hidden />
          <span className={`text-sm font-semibold truncate ${titleTone}`}>
            {c.speciesCommon} — {verb}
          </span>
        </div>
        {c.summary && (
          <p className={`text-[13px] mt-0.5 ${bodyTone}`}>{c.summary}</p>
        )}
      </div>

      {/* Confidence chip */}
      {confirmed ? (
        <span
          className={`shrink-0 self-center px-2 py-0.5 rounded font-rc-mono text-[9px] font-bold uppercase tracking-[0.08em] ${accent.solidChip}`}
        >
          Confirmed
        </span>
      ) : (
        <span
          className="shrink-0 self-center px-2 py-0.5 rounded border border-dashed border-rc-rule font-rc-mono text-[9px] font-bold uppercase tracking-[0.08em] text-rc-ink-mute"
          title="Projected from the season calendar — not yet confirmed by a DFO notice"
        >
          Expected
        </span>
      )}
    </li>
  );
}

function LegendSwatch({
  className,
  style,
  label,
}: {
  className: string;
  style?: React.CSSProperties;
  label: string;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-3.5 h-3.5 rounded-[3px] ${className}`} style={style} aria-hidden />
      <span className="font-rc-mono text-[11px] text-rc-ink-soft">{label}</span>
    </span>
  );
}

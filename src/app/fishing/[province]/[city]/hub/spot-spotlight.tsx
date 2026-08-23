// Today's top water, as one card that does not look like the five under it.
//
// The original leaderboard was six identical white boxes carrying 85, 84, 84,
// 83, 83, 82 — a spread of three points rendered as six equal choices, which
// is a directory, not a recommendation. This lifts the first one out and lets
// the rest be a list.
//
// ── What it says, and what it cannot ─────────────────────────────────────
//
// It carries the score, the window, the tide phase that window opens on, the
// seabed, and the city's method for the species. It carries NO target depth
// and no rig size, because neither exists: `depth_avg_m` is null on all 164
// published spots, `depth_profiles` holds 7 rows product-wide, and
// `catch_signals.depth_ft` 2. A card reading "@ 110-130 ft" would be
// inventing that number on every spot in the product.

"use client";

import Link from "next/link";
import { bottomLabel, type HubSpeciesEntry, type HubSpot } from "./hub-data";
import { windowLabel } from "./bite-radar";

function Pill({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2">
      <div className="rc-label text-[9px] text-slate-400">
        <span aria-hidden>{icon}</span> {label}
      </div>
      <div className="text-[13px] text-white font-medium mt-0.5">{value}</div>
    </div>
  );
}

export default function SpotSpotlight({
  spot,
  entry,
  rankLine,
  phase,
  tactic,
  cityName,
}: {
  spot: HubSpot;
  entry: HubSpeciesEntry;
  /**
   * Why this mark is the one being featured, in a sentence — built by the
   * caller, because only the caller knows whether a species filter is on.
   *
   * It is load-bearing because the scores tie: since the midday rescale a
   * good Victoria day puts eighteen marks within a point or two of each
   * other, so a lone "82" gives a reader no reason to believe this spot beat
   * the rest. The ranking is real (peak, then the whole day's mean) but the
   * badge cannot show it, and the denominator turns the number back into a
   * choice.
   */
  rankLine: string;
  /** "Late ebb" at the window's opening hour, or null. */
  phase: string | null;
  /** The city's method for this species. City grain — the label says so. */
  tactic: string | null;
  cityName: string;
}) {
  const win = windowLabel(entry.window);
  const bottom = bottomLabel(spot.bottom);

  return (
    <section aria-labelledby="spotlight">
      <Link
        href={`/explore/spot/${spot.slug}`}
        className="group block rounded-2xl bg-rc-navy text-white overflow-hidden shadow-rc-panel"
      >
        <div className="flex items-center gap-2 px-5 pt-4">
          <span className="rc-label text-[9px] text-rc-emerald">
            Today&apos;s top water
          </span>
          <span className="h-px flex-1 bg-rc-emerald/30" aria-hidden />
          {spot.hasReports && (
            <span className="font-rc-mono text-[10px] text-slate-400">
              {/* Presence only. The counts behind this are Pro-gated, and the
                  reports themselves are never quoted anywhere. */}
              Recent reports
            </span>
          )}
        </div>

        <div className="flex items-start gap-4 px-5 pt-2.5">
          <span className="shrink-0 rounded-xl bg-rc-emerald px-3 py-2 text-rc-navy-deep">
            <span className="block font-rc-mono text-[26px] font-bold leading-none tabular-nums">
              {entry.peak}
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <h2
              id="spotlight"
              className="text-[21px] sm:text-[24px] font-bold leading-tight group-hover:text-rc-emerald transition-colors"
            >
              {spot.name}
            </h2>
            <p className="font-rc-mono text-[11px] text-slate-400 mt-1">
              {rankLine}
            </p>
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 px-5 pt-4">
          {win && <Pill icon="⏱" label="Window" value={win} />}
          {phase && <Pill icon="🌊" label="Tide" value={phase} />}
          {bottom && <Pill icon="⛰" label="Bottom" value={bottom} />}
          {tactic && <Pill icon="🎯" label={`How ${cityName} fishes it`} value={tactic} />}
        </div>

        <div className="mt-4 border-t border-white/10 px-5 py-3 text-[13px] font-semibold text-rc-emerald">
          See the full day at {spot.name}
          <span aria-hidden> →</span>
        </div>
      </Link>
    </section>
  );
}

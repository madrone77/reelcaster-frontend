// Today's top water, as one card that does not look like the four under it.
//
// White with an emerald edge, NOT navy. It was navy first, directly beneath a
// navy hero, and two dark blocks stacked with a chip bar between them read as
// one slab through the middle of a phone screen — which loses the separation
// the spotlight existed to create. Sharing the accent instead of the fill
// links the two without merging them.
//
// No topographic watermark behind it either, though it was asked for: a
// contour texture under a named mark reads as that mark's actual bathymetry,
// and we would be drawing a decorative pattern. The relief tiles are real but
// belong on the map, where they are the data rather than a backdrop, and
// fetching them for a card would spend the FCP budget this page is built
// around.
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

/**
 * The rc-label look, without rc-label's colour.
 *
 * `.rc-label` sets `color: var(--rc-ink-mute)` and rc-tokens.css is imported
 * AFTER Tailwind, so a `text-*` utility beside it has equal specificity and
 * loses on source order. On the dark hero that is harmless — ink-mute is
 * 5.3:1 on navy — but on this card's light surfaces it pins every small label
 * to 2.8:1, under the 4.5:1 floor. Spelling the type out is clearer than
 * fighting the cascade with `!`.
 */
const LABEL =
  "font-rc-mono text-[10px] font-semibold uppercase leading-3 text-rc-ink-soft";

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
    <div className="rounded-lg bg-rc-surface px-3 py-2">
      <div className={LABEL}>
        <span aria-hidden>{icon}</span> {label}
      </div>
      <div className="text-[13px] text-rc-ink font-semibold mt-0.5">{value}</div>
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
        className="group block rounded-2xl border-2 border-rc-emerald bg-rc-panel overflow-hidden shadow-rc-panel"
      >
        <div className="flex items-center gap-2 bg-rc-emerald px-5 py-1.5">
          <span className="font-rc-mono text-[10px] font-bold uppercase leading-3 text-rc-navy-deep">
            Today&apos;s top water
          </span>
          <span className="flex-1" aria-hidden />
          {spot.hasReports && (
            <span className="text-[10px] font-semibold text-rc-navy-deep">
              {/* Presence only. The counts behind this are Pro-gated, and the
                  reports themselves are never quoted anywhere. */}
              Recent reports
            </span>
          )}
        </div>

        <div className="flex items-start gap-4 px-5 pt-4">
          <span className="shrink-0 rounded-xl bg-rc-emerald-deep px-3 py-2 text-white">
            <span className="block font-rc-mono text-[26px] font-bold leading-none tabular-nums">
              {entry.peak}
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <h2
              id="spotlight"
              className="text-[21px] sm:text-[24px] font-bold leading-tight text-rc-ink group-hover:text-rc-emerald-deep transition-colors"
            >
              {spot.name}
            </h2>
            <p className="text-[12px] font-medium text-rc-ink-soft mt-1">
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

        <div className="mt-4 border-t border-rc-rule px-5 py-3 text-[13px] font-semibold text-rc-emerald-deep">
          See the full day at {spot.name}
          <span aria-hidden> →</span>
        </div>
      </Link>
    </section>
  );
}

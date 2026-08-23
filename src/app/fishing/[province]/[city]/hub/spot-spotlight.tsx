// Today's top water, as one card that does not look like the four under it.
//
// White with an emerald edge, NOT navy. It was navy first, directly beneath a
// navy hero, and two dark blocks stacked with a chip bar between them read as
// one slab through the middle of a phone screen — which loses the separation
// the spotlight existed to create. Sharing the accent instead of the fill
// links the two without merging them.
//
// No topographic watermark, though one was asked for: a contour texture under
// a named mark reads as that mark's actual bathymetry, and we would be
// drawing a decorative pattern. The relief tiles are real but belong on the
// map, where they are the data rather than a backdrop, and fetching them for
// a card would spend the FCP budget this page is built around.
//
// ── What it says, and what it cannot ─────────────────────────────────────
//
// It carries the score, the window, the tide phase that window opens on, the
// seabed, and the city's method. It carries NO target depth and no rig size,
// because neither exists: `depth_avg_m` is null on all 164 published spots,
// `depth_profiles` holds 7 rows product-wide, and `catch_signals.depth_ft` 2.
// A card reading "110 to 130 ft" would be inventing that number on every spot
// in the product.

"use client";

import Link from "next/link";
import { bottomLabel, type HubSpeciesEntry, type HubSpot } from "./hub-data";
import { windowLabel } from "./bite-radar";
import { Chip, Label, PAD, PANEL, TYPE } from "./ui";

/**
 * One fact per box.
 *
 * Labels carry no icon. They used to have one each, and four different
 * pictograms on one card is decoration competing with the four values it is
 * meant to be introducing.
 */
function Fact({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  /** Spans the grid. The method is the only fact that needs it: its label
   *  wraps to two lines and its value runs to a clause, so in a half-width
   *  cell it stretched its neighbour to match. */
  wide?: boolean;
}) {
  return (
    <div
      className={`flex flex-col rounded-lg bg-rc-surface px-3 py-2.5 ${
        wide ? "col-span-2" : ""
      }`}
    >
      <Label>{label}</Label>
      <span className="mt-1 text-[13px] font-semibold text-rc-ink">{value}</span>
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
   * the rest. The ranking is real but the badge cannot show it, and the
   * denominator turns the number back into a choice.
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
        className={`group block overflow-hidden border-2 border-rc-emerald bg-rc-panel ${PANEL}`}
      >
        <div className="flex items-center justify-between gap-3 bg-rc-emerald px-4 py-2">
          <Label tone="onAccent">Today&apos;s top water</Label>
          {/* Band, never a number, and never a quote. The counts behind it
              are Pro-gated and the reports themselves are never rendered. */}
          {spot.trackRecord === "popular" && (
            <Label tone="onAccent">Popular spot</Label>
          )}
        </div>

        <div className={PAD}>
          <div className="flex items-start gap-3.5">
            <span className="shrink-0 rounded-lg bg-rc-emerald-deep px-3 py-2 font-rc-mono text-[26px] font-bold leading-none tabular-nums text-white">
              {entry.peak}
            </span>
            <span className="min-w-0 flex-1">
              <h2
                id="spotlight"
                className={`${TYPE.title} text-rc-ink group-hover:text-rc-emerald-deep transition-colors`}
              >
                {spot.name}
              </h2>
              <p className={`${TYPE.meta} text-rc-ink-soft mt-1`}>{rankLine}</p>
              {/* The seabed is a chip beside the name rather than a fourth
                  box. Three boxes in a two-column grid leaves a hole, and it
                  is the one fact here that describes the PLACE rather than
                  today — which is also how the cards below render it. */}
              {bottom && (
                <span className="mt-2 inline-flex">
                  <Chip>{bottom}</Chip>
                </span>
              )}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 items-stretch gap-2">
            {win && <Fact label="Window" value={win} />}
            {phase && <Fact label="Tide" value={phase} wide={!win} />}
            {tactic && (
              <Fact label={`How ${cityName} fishes it`} value={tactic} wide />
            )}
          </div>
        </div>

        <div className="border-t border-rc-rule px-4 py-3 text-[13px] font-semibold text-rc-emerald-deep">
          See the full day at {spot.name}
          <span aria-hidden> &rarr;</span>
        </div>
      </Link>
    </section>
  );
}

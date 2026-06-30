"use client";

import Link from "next/link";
import { tierFor, TIER_PILL, TIER_TEXT, fmtPeak } from "../../lib/explore-data";
import type { NearbySpotCard } from "@/lib/bluecaster/live-spot-types";

/** Hour-of-day of the peak score in a 24h series (null if all empty). */
function peakHourOf(series: (number | null)[]): number | null {
  let hour: number | null = null;
  let max = -1;
  series.forEach((v, i) => {
    if (typeof v === "number" && v > max) {
      max = v;
      hour = i;
    }
  });
  return hour;
}

/**
 * "Neighbouring spots" — three columns of nearby spots from the spot-page
 * payload: name + DFO area, the peak score (tier-coloured) + tier pill, and the
 * top species + peak hour (derived from the spot's `scoreNext24h` series, same
 * as the 14-day strip's peak). Header links back to the Explore map.
 *
 * Note: BlueCaster's `nearbySpots` payload carries no distance/coords, so the
 * sub-line shows the DFO area rather than "X km away".
 */
export default function NeighbourSpots({
  spots,
}: {
  spots: NearbySpotCard[];
}) {
  if (spots.length === 0) return null;
  return (
    <div className="rounded-xl border border-rc-rule bg-rc-panel p-4 lg:p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="rc-label text-[9px]">NEIGHBOURING SPOTS</div>
        <Link
          href="/explore"
          className="font-rc-mono text-[11px] font-semibold text-rc-brand hover:underline"
        >
          View all on map →
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-5">
        {spots.slice(0, 3).map((n) => {
          const top = n.species[0];
          const tier = tierFor(top?.score ?? null);
          const peak = fmtPeak(peakHourOf(n.scoreNext24h));
          const species = n.scoreTopSpeciesName || top?.name || null;
          return (
            <div key={n.id} className="min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-base font-bold text-rc-ink truncate">
                    {n.name}
                  </div>
                  <div className="font-rc-mono text-[11px] text-rc-ink-mute mt-0.5">
                    {n.dfoArea ? `Area ${n.dfoArea}` : "—"}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div
                    className={`text-3xl font-bold leading-none tracking-[-0.03em] ${TIER_TEXT[tier]}`}
                  >
                    {top ? Math.round(top.score) : "—"}
                  </div>
                  <span
                    className={`inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-[0.06em] ${TIER_PILL[tier]}`}
                  >
                    {tier}
                  </span>
                </div>
              </div>
              {(species || peak) && (
                <div className="font-rc-mono text-[11px] text-rc-ink-soft mt-3">
                  {species ?? "—"}
                  {peak ? ` · peak ${peak}` : ""}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

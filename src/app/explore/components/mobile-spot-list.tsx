"use client";

import { useMemo, useState } from "react";
import type { RailSpot } from "../lib/explore-data";
import type { FreshCatchesResponse } from "../lib/fresh-catch-types";
import SpotCard from "./spot-card";
import SortControl, { type SortKey, sortSpots } from "./sort-control";

/**
 * Mobile (<lg) list section for the Explore document flow: the "Viewing all
 * spots" header + count, a Sort control, and the SpotCard list. Reuses the
 * same SpotCard the desktop rail renders. Sort is local presentation state —
 * kept out of the shell so it never reorders the map / forecast anchor.
 */
export default function MobileSpotList({
  spots,
  tz,
  onSelectSpot,
  freshCatches,
}: {
  spots: RailSpot[];
  tz: string;
  onSelectSpot: (slug: string) => void;
  /** Scraped catch reports keyed by spot id — same payload, same badge as the
   *  desktop rail beside it. Already Pro-gated by the route. */
  freshCatches?: FreshCatchesResponse | null;
}) {
  const [sort, setSort] = useState<SortKey>("score");
  const sorted = useMemo(() => sortSpots(spots, sort), [spots, sort]);

  return (
    <section className="lg:hidden bg-rc-page">
      {/* One card per row at its authored ~360px measure, centered — same single
          column as the desktop rail (no 2-up on tablet). */}
      <div className="max-w-[392px] mx-auto">
        <div className="px-4 pt-4 pb-2 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="rc-label text-[9px]">Viewing all spots</div>
          <div className="text-[15px] font-semibold text-rc-ink mt-0.5">
            {spots.length} spot{spots.length === 1 ? "" : "s"}
          </div>
        </div>

        {spots.length > 1 && <SortControl sort={sort} onSort={setSort} />}
      </div>

      <div className="px-4 pb-4 space-y-3">
        {sorted.map((spot) => (
          <SpotCard
            key={spot.id}
            spot={spot}
            tz={tz}
            layout="row"
            onSelect={() => onSelectSpot(spot.slug)}
            fresh={freshCatches?.spots[spot.id]}
          />
        ))}

        {spots.length === 0 && (
          <div className="text-center py-10 px-4">
            <p className="text-sm font-semibold text-rc-ink mb-1">
              No published spots here yet
            </p>
            <p className="text-xs text-rc-ink-mute">
              Coverage is rolling out across BC, WA, and OR, and new spots are
              added every week.
            </p>
          </div>
        )}
        </div>
      </div>
    </section>
  );
}

// Today's spots, ranked.
//
// Six cards, not sixteen. The map below this section is where a reader who
// wants the whole roster goes; this is the short answer, and a leaderboard
// that runs past a phone screen stops being one.
//
// ── What a card does NOT say ─────────────────────────────────────────────
//
// No target depth. `depth_profiles` holds seven rows product-wide and none of
// them are in Washington, so a depth band on these cards would be invented on
// every card that carries one. The tactic line is CITY grain (the wizard
// profiles techniques per city and species, never per spot), so it is
// rendered once under the chips rather than repeated under each card, where
// it would read as a per-spot recommendation it is not.

"use client";

import Link from "next/link";
import { TIER_PILL, tierFor } from "../../../../explore/lib/explore-data";
import { windowLabel } from "./bite-radar";
import type { HubSpeciesEntry, HubSpot } from "./hub-data";

export default function SpotLeaderboard({
  rows,
  speciesName,
  cityName,
}: {
  rows: Array<{ spot: HubSpot; entry: HubSpeciesEntry; speciesName: string }>;
  /** Null when the reader is on "All" and each card ranks on its own best
   *  species. The heading has to say which, or a score is a number with no
   *  units. */
  speciesName: string | null;
  cityName: string;
}) {
  if (!rows.length) return null;

  return (
    <section aria-labelledby="ranked" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="ranked" className="text-[17px] font-semibold text-rc-ink">
          {speciesName
            ? `Best ${speciesName} water today`
            : `Best water around ${cityName} today`}
        </h2>
        <span className="font-rc-mono text-[10px] text-rc-ink-mute">
          Scores update through the day
        </span>
      </div>

      <ul className="grid gap-2.5 sm:grid-cols-2">
        {rows.map(({ spot, entry, speciesName: driver }) => {
          const tier = tierFor(entry.peak);
          const win = windowLabel(entry.window);
          return (
            <li key={spot.id}>
              <Link
                href={`/explore/spot/${spot.slug}`}
                className="group flex items-center gap-3 rounded-lg border border-rc-rule bg-rc-panel p-3.5 hover:border-rc-brand transition-colors"
              >
                <span
                  className={`shrink-0 rounded-md px-2.5 py-1.5 font-rc-mono text-[17px] font-semibold tabular-nums ${TIER_PILL[tier]}`}
                >
                  {entry.peak}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-rc-ink group-hover:text-rc-brand transition-colors truncate">
                    {spot.name}
                  </span>
                  <span className="block font-rc-mono text-[11px] text-rc-ink-mute mt-0.5">
                    {/* "Good", not "peak". The span is every hour within 5
                        points of this spot's best, which on a plateau species
                        is most of the day — calling eleven hours a peak would
                        be a promise the number cannot keep. */}
                    {win ? `Good ${win}` : "Best hour outside daylight"}
                    {/* On "All" every card ranks on its OWN best species, so
                        without this a score is a number for an unnamed fish
                        and two cards side by side are not comparable. Under a
                        chip the heading already says which, so it is not
                        repeated six times. */}
                    {!speciesName && driver ? ` · ${driver}` : ""}
                  </span>
                </span>
                <span
                  aria-hidden
                  className="shrink-0 text-rc-ink-mute group-hover:text-rc-brand transition-colors"
                >
                  →
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

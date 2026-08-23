// The runners-up, under the spotlight.
//
// Four cards, not six, and the first one is gone because it is the spotlight
// above. Every card now carries something the others do not — a superlative
// badge, its seabed, its own species when the reader is on "All" — because a
// column of identical white boxes reading 84, 84, 83, 83 is a spread of one
// point rendered as four equal choices.
//
// Still no target depth on any of them: `depth_profiles` is 7 rows
// product-wide and none of them are in Washington.

"use client";

import Link from "next/link";
import { TIER_PILL, tierFor } from "../../../../explore/lib/explore-data";
import { windowLabel } from "./bite-radar";
import { bottomLabel, type HubBadge, type HubSpeciesEntry, type HubSpot } from "./hub-data";

export default function SpotLeaderboard({
  rows,
  badges,
  speciesName,
  cityName,
}: {
  rows: Array<{ spot: HubSpot; entry: HubSpeciesEntry; speciesName: string }>;
  badges: Map<string, HubBadge>;
  /** Null when the reader is on "All" and each card ranks on its own best
   *  species. The heading has to say which, or a score has no units. */
  speciesName: string | null;
  cityName: string;
}) {
  if (!rows.length) return null;

  return (
    <section aria-labelledby="ranked" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="ranked" className="text-[17px] font-semibold text-rc-ink">
          {speciesName
            ? `Next best ${speciesName} water`
            : `Next best water around ${cityName}`}
        </h2>
        <span className="text-[11px] text-rc-ink-soft">
          Scores update through the day
        </span>
      </div>

      <ul className="grid gap-2.5 sm:grid-cols-2">
        {rows.map(({ spot, entry, speciesName: driver }) => {
          const tier = tierFor(entry.peak);
          const win = windowLabel(entry.window);
          const badge = badges.get(spot.id);
          const bottom = bottomLabel(spot.bottom);

          return (
            <li key={spot.id}>
              <Link
                href={`/explore/spot/${spot.slug}`}
                className="group flex h-full flex-col rounded-xl border border-rc-rule bg-rc-panel p-3.5 hover:border-rc-brand hover:shadow-rc-panel transition-all"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`shrink-0 rounded-lg px-2.5 py-1.5 font-rc-mono text-[17px] font-bold tabular-nums ${TIER_PILL[tier]}`}
                  >
                    {entry.peak}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-rc-ink group-hover:text-rc-brand transition-colors">
                      {spot.name}
                    </span>
                    <span className="block text-[12px] font-medium text-rc-ink-soft mt-0.5">
                      {/* "Good", not "peak". The span is every hour within 5
                          points of this spot's best, which on a plateau
                          species is most of the day — calling eleven hours a
                          peak would be a promise the number cannot keep. */}
                      {win ? `Good ${win}` : "Best hour outside daylight"}
                    </span>
                  </span>
                </div>

                {/* Collapsed when there is nothing to put in it. Seattle
                    carries `bottom_type` on 8 of its 16 spots and badges are
                    superlatives, so a card can legitimately earn neither —
                    and an empty row still reserved its margin, leaving a
                    ragged column of cards at two different heights. */}
                {(badge || (!speciesName && driver) || bottom) && (
                <div className="flex flex-wrap items-center gap-1.5 mt-3">
                  {badge && (
                    <span
                      className={
                        badge.tone === "accent"
                          ? "rounded-full bg-rc-emerald-deep px-2 py-0.5 font-rc-mono text-[10px] text-white"
                          : "rounded-full bg-rc-surface px-2 py-0.5 font-rc-mono text-[10px] text-rc-ink-soft"
                      }
                    >
                      {badge.label}
                    </span>
                  )}
                  {/* On "All" every card ranks on its OWN best species, so
                      without this a score is a number for an unnamed fish and
                      two cards side by side are not comparable. Under a chip
                      the heading already says which. */}
                  {!speciesName && driver && (
                    <span className="rounded-full border border-rc-rule px-2 py-0.5 font-rc-mono text-[10px] text-rc-ink-soft">
                      {driver}
                    </span>
                  )}
                  {bottom && (
                    <span className="text-[11px] text-rc-ink-soft">{bottom}</span>
                  )}
                </div>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

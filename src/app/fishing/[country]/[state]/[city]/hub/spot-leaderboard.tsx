// The runners-up, under the spotlight.
//
// Four cards, not six, and the first one is gone because it is the spotlight
// above. Every card carries something the others do not — a superlative
// badge, its track record, its seabed, its own species when the reader is on
// "All" — because a column of identical white boxes reading 82, 82, 82, 82 is
// a spread of nothing rendered as four equal choices.
//
// Still no target depth on any of them: `depth_profiles` is 7 rows
// product-wide and none of them are in Washington.

"use client";

import Link from "next/link";
import { TIER_PILL, tierFor } from "@/app/explore/lib/explore-data";
import { windowLabel } from "./bite-radar";
import { bottomLabel, type HubBadge, type HubSpeciesEntry, type HubSpot } from "./hub-data";
import { SectionHeading } from "../species/[species]/guide-sections";
import { CARD, Chip, PAD, TYPE } from "./ui";
import { spotHref } from "@/lib/paths";
import { trackEvent } from "@/lib/analytics";

export default function SpotLeaderboard({
  rows,
  badges,
  speciesName,
  cityName,
  citySlug,
}: {
  rows: Array<{ spot: HubSpot; entry: HubSpeciesEntry; speciesName: string }>;
  badges: Map<string, HubBadge>;
  /** Null when the reader is on "All" and each card ranks on its own best
   *  species. The heading has to say which, or a score has no units. */
  speciesName: string | null;
  cityName: string;
  citySlug: string;
}) {
  if (!rows.length) return null;

  return (
    <section aria-labelledby="ranked" className="space-y-3">
      {/* The page's one heading treatment, shared with the regulations
          section and everything below the fold. This was a bare h2 three
          steps smaller, which put two different section headings inside one
          block and made the shorter one read as a subheading of the other. */}
      <SectionHeading id="ranked">
        {speciesName
          ? `Next best ${speciesName} water`
          : `Next best water around ${cityName}`}
      </SectionHeading>
      <p className={`${TYPE.meta} text-rc-ink-soft`}>
        Scores update through the day
      </p>

      <ul className="grid gap-2.5 sm:grid-cols-2">
        {rows.map(({ spot, entry, speciesName: driver }, i) => {
          const tier = tierFor(entry.peak);
          const win = windowLabel(entry.window);
          const badge = badges.get(spot.id);
          const bottom = bottomLabel(spot.bottom);
          // Every attribute is a chip of the same shape. The row used to mix
          // a brand-soft sans chip, an emerald mono chip, a bordered mono
          // chip and a bare string, which reads as four unrelated things
          // rather than one row of attributes about one place.
          const chips = [
            spot.trackRecord === "popular" && (
              <Chip key="track" tone="brand">
                Popular spot
              </Chip>
            ),
            badge && (
              <Chip key="badge" tone={badge.tone === "accent" ? "accent" : "neutral"}>
                {badge.label}
              </Chip>
            ),
            // On "All" every card ranks on its OWN best species, so without
            // this a score is a number for an unnamed fish and two cards side
            // by side are not comparable. Under a chip the heading says which.
            !speciesName && driver && (
              <Chip key="driver">{driver}</Chip>
            ),
            bottom && <Chip key="bottom">{bottom}</Chip>,
          ].filter(Boolean);

          return (
            <li key={spot.id}>
              <Link
                href={spotHref(spot)}
                className={`group flex h-full flex-col ${CARD} ${PAD} hover:border-rc-brand hover:shadow-rc-panel transition-all`}
                onClick={() =>
                  trackEvent("Top Spot Clicked", {
                    slug: spot.slug,
                    rank: i + 1,
                    city: cityName,
                    surface: "leaderboard",
                  })
                }
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`shrink-0 rounded-lg px-2.5 py-1.5 font-rc-mono text-[17px] font-bold tabular-nums ${TIER_PILL[tier]}`}
                  >
                    {entry.peak}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block ${TYPE.item} text-rc-ink group-hover:text-rc-brand transition-colors`}
                    >
                      {spot.name}
                    </span>
                    <span className={`block ${TYPE.meta} text-rc-ink-soft mt-0.5`}>
                      {/* "Good", not "peak". The span is every hour within 5
                          points of this spot's best, which on a plateau
                          species is most of the day — calling eleven hours a
                          peak would be a promise the number cannot keep. */}
                      {win ? `Good ${win}` : "Best hour outside daylight"}
                    </span>
                  </span>
                </div>

                {/* Collapsed when empty. Seattle carries `bottom_type` on 8 of
                    16 spots and badges are superlatives, so a card can
                    legitimately earn neither — and an empty row still
                    reserved its margin, leaving a ragged column. */}
                {chips.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-3">
                    {chips}
                  </div>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      {/*
        Out to the map, framed on this city.

        `?loc=<citySlug>` is Explore's own city param — `useExploreState`
        reads it straight off the query — so the canvas opens on this water
        rather than on the reader's geo, which is what it falls back to. That
        fallback is the whole reason this carries the slug: a bare /explore
        link from a Victoria ad can land a Seattle reader in Seattle.

        The leaderboard is deliberately short, so this is where somebody who
        wants the other marks goes. The pool filter keeps unreported spots out
        of the list above but the map carries the full roster, which makes
        this the honest counterweight to that filter rather than just a link.
      */}
      <Link
        href={`/explore?loc=${encodeURIComponent(citySlug)}`}
        className={`flex items-center justify-between gap-3 ${CARD} ${PAD} hover:border-rc-brand transition-colors`}
      >
        <span>
          <span className={`block ${TYPE.item} text-rc-ink`}>
            See every spot around {cityName}
          </span>
          <span className={`block ${TYPE.meta} text-rc-ink-soft mt-0.5`}>
            Open the map on {cityName} water
          </span>
        </span>
        <span aria-hidden className="shrink-0 text-rc-brand">
          &rarr;
        </span>
      </Link>
    </section>
  );
}

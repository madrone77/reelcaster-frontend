"use client";

/**
 * The home city's water, busiest first.
 *
 * Ranked on report volume, not on the forecast. Scores say how water should
 * fish and reports say where people actually went, and only one of those can
 * lead: post-rescale a healthy day peaks 88 to 92 across a whole city, so the
 * top of a score-sorted list is a three-way tie a reader cannot tell apart.
 * The city page reached the same conclusion and stopped ranking on the
 * forecast. Today's score still shows on every row — it is a fact about each
 * mark rather than the reason the mark is in that position.
 *
 * ⚠ The scores therefore do NOT descend. Same caveat the city page carries: a
 * list that looks sorted and is not is worse than one that never looked
 * sorted, which is what the subline is for.
 *
 * There was briefly a second list beside this one, good water with no reports
 * on it. It went because the two were too alike to be worth the room: the
 * scores either side were 88, 88, 87 against 88, 88, 88, and two lists that
 * differ by a point read as one list printed twice.
 *
 * The rows are `SpotRow` from ./around-you, unchanged, so the lock treatment
 * on report counts is the same one the rest of the dashboard uses and cannot
 * drift out of step with it.
 */

import Link from "next/link";
import dynamic from "next/dynamic";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import type { FreshCatchesResponse } from "@/app/explore/lib/fresh-catch-types";
import type { MapSpotsPayload } from "@/lib/bluecaster";
import {
  SpotRow,
  activityRank,
  cityRowsFrom,
  type AroundYouSpot,
} from "./around-you";

// Loaded on the tap that opens it, for the same reason AroundYou defers it: a
// static import drags the plan matrix, the pricing tables and the Stripe
// checkout client into the dashboard's first chunk.
const ProTrialModal = dynamic(
  () => import("@/app/components/paywall/pro-trial-modal"),
  { ssr: false },
);

/** How many marks the list names before it defers to the city page. */
const SHOWN = 5;

export interface CityWaterLists {
  /** Where anglers actually are, busiest first. */
  active: AroundYouSpot[];
  total: number;
}

/**
 * Rank the city's spots by activity.
 *
 * `activityRank` puts spots with reports first, then orders by count, then
 * falls back to score. That fallback is why this does NOT filter on
 * `hasReports`: in a city with no reports at all the list should still name
 * the best water rather than render empty, and the subline is honest either
 * way.
 *
 * A free viewer has no counts — those are paid — so for them this degrades to
 * "spots with reports first, then by score", the same shape of answer at the
 * resolution they are entitled to. `hasReports` itself rides on the map
 * payload and is free-visible, so the ordering survives the paywall.
 *
 * Exported and pure so the page can memoize it, and so "is there anything to
 * show" is answered before any of this renders.
 */
export function cityWaterFrom(
  payload: MapSpotsPayload | null,
  reports: FreshCatchesResponse | null,
  citySlug: string | null,
  ownSlugs: Set<string>,
  homeSpotSlug: string | null,
): CityWaterLists | null {
  if (!payload || !citySlug) return null;
  const rows = cityRowsFrom(payload, reports, citySlug, ownSlugs, homeSpotSlug);
  if (rows.length === 0) return null;

  const active = [...rows].sort(activityRank).slice(0, SHOWN);
  return { active, total: rows.length };
}

function List({
  title,
  note,
  spots,
  locked,
  onUnlock,
}: {
  title: string;
  note: string;
  spots: AroundYouSpot[];
  locked: boolean;
  onUnlock: () => void;
}) {
  if (spots.length === 0) return null;
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-rc-ink-mute">
        {title}
      </p>
      <p className="mt-0.5 font-rc-mono text-[11px] text-rc-ink-mute">{note}</p>
      <div className="mt-2 divide-y divide-rc-rule">
        {spots.map((s) => (
          <SpotRow key={s.slug} spot={s} locked={locked} onUnlock={onUnlock} />
        ))}
      </div>
    </div>
  );
}

export default function CityWater({
  cityName,
  cityPath,
  lists,
  unlocked,
}: {
  cityName: string;
  cityPath: string | null;
  /** undefined = still reading, null = settled with nothing to rank. */
  lists: CityWaterLists | null | undefined;
  unlocked: boolean;
}) {
  // Owned here rather than passed in, matching AroundYou: the page has no use
  // for this state and threading it through only widens the component's API.
  // Declared before the early returns so the hook order never changes.
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  if (lists === undefined) {
    return <div className="h-[220px] animate-pulse rounded bg-rc-panel" />;
  }
  if (!lists) return null;

  return (
    <section className="rounded border border-rc-rule bg-rc-panel p-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="rc-title-lg text-xl">Water in {cityName}</h2>
        <span className="font-rc-mono text-[11px] text-rc-ink-mute">
          {lists.total} scored
        </span>
        {cityPath && (
          <Link
            href={cityPath}
            className="ml-auto inline-flex items-center gap-1 text-[13px] font-medium text-rc-brand hover:underline"
          >
            All spots
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        )}
      </div>

      <div className="mt-4">
        <List
          title="Most active"
          // Says out loud that the scores do not descend, so a reader does not
          // read the order as a ranking by number.
          note="by recent reports, not by score"
          spots={lists.active}
          locked={!unlocked}
          onUnlock={() => setUpgradeOpen(true)}
        />
      </div>

      {/* One instance for the section, not one per row. `from` is its own
          string so signup attribution can tell this wall apart from the other
          report nags on the page — see lib/attribution. */}
      <ProTrialModal
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        feature="catch-reports"
        from="dashboard-city-water"
        placeName={cityName}
      />
    </section>
  );
}

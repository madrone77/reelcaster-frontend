"use client";

/**
 * The home city's water, cut two ways: what is scoring and what is busy.
 *
 * Two lists rather than one because the two questions have different answers
 * and the difference is the useful part. Reports say where anglers actually
 * are; scores say how the water should fish. On the account this was built
 * against they disagree sharply — by activity Victoria opens with Constance
 * Bank, 25 reports and a strong verdict at a score of 81, which a score sort
 * never surfaces at all.
 *
 * Showing only the activity list would bury a genuinely good day on water
 * nobody happens to be posting from. So both, short, side by side, with the
 * second one carrying only names the first did not.
 *
 * The rows are `SpotRow` from ./around-you, unchanged, so the lock treatment
 * on report counts is the same one the rest of the dashboard uses and cannot
 * drift out of step with it.
 *
 * The two lists are DISJOINT — see `cityWaterFrom`. Ranked two ways over the
 * same set they came out with the same names on top of both, which read as one
 * list printed twice.
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

/** How many marks each list names before it defers to the city page. */
const SHOWN = 3;

export interface CityWaterLists {
  /** Where anglers actually are, busiest first. */
  active: AroundYouSpot[];
  /** Good water that nobody is reporting from. Never repeats `active`. */
  quiet: AroundYouSpot[];
  total: number;
}

/**
 * Rank the city's spots into two lists that do not overlap.
 *
 * The activity list leads because it is the stronger signal: scores say how
 * water should fish, reports say where people went. And because a score sort
 * cannot lead on its own any more — post-rescale a healthy day peaks 88 to 92
 * across a whole city, so the top of a score-sorted list is a three-way tie at
 * 88 that a reader cannot tell apart. The city page learned this the same way
 * and stopped ranking on the forecast.
 *
 * The second list is then the thing the first one cannot say: water that is
 * scoring well with nobody on it. Built by EXCLUDING everything already shown
 * rather than by sorting the same set differently, because ranked two ways the
 * same spots came out on top of both and the pair read as one list printed
 * twice.
 *
 * A free viewer has no counts, but `hasReports` rides on the map payload and is
 * free-visible, so the split itself survives the paywall at full resolution —
 * only the numbers inside a row are withheld.
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

  const active = rows
    .filter((r) => r.hasReports)
    .sort(activityRank)
    .slice(0, SHOWN);

  const shown = new Set(active.map((r) => r.slug));
  const quiet = rows
    .filter((r) => !shown.has(r.slug))
    .sort((a, b) => b.score - a.score)
    .slice(0, SHOWN);

  return { active, quiet, total: rows.length };
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
    <div className="min-w-0 flex-1">
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

      <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:gap-8">
        <List
          title="Most active"
          note="by recent reports"
          spots={lists.active}
          locked={!unlocked}
          onUnlock={() => setUpgradeOpen(true)}
        />
        <List
          title="Quiet but scoring"
          note="no reports in the window"
          spots={lists.quiet}
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
      />
    </section>
  );
}

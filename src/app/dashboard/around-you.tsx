"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useState } from "react";
import { ChevronRight, Home, Lock, Star } from "lucide-react";
import { TIER_PILL, tierFor } from "@/app/explore/lib/explore-data";
import {
  freshVerdictStyle,
  reportAge,
  type FreshCatchesResponse,
  type FreshCatchVerdict,
} from "@/app/explore/lib/fresh-catch-types";
import type { MapSpotsPayload } from "@/lib/bluecaster";

// Loaded on the tap that opens it, for the reason /explore's `UpgradeDialog`
// does the same: a static import drags the plan matrix, the pricing tables and
// the Stripe checkout client into the dashboard's first chunk.
const ProTrialModal = dynamic(
  () => import("@/app/components/paywall/pro-trial-modal"),
  { ssr: false },
);

/** How many spots to list per city before deferring to Explore. */
const PER_CITY = 3;

/**
 * "sooke-bc" → "Sooke". The map payload carries `city_slug` but no city name,
 * and the only endpoint that resolves names is a second round trip for a label.
 * Every city slug in the covered extent is `<name>-<province>` (checked against
 * all nine: bellingham-wa … victoria-bc), so the province code comes off the
 * end and the rest title-cases. A slug that ever breaks that shape degrades to
 * a readable title-cased string rather than to nothing.
 */
function cityName(slug: string): string {
  return slug
    .replace(/-(bc|wa|or|ca|ak)$/i, "")
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export type AroundYouSpot = {
  slug: string;
  name: string;
  score: number;
  species: string | null;
  isHome: boolean;
  isSaved: boolean;
  /** Reports in the window. `null` for a free viewer — the count is paid. */
  reportCount: number | null;
  /** Whether ANY report exists. Free viewers are allowed this much. */
  hasReports: boolean;
  verdict: FreshCatchVerdict | null;
  latestDate: string | null;
};

/**
 * Rank key: activity first, score as the fallback.
 *
 * Scores say how the water should fish; reports say where anglers actually
 * are. On the account this was built against the two disagree sharply — Sooke
 * ranked by score leads with Jordan River Mouth (87) and Port Renfrew (86),
 * neither of which has a single report, while the city's own daily report
 * names Beechey Head (83, 7 reports) as "the busiest and most productive
 * water". Victoria by score is three spots tied at 90; by activity it opens
 * with Constance Bank, 25 reports and a strong verdict at a score of 81, which
 * a score sort never surfaces at all.
 *
 * A free viewer has no counts — those are paid — so for them this degrades to
 * "spots with reports first, then by score", which is the same shape of answer
 * at the resolution they are entitled to.
 */
function activityRank(a: AroundYouSpot, b: AroundYouSpot): number {
  if (a.hasReports !== b.hasReports) return a.hasReports ? -1 : 1;
  const byCount = (b.reportCount ?? 0) - (a.reportCount ?? 0);
  if (byCount !== 0) return byCount;
  return b.score - a.score;
}

export type AroundYouCity = {
  slug: string;
  name: string;
  total: number;
  spots: AroundYouSpot[];
};

/**
 * Rank the cities the angler already fishes, from the map payload the
 * dashboard has fetched anyway.
 *
 * A city qualifies by having one of their spots in it — home, saved, or
 * custom — rather than only the home spot's city. Anglers here fish across a
 * boundary: on the account this was built against, the pinned home spot is in
 * Sooke while two of four saved spots are in Victoria, and Victoria was
 * scoring higher. A strict home-city block would have hidden the better water.
 */
export function aroundYouFrom(
  payload: MapSpotsPayload | null,
  reports: FreshCatchesResponse | null,
  ownSlugs: string[],
  homeSlug: string | null,
): AroundYouCity[] | null {
  if (!payload) return null;
  const own = new Set(ownSlugs);

  // The cities those spots sit in. A custom spot the payload doesn't carry
  // simply contributes no city, which is correct — we know of no water there.
  const citySlugs = new Set<string>();
  for (const e of payload.spots) {
    if (own.has(e.slug) && e.city_slug) citySlugs.add(e.city_slug);
  }
  if (citySlugs.size === 0) return [];

  const species = payload.species ?? {};
  const cities: AroundYouCity[] = [];

  for (const city of citySlugs) {
    const scored: AroundYouSpot[] = [];
    for (const e of payload.spots) {
      if (e.city_slug !== city) continue;
      let best = 0;
      let bestId: string | null = null;
      for (const [id, strip] of Object.entries(e.scores ?? {})) {
        const peak = (strip as { peak?: number })?.peak;
        if (typeof peak === "number" && peak > best) {
          best = peak;
          bestId = id;
        }
      }
      // An unscored spot is not a recommendation — leave it to Explore.
      if (best <= 0) continue;
      // `has_reports` rides on the map payload and is free-visible; the count
      // and verdict come from the gated read and are absent when locked. Never
      // infer one from the other — a locked row carries a key with no numbers,
      // which is exactly how the paywall is meant to read.
      const f = reports?.spots[e.id];
      const locked = f?.locked !== false;
      scored.push({
        slug: e.slug,
        name: e.name,
        score: Math.round(best * 100),
        species: (bestId && species[bestId]?.name) || null,
        isHome: e.slug === homeSlug,
        isSaved: own.has(e.slug),
        reportCount: locked ? null : (f?.count ?? null),
        hasReports: e.has_reports === true || !!f,
        verdict: locked ? null : (f?.verdict ?? null),
        latestDate: locked ? null : (f?.latestDate ?? null),
      });
    }
    if (scored.length === 0) continue;
    scored.sort(activityRank);
    cities.push({
      slug: city,
      name: cityName(city),
      total: scored.length,
      spots: scored.slice(0, PER_CITY),
    });
  }

  // Busiest city first, by the same key the rows use — so the city leading is
  // the one anglers are actually on, not merely the one that models best.
  cities.sort((a, b) => activityRank(a.spots[0], b.spots[0]));
  return cities;
}

function SpotRow({
  spot,
  locked,
  onUnlock,
}: {
  spot: AroundYouSpot;
  locked: boolean;
  onUnlock: () => void;
}) {
  const tier = tierFor(spot.score);
  const rowClass =
    "flex w-full items-center gap-3 border-t border-rc-rule px-4 py-2.5 text-left transition-colors first:border-t-0 hover:bg-rc-surface";

  const body = (
    <>
      {/* The score stays legible. It is on Explore for anyone, and it is what
          makes the locked row a tease rather than a blank: there IS busy water
          at 81 here, and the paid part is which water. */}
      <span
        className={`shrink-0 rounded px-2 py-0.5 font-rc-mono text-[12px] font-bold tabular-nums ${TIER_PILL[tier]}`}
      >
        {spot.score}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden={locked || undefined}
            className={`truncate text-[14px] font-medium text-rc-ink ${
              locked ? "select-none blur-[5px]" : ""
            }`}
          >
            {spot.name}
          </span>
          {locked ? (
            <Lock className="h-3 w-3 shrink-0 text-rc-brand" />
          ) : /* Says why a spot the angler already has is in a discovery list,
                so it doesn't read as the dashboard forgetting they own it. */
          spot.isHome ? (
            <Home className="h-3 w-3 shrink-0 text-rc-brand" />
          ) : spot.isSaved ? (
            <Star className="h-3 w-3 shrink-0 fill-rc-brand text-rc-brand" />
          ) : null}
        </span>
        {/* Activity leads the sub-line, because activity is what ordered the
            list. A row that sorted above its neighbours has to say why. */}
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          {spot.reportCount != null && spot.reportCount > 0 ? (
            <>
              {spot.verdict && (
                <span
                  className={`inline-flex shrink-0 items-center rounded px-1.5 py-0.5 font-rc-mono text-[9px] uppercase tracking-[0.06em] ${
                    freshVerdictStyle(spot.verdict).cls
                  }`}
                >
                  {freshVerdictStyle(spot.verdict).label}
                </span>
              )}
              <span className="font-rc-mono text-[11px] text-rc-ink-soft">
                {spot.reportCount} report{spot.reportCount === 1 ? "" : "s"}
                {spot.latestDate ? ` · ${reportAge(spot.latestDate)}` : ""}
              </span>
            </>
          ) : spot.hasReports ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded bg-rc-surface px-1.5 py-0.5 font-rc-mono text-[9px] uppercase tracking-[0.06em] text-rc-ink-mute">
              <Lock className="h-2.5 w-2.5" />
              {locked ? "Tap to unlock" : "Reports"}
            </span>
          ) : (
            spot.species && (
              <span className="truncate font-rc-mono text-[11px] text-rc-ink-mute">
                {spot.species}
              </span>
            )
          )}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-rc-ink-mute" />
    </>
  );

  // A locked row must not link to the spot page — that page names the place,
  // so linking there would hand over the very thing the blur is withholding.
  if (locked) {
    return (
      <button
        type="button"
        onClick={onUnlock}
        aria-label={`Locked spot scoring ${spot.score}, unlock with Pro`}
        className={rowClass}
      >
        {body}
      </button>
    );
  }

  return (
    <Link href={`/explore/spot/${spot.slug}`} className={rowClass}>
      {body}
    </Link>
  );
}

/**
 * The best water in the cities the angler already fishes — including spots
 * they have not saved, which is the whole point. Everything above this on the
 * dashboard can only show them what they already told us about; on the account
 * this was built against, 14 of Sooke's 17 scored spots appeared nowhere else
 * on the page, two of them out-scoring the pinned home spot.
 *
 * Ranked by activity — scraped reports in the window — with the score as the
 * fallback, because a high score is a prediction and a pile of reports is
 * evidence. See `activityRank`.
 *
 * Derived entirely from the map payload and the fresh-catch read the dashboard
 * already fetches, so this costs no request.
 */
export default function AroundYou({
  cities,
  unlocked,
}: {
  cities: AroundYouCity[] | null;
  /**
   * The server's own verdict on this viewer, straight off the gated
   * fresh-catch read — not a client tier hook. It is already fetched, it is
   * authoritative, and it cannot disagree with the counts rendered beside it.
   * Defaults open: if that read failed we have no counts to show anyway, and
   * blurring a paying angler's dashboard because a request timed out is a
   * worse failure than showing public spot names to a free one.
   */
  unlocked: boolean;
}) {
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  if (cities === null) {
    return (
      <div className="h-40 animate-pulse rounded border border-rc-rule bg-rc-surface" />
    );
  }
  if (cities.length === 0) return null;

  // Spots the angler already has are never blurred. They pinned the home spot
  // and saved the rest — their names are not ours to sell back, and a blurred
  // "your home spot" row reads as a bug, not a paywall.
  const isLocked = (s: AroundYouSpot) => !unlocked && !s.isHome && !s.isSaved;

  return (
    <section>
      <div className="mb-3 flex items-baseline gap-3">
        <h2 className="text-lg font-bold text-rc-ink">Around you</h2>
        <span className="font-rc-mono text-[11px] text-rc-ink-mute">
          busiest water where you fish
        </span>
      </div>

      <div className="space-y-4">
        {cities.map((city) => (
          <div
            key={city.slug}
            className="overflow-hidden rounded border border-rc-rule bg-rc-panel"
          >
            <div className="flex items-center justify-between gap-2 px-4 pb-2.5 pt-3">
              <span className="font-rc-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rc-brand">
                {city.name}
              </span>
              <span className="font-rc-mono text-[10px] text-rc-ink-mute">
                {city.total} scored
              </span>
            </div>
            <div className="border-t border-rc-rule">
              {city.spots.map((s) => (
                <SpotRow
                  key={s.slug}
                  spot={s}
                  locked={isLocked(s)}
                  onUnlock={() => setUpgradeOpen(true)}
                />
              ))}
            </div>
            {city.total > city.spots.length && (
              <Link
                href={`/explore?loc=${city.slug}`}
                className="flex items-center justify-between border-t border-rc-rule px-4 py-2.5 text-[14px] font-semibold text-rc-brand transition-colors hover:bg-rc-surface"
              >
                Click here to see all {city.total} spots in {city.name}
                <ChevronRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* One instance for the whole section, not one per row. `from` is its own
          string so signup attribution can tell this wall apart from the rail's
          reports nag — see lib/attribution. */}
      <ProTrialModal
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        feature="catch-reports"
        from="dashboard-around-you"
      />
    </section>
  );
}

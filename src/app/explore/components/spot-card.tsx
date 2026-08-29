"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useState } from "react";
import { Wind, Waves, Navigation, Lock, Globe } from "lucide-react";
import { TIER_PILL, tierFor, type RailSpot } from "../lib/explore-data";
import { useFavorite } from "../lib/use-favorite";
import { useSubscription } from "@/hooks/use-subscription";
import SpotTrend from "./spot-trend";
import SpotDayStrip, { SpotDayStripSkeleton, type SpotDay } from "./spot-day-strip";
import { FreshCatchBadge } from "./fresh-catch-reports";
import type { RailFreshCatch } from "../lib/fresh-catch-types";

const ProTrialModal = dynamic(
  () => import("@/app/components/paywall/pro-trial-modal"),
  { ssr: false },
);


/**
 * Rail spot card. No hover-only actions: header + score badge, a plain-English
 * conclusion line, a WIND/SEA/TIDE meta row, the 24h sparkline, an optional
 * 14-day strip, and a persistent footer (FULL REPORT link + favorite star).
 * The whole body above the footer opens the location report; the strip and the
 * footer controls act on their own.
 */
export default function SpotCard({
  spot,
  onSelect,
  showVisibility = false,
  homeBadge = false,
  onFavoriteChange,
  fresh,
  showDayStrip = false,
  days14,
  dayStripDensity = "labelled",
}: {
  spot: RailSpot;
  /** Accepted for call-site compatibility; the compact trend needs no tz. */
  tz?: string;
  /** Opens the in-page drawer. Omit outside Explore — the body link then
   *  navigates to the spot report on its own. */
  onSelect?: () => void;
  /** Mark the spot private/public in the header. Explore says that with the
   *  map pin; surfaces without a map (the dashboard) say it on the card. */
  showVisibility?: boolean;
  /** Mark this as the angler's pinned home spot (dashboard only). */
  homeBadge?: boolean;
  /** Fires after the star toggles, so a list keyed on favourites can drop or
   *  add the card without a reload. */
  onFavoriteChange?: (fav: boolean) => void;
  /** Scraped catch reports for this spot, if any land in the window. Already
   *  Pro-gated by the route: a free viewer's entry is `{ locked: true }`.
   *  Optional — a card with `spot.hasReports` shows the locked badge without it. */
  fresh?: RailFreshCatch;
  /** Give the card a 14-day strip along its bottom edge. Off by default, so
   *  every surface that renders this card today is untouched. */
  showDayStrip?: boolean;
  /** This spot's next 14 days. `undefined` while the bulk read is in flight —
   *  the strip holds its space with a skeleton so the card doesn't jump when
   *  the read lands; `null` when the spot has no outlook, which drops the row.
   *  Already plan-gated by the route: locked days arrive scoreless. */
  days14?: SpotDay[] | null;
  /** `labelled` needs roughly 560px of card. Narrow rails pass `compact`. */
  dayStripDensity?: "labelled" | "compact";
}) {
  const [fav, toggleFav] = useFavorite(spot.slug);
  const { isPaid } = useSubscription();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [reportsUpgradeOpen, setReportsUpgradeOpen] = useState(false);
  const [forecastUpgradeOpen, setForecastUpgradeOpen] = useState(false);
  // Drives the one-shot "pop" animation when a spot is favorited (not on load).
  const [popping, setPopping] = useState(false);

  // One tier function across both surfaces (Explore + dashboard) so a spot
  // scores identically wherever the card renders.
  const bt = tierFor(spot.score);

  const species = spot.driverSpecies?.replace(/^Pacific\s+/i, "");
  // Species alone. The line used to carry "· best 6 AM-8 PM" as well, which on
  // a settled day reads 6 AM-8 PM at nearly every spot in view — a whole column
  // of cards claiming the same fourteen hours, which is not a recommendation.
  // The peak time is still on the day tiles and on the spot page, where it sits
  // beside the hours that produced it.
  const conclusion = species ?? "No live score yet";

  const reportHref = `/explore/spot/${spot.slug}`;

  // Pro-only: which spots carry catch reports is no longer shown to free or
  // anonymous viewers at all, matching the map, where the "Hot" tag and the
  // emerald collar are both gated the same way.
  //
  // Two consequences worth knowing. The badge was the upsell entry point for
  // reports — its `onUnlock` opens the Pro modal — so that conversion path is
  // gone for exactly the viewers it was selling to. And the locked badge used
  // to render server-side off `spot.hasReports`, which is what put it in the
  // first paint; `isPaid` only resolves client-side, so for a Pro viewer it now
  // arrives a beat later. Both follow from hiding the fact rather than the
  // numbers, and neither is recoverable without un-gating it again.
  //
  // The two sources otherwise behave as before: `spot.hasReports` rides in on
  // the server-rendered map payload and shows the lock, then `fresh` lands from
  // the Pro-gated intel fetch and replaces it with the count.
  const reports: RailFreshCatch | undefined = isPaid
    ? (fresh ?? (spot.hasReports ? { locked: true } : undefined))
    : undefined;

  // Which plan a locked day is selling. A signed-out visitor's strip stops at
  // day 2, so the first lock is inside the week a free account already gets —
  // pitch the account. A free account's strip stops at day 7, so its locks are
  // Pro days. Mirrors the forecast strip's lockTier split.
  const firstLockedDay = days14?.findIndex((d) => d.locked) ?? -1;
  const forecastNag =
    firstLockedDay >= 0 && firstLockedDay < 7 ? "forecast-week" : "forecast-14d";

  const onStar = async (e: React.MouseEvent) => {
    e.stopPropagation();
    // Both refusals open the same modal: it sells the trial to a free account
    // at the cap and offers registration to an anonymous one, off the tier it
    // detects itself. Never a silent no-op either way.
    const res = await toggleFav({ isPaid, spotId: spot.id });
    if (res === "signed-out" || res === "at-cap") {
      setUpgradeOpen(true);
      return;
    }
    if (res === "error") return;
    // Pop only when saving (the on-transition), not when un-saving. Fires on
    // the confirmed write rather than the tap — the star itself already flipped
    // optimistically, so this stays in step with what actually persisted.
    if (res === "saved") {
      setPopping(true);
      window.setTimeout(() => setPopping(false), 600);
    }
    onFavoriteChange?.(res === "saved");
  };

  return (
    <div className="bg-rc-panel border border-rc-rule rounded overflow-hidden">
      {/* Body — the primary target; clicking it opens the location report.
          Hover/focus feedback lives here (a surface shift), not on the whole
          card, so the footer controls read as separate.

          This is a real <a href>, not a role="button" div. As a div it was
          invisible to crawlers: the city page carried 30+ of these cards and
          emitted zero links to the spot pages beneath it, so nothing followed
          city → spot and no ranking signal flowed down. `onSelect` still runs
          — preventDefault keeps the in-page drawer behaviour on desktop — but
          middle-click, ⌘-click, and "open in new tab" now work too, and the
          destination is in the markup either way. */}
      <Link
        href={reportHref}
        onClick={(e) => {
          // Let the browser handle modified clicks (new tab/window) natively,
          // and plain clicks too when there's no drawer to open.
          if (
            !onSelect ||
            e.metaKey ||
            e.ctrlKey ||
            e.shiftKey ||
            e.altKey ||
            e.button !== 0
          ) {
            return;
          }
          e.preventDefault();
          onSelect();
        }}
        className="block w-full text-left cursor-pointer transition-colors hover:bg-rc-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rc-brand"
      >
        <div className="px-3 pt-3 pb-2.5">
          {/* 1 · header */}
          <div className="flex items-start justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="text-[15px] font-medium text-rc-ink truncate">
                {spot.name}
              </span>
              {homeBadge && (
                <span className="inline-flex shrink-0 items-center rounded bg-rc-brand-soft px-1.5 py-0.5 font-rc-mono text-[9px] uppercase tracking-[0.06em] text-rc-brand">
                  Home
                </span>
              )}
              {reports && (
                <FreshCatchBadge
                  fresh={reports}
                  onUnlock={() => setReportsUpgradeOpen(true)}
                />
              )}
              {showVisibility && spot.isCustom && (
                <span
                  title={
                    spot.visibility === "public"
                      ? "Public: visible to other anglers"
                      : "Private: only you can see this spot"
                  }
                  className="inline-flex shrink-0 items-center gap-1 rounded bg-rc-surface px-1.5 py-0.5 font-rc-mono text-[9px] uppercase tracking-[0.06em] text-rc-ink-mute"
                >
                  {spot.visibility === "public" ? (
                    <Globe className="h-2.5 w-2.5" />
                  ) : (
                    <Lock className="h-2.5 w-2.5" />
                  )}
                  {spot.visibility === "public" ? "Public" : "Private"}
                </span>
              )}
            </span>
            <span
              className={`shrink-0 px-2 py-0.5 rounded font-rc-mono text-[11px] font-bold ${TIER_PILL[bt]}`}
            >
              {spot.score != null
                ? `${spot.score} ${bt.toUpperCase()}`
                : "NO SCORE"}
            </span>
          </div>

          {/* 2 · conclusion */}
          <div className="font-rc-mono text-[12px] text-rc-ink-soft mt-0.5 truncate">
            {conclusion}
          </div>

          {/* 3 · KPI columns (labels above) + compact trend */}
          <div className="flex items-end gap-2 mt-2.5">
            <div className="grid grid-cols-3 gap-x-2 flex-1 min-w-0">
              {(
                [
                  [Wind, "WIND", spot.conditions.wind],
                  [Waves, "SEA", spot.conditions.sea],
                  [Navigation, "CURRENT", spot.conditions.current],
                ] as const
              ).map(([Icon, label, value]) => (
                <div key={label} className="min-w-0">
                  <div className="rc-label text-[9px] flex items-center gap-1">
                    <Icon className="w-3 h-3 text-rc-ink-mute shrink-0" />
                    {label}
                  </div>
                  <div className="font-rc-mono text-[12px] font-medium text-rc-ink mt-0.5 truncate">
                    {value ?? "—"}
                  </div>
                </div>
              ))}
            </div>
            <div className="w-20 shrink-0">
              <SpotTrend hours={spot.hours24} />
            </div>
          </div>
        </div>
      </Link>

      {/* 4 · the next 14 days. Outside the body <a> on purpose: a locked day
          sells the upgrade, and a day cell inside the link would navigate to
          the spot report instead. */}
      {showDayStrip &&
        (days14 === undefined ? (
          <SpotDayStripSkeleton density={dayStripDensity} />
        ) : days14 && days14.length > 0 ? (
          <SpotDayStrip
            days={days14}
            density={dayStripDensity}
            onUnlock={() => setForecastUpgradeOpen(true)}
            moreHref={reportHref}
          />
        ) : null)}

      {/* 5 · persistent footer (one step below the card surface)
          `min-h-11` is 44px, the touch guideline. This row rendered at 33px,
          which is a poor thumb target on the card an angler actually taps. The
          two controls sit SIDE BY SIDE rather than stacked, so growing them
          separates nothing and cannot overlap a neighbour; the link centres its
          own text rather than sitting against the top edge.

          The minimum is on the two CONTROLS, not on the row. Putting it on the
          row leaves each control at 43px, because the row's 1px border-t comes
          out of the content box the children fill. */}
      <div className="flex items-stretch border-t border-rc-rule bg-rc-surface">
        <Link
          href={reportHref}
          onClick={(e) => e.stopPropagation()}
          className="flex flex-1 items-center min-h-11 text-left px-3 py-2 font-rc-mono text-[11px] font-semibold tracking-[0.08em] text-rc-brand hover:bg-rc-brand-soft/40 transition-colors"
        >
          FULL REPORT →
        </Link>
        <div className="w-px bg-rc-rule" aria-hidden />
        <button
          type="button"
          onClick={onStar}
          aria-label={fav ? "Remove from favorites" : "Add to favorites"}
          aria-pressed={fav}
          className="group w-12 min-h-11 flex items-center justify-center hover:bg-rc-badge/10 transition-colors"
        >
          <svg
            viewBox="0 0 42 40"
            aria-hidden
            className={`w-[15px] h-[14px] origin-center transition-[fill] duration-200 ${
              fav
                ? "fill-rc-badge"
                : "fill-rc-ink-mute group-hover:fill-rc-badge"
            } ${popping ? "animate-fav-pop" : ""}`}
          >
            <path d="M21,34 L10.4346982,39.5545079 C8.47875732,40.5828068 7.19697214,39.6450119 7.56952871,37.4728404 L9.5873218,25.7082039 L1.03981311,17.3764421 C-0.542576313,15.8339937 -0.0467737017,14.3251489 2.13421047,14.0082334 L13.946577,12.2917961 L19.2292279,1.58797623 C20.2071983,-0.393608322 21.7954064,-0.388330682 22.7707721,1.58797623 L28.053423,12.2917961 L39.8657895,14.0082334 C42.0525979,14.3259953 42.5383619,15.8381017 40.9601869,17.3764421 L32.4126782,25.7082039 L34.4304713,37.4728404 C34.8040228,39.6508126 33.5160333,40.5800681 31.5653018,39.5545079 L21,34 Z" />
          </svg>
        </button>
      </div>

      <ProTrialModal
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        feature="favorite-spots"
        from="explore-rail"
        spotName={spot.name}
      />
      {/* Separate instance from the favourites nag: same modal, different
          pitch. No spotName — the offer is the whole reporting stream, not
          this one card's numbers. */}
      <ProTrialModal
        open={reportsUpgradeOpen}
        onOpenChange={setReportsUpgradeOpen}
        feature="catch-reports"
        from="explore-rail-reports"
      />
      {/* A locked day in the strip. Named for the spot so the pitch is about
          the fortnight at a place the angler already cares about. */}
      <ProTrialModal
        open={forecastUpgradeOpen}
        onOpenChange={setForecastUpgradeOpen}
        feature={forecastNag}
        from="spot-card-day-strip"
        spotName={spot.name}
      />
    </div>
  );
}

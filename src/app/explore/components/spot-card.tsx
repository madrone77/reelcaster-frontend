"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useState } from "react";
import { Wind, Waves, Navigation, Lock, Globe } from "lucide-react";
import { TIER_PILL, type RailSpot, type Tier } from "../lib/explore-data";
import { useFavorite, favoriteCount } from "../lib/use-favorite";
import { useSubscription } from "@/hooks/use-subscription";
import { bestWindow } from "./hourly-bars";
import SpotTrend from "./spot-trend";

const UpgradeRequiredModal = dynamic(
  () => import("@/app/components/paywall/upgrade-required-modal"),
  { ssr: false },
);

/** Free tier may favorite this many spots before hitting the upgrade cap. */
const FREE_FAV_CAP = 1;

/**
 * Rail spot card. No hover-only actions: header + score badge, a plain-English
 * conclusion line, a WIND/SEA/TIDE meta row, the 24h sparkline, and a
 * persistent footer (VIEW 14-DAY link + favorite star). The whole body above
 * the footer opens the location report; the footer controls act on their own.
 */
export default function SpotCard({
  spot,
  onSelect,
  showVisibility = false,
  onFavoriteChange,
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
  /** Fires after the star toggles, so a list keyed on favourites can drop or
   *  add the card without a reload. */
  onFavoriteChange?: (fav: boolean) => void;
}) {
  const [fav, toggleFav] = useFavorite(spot.slug);
  const { isPaid } = useSubscription();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  // Drives the one-shot "pop" animation when a spot is favorited (not on load).
  const [popping, setPopping] = useState(false);

  // Badge tier per spec: green ≥75 · amber 50–74 · red <50.
  const bt: Tier =
    spot.score == null
      ? "none"
      : spot.score >= 75
        ? "good"
        : spot.score >= 50
          ? "fair"
          : "poor";

  const species = spot.driverSpecies?.replace(/^Pacific\s+/i, "");
  const { label: windowLabel } = bestWindow(spot.hours24);
  const conclusion = species
    ? `${species}${windowLabel ? ` · best ${windowLabel}` : ""}`
    : "No live score yet";

  const reportHref = `/explore/spot/${spot.slug}`;

  const onStar = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Turning a favorite ON while at the free cap → upgrade modal (never a silent no-op).
    if (!fav && !isPaid && favoriteCount() >= FREE_FAV_CAP) {
      setUpgradeOpen(true);
      return;
    }
    // Pop only when favoriting (the on-transition), not when un-favoriting.
    if (!fav) {
      setPopping(true);
      window.setTimeout(() => setPopping(false), 600);
    }
    toggleFav();
    onFavoriteChange?.(!fav);
  };

  return (
    <div className="bg-rc-panel border-2 border-rc-rule rounded overflow-hidden">
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
              {showVisibility && spot.isCustom && (
                <span
                  title={
                    spot.visibility === "public"
                      ? "Public — visible to other anglers"
                      : "Private — only you can see this spot"
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

      {/* 5 · persistent footer (one step below the card surface) */}
      <div className="flex items-stretch border-t border-rc-rule bg-rc-surface">
        <Link
          href={reportHref}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 text-left px-3 py-2 font-rc-mono text-[11px] font-semibold tracking-[0.08em] text-rc-brand hover:bg-rc-brand-soft/40 transition-colors"
        >
          VIEW MORE →
        </Link>
        <div className="w-px bg-rc-rule" aria-hidden />
        <button
          type="button"
          onClick={onStar}
          aria-label={fav ? "Remove from favorites" : "Add to favorites"}
          aria-pressed={fav}
          className="group w-12 flex items-center justify-center hover:bg-rc-badge/10 transition-colors"
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

      <UpgradeRequiredModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        feature="favorite-spots"
        headline="Upgrade to save more spots"
        bullets={[
          "Unlimited favorite spots",
          "Reorder + score sparklines",
          "Full 14-day outlook & alerts",
        ]}
      />
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ChevronLeft,
  Wind,
  Waves,
  ArrowUpDown,
  Navigation,
  Cloud,
  Thermometer,
  type LucideIcon,
} from "lucide-react";
import { useFavorite, favoriteCount } from "../lib/use-favorite";
import { useSubscription } from "@/hooks/use-subscription";
import {
  TIER_PILL,
  TIER_TEXT,
  currentLocalHour,
  fmtPeak,
  formatConditions,
  tierFor,
  type RailSpot,
} from "../lib/explore-data";
import HourlyBars from "./hourly-bars";
import { useUnitPreferences } from "@/contexts/unit-preferences-context";
import { convertDistance, formatDistance } from "@/app/utils/unit-conversions";

const UpgradeRequiredModal = dynamic(
  () => import("@/app/components/paywall/upgrade-required-modal"),
  { ssr: false },
);

/** Free tier may favorite this many spots before hitting the upgrade cap. */
const FREE_FAV_CAP = 1;

function headerStamp(date: string, tz: string, hour: number | null): string {
  const parts: string[] = ["SELECTED"];
  if (date) {
    const d = new Date(`${date}T12:00:00`);
    parts.push(
      d
        .toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
        .replace(/,/g, "")
        .toUpperCase(),
    );
  }
  parts.push(`${String(hour ?? currentLocalHour(tz)).padStart(2, "0")}:00`);
  return parts.join(" · ");
}

/**
 * Spot drawer per the Figma — fills the same rail slot as the list. Renders
 * entirely from the in-memory RailSpot: identity + score + the six-cell
 * conditions grid (tide, current, wind, sea state, sky, air temp — all from
 * the map-spots strip at the day-peak hour, hover-scrubbable) + the 24h
 * best-window chart. At rest the headline is the day's PEAK ("how good does
 * this day get here"); the shell's strip scrubber (`scrubHour`) and the
 * chart's own hover both pull it off peak onto a specific hour.
 */
export default function SpotDrawer({
  spot,
  date,
  tz,
  scrubHour = null,
  onBack,
  onHourHover,
}: {
  spot: RailSpot;
  date: string;
  tz: string;
  /** The hour scrubbed on the 14-day strip's lane (0–23), or null = day peak.
      Articulates this drawer — score, pill, conditions grid, chart marker —
      in lockstep with the strip. A local chart-hover overrides it. */
  scrubHour?: number | null;
  onBack: () => void;
  /** Reports the hover-scrubbed hour (null on leave) so the shell can retune
      time-anchored map layers — the animated currents field — to that hour. */
  onHourHover?: (hour: number | null) => void;
}) {
  // Resting state anchors to the day's PEAK hour — the drawer's headline
  // promise is "the best this day gets", not the score at whatever hour the
  // shell's scrubber happens to sit on. Derived from hours24 directly (not
  // spot.score, which the shell overrides to the scrubbed hour).
  let restScore: number | null = null;
  let restHour: number | null = null;
  for (let h = 0; h < spot.hours24.length; h++) {
    const v = spot.hours24[h];
    if (typeof v === "number" && (restScore === null || v > restScore)) {
      restScore = v;
      restHour = h;
    }
  }

  // Hover-scrub over the 24h chart: while the mouse is on a bar the score,
  // pill, header stamp, and conditions grid preview that hour; leaving the
  // chart reverts to the day-peak resting state.
  const { distanceUnit } = useUnitPreferences();
  const [hoverHour, setHoverHour] = useState<number | null>(null);
  const handleHourHover = (h: number | null) => {
    setHoverHour(h);
    onHourHover?.(h);
  };
  // Closing the drawer (or switching spots) mid-hover skips the chart's
  // mouseleave — make sure the shell doesn't stay pinned to a dead hour.
  const onHourHoverRef = useRef(onHourHover);
  onHourHoverRef.current = onHourHover;
  useEffect(() => () => onHourHoverRef.current?.(null), []);
  // Active hour = local chart-hover (highest priority) → strip scrub → day
  // peak. Whichever wins drives the score, pill, header stamp, conditions
  // grid, and the 24h chart marker together.
  const activeHour = hoverHour ?? scrubHour ?? restHour;
  const activeScore =
    activeHour !== null ? spot.hours24[activeHour] : null;
  const score = activeScore ?? restScore ?? spot.score;
  const displayHour = activeHour;
  const displayCell =
    displayHour !== null ? spot.condStrip?.[displayHour] : null;
  const conditions = displayCell ? formatConditions(displayCell) : spot.conditions;

  const tier = tierFor(score);
  const peak = fmtPeak(spot.peakHour);
  const spotHref = `/explore/spot/${spot.slug}`;
  const [fav, toggleFav] = useFavorite(spot.slug);
  const { isPaid } = useSubscription();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  // Drives the one-shot "pop" animation when a spot is favorited (not on load).
  const [popping, setPopping] = useState(false);
  const onStar = () => {
    if (!fav && !isPaid && favoriteCount() >= FREE_FAV_CAP) {
      setUpgradeOpen(true);
      return;
    }
    if (!fav) {
      setPopping(true);
      window.setTimeout(() => setPopping(false), 600);
    }
    toggleFav();
  };

  // All six cells read the map-spots conditions strip at the displayed hour
  // (day peak, or the hover-previewed hour) — same source as the rail
  // card's KPI columns.
  const conditionCells: Array<{
    label: string;
    value: string;
    sub: string | null;
    icon: LucideIcon;
  }> = [
    { label: "TIDE", value: conditions.tide ?? "—", sub: null, icon: ArrowUpDown },
    { label: "CURRENT", value: conditions.current ?? "—", sub: null, icon: Navigation },
    { label: "WIND", value: conditions.wind ?? "—", sub: null, icon: Wind },
    { label: "SEA STATE", value: conditions.sea ?? "—", sub: null, icon: Waves },
    { label: "SKY", value: conditions.sky ?? "—", sub: null, icon: Cloud },
    { label: "AIR TEMP", value: conditions.air ?? "—", sub: null, icon: Thermometer },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to list"
          className="p-1 -ml-1 rounded-md text-rc-brand hover:bg-rc-surface transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="rc-label text-[9px]">{headerStamp(date, tz, displayHour)}</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {/* Name — star sits directly beside it, same interaction as the rail
            SpotCard's favorite (custom star path, gold hover/fill, pop on save). */}
        <div className="flex items-center gap-2 mt-1">
          <h2 className="rc-title-lg truncate">{spot.name}</h2>
          <button
            type="button"
            onClick={onStar}
            aria-label={fav ? "Remove from favorites" : "Add to favorites"}
            aria-pressed={fav}
            className="group shrink-0 p-1 rounded hover:bg-rc-badge/10 transition-colors"
          >
            <svg
              viewBox="0 0 42 40"
              aria-hidden
              className={`w-[18px] h-[17px] origin-center transition-[fill] duration-200 ${
                fav ? "fill-rc-badge" : "fill-rc-ink-mute group-hover:fill-rc-badge"
              } ${popping ? "animate-fav-pop" : ""}`}
            >
              <path d="M21,34 L10.4346982,39.5545079 C8.47875732,40.5828068 7.19697214,39.6450119 7.56952871,37.4728404 L9.5873218,25.7082039 L1.03981311,17.3764421 C-0.542576313,15.8339937 -0.0467737017,14.3251489 2.13421047,14.0082334 L13.946577,12.2917961 L19.2292279,1.58797623 C20.2071983,-0.393608322 21.7954064,-0.388330682 22.7707721,1.58797623 L28.053423,12.2917961 L39.8657895,14.0082334 C42.0525979,14.3259953 42.5383619,15.8381017 40.9601869,17.3764421 L32.4126782,25.7082039 L34.4304713,37.4728404 C34.8040228,39.6508126 33.5160333,40.5800681 31.5653018,39.5545079 L21,34 Z" />
            </svg>
          </button>
        </div>
        <p className="font-rc-mono text-xs text-rc-ink-soft mt-1">
          {spot.regionName}
          {spot.distanceKm !== null
            ? ` · ${
                distanceUnit === "km"
                  ? `${spot.distanceKm} km`
                  : formatDistance(convertDistance(spot.distanceKm, "km", distanceUnit), distanceUnit)
              }`
            : ""}
        </p>

        {/* Score block */}
        <div className="flex items-center gap-4 mt-4 pb-5 border-b border-rc-rule-soft">
          <span
            className={`text-[60px] leading-none font-bold tracking-[-0.04em] ${TIER_TEXT[tier]}`}
          >
            {score ?? "—"}
          </span>
          <div className="space-y-1.5">
            <span
              className={`inline-block px-2 py-0.5 rounded font-rc-mono text-[11px] font-bold ${TIER_PILL[tier]}`}
            >
              {score !== null ? tier.toUpperCase() : "NO SCORE"}
            </span>
            {spot.driverSpecies && (
              <p className="font-rc-mono text-xs text-rc-ink-soft">
                {spot.driverSpecies}{peak ? ` · peak ${peak}` : ""}
              </p>
            )}
          </div>
        </div>

        {/* Conditions grid */}
        <div className="grid grid-cols-3 gap-y-4 mt-5 pb-5 border-b border-rc-rule-soft">
          {conditionCells.map((cell) => (
            <div key={cell.label}>
              <div className="rc-label text-[9px] flex items-center gap-1">
                <cell.icon className="w-3 h-3 text-rc-ink-mute shrink-0" />
                {cell.label}
              </div>
              <div className="font-rc-mono text-sm font-medium text-rc-ink mt-1">
                {cell.value}
              </div>
              {cell.sub && (
                <div className="font-rc-mono text-[10px] text-rc-ink-mute mt-0.5 italic">
                  {cell.sub}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 24h chart — hover-scrubbable; the marker tracks the hovered hour,
            resting on the day's peak hour. */}
        <div className="mt-5">
          <HourlyBars
            hours={spot.hours24}
            tz={tz}
            selectedHour={displayHour}
            onHoverHour={handleHourHover}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 px-4 py-4 border-t border-rc-rule-soft">
        <Link
          href={spotHref}
          className="flex-1 text-center px-4 py-2.5 rounded-lg bg-rc-brand hover:bg-rc-brand-hover text-white font-rc-mono text-xs font-semibold tracking-[0.08em] transition-colors"
        >
          VIEW SPOT DETAILS
        </Link>
        <Link
          href="/profile/custom-alerts"
          className="px-4 py-2.5 rounded-lg border border-rc-brand text-rc-brand font-rc-mono text-xs font-semibold tracking-[0.08em] hover:bg-rc-brand-soft transition-colors text-center"
        >
          SET ALERT
        </Link>
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

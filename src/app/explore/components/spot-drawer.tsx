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
import { useFavorite } from "../lib/use-favorite";
import { useSubscription } from "@/hooks/use-subscription";
import { FreshCatchBlock } from "./fresh-catch-reports";
import type { RailFreshCatch } from "../lib/fresh-catch-types";
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
import { formatHour12 } from "@/lib/time-format";
import { spotHref } from "@/lib/paths";
import { withAdParams } from "@/lib/ad-mode";
import { useAdFrame } from "../lib/ad-frame";

const ProTrialModal = dynamic(
  () => import("@/app/components/paywall/pro-trial-modal"),
  { ssr: false },
);


function dateStamp(date: string): string {
  if (!date) return "";
  return new Date(`${date}T12:00:00`)
    .toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
    .replace(/,/g, "")
    .toUpperCase();
}

function hourStamp(tz: string, hour: number | null): string {
  return formatHour12(hour ?? currentLocalHour(tz));
}

/**
 * Spot drawer per the Figma — fills the same rail slot as the list. Renders
 * entirely from the in-memory RailSpot: identity + score + the six-cell
 * conditions grid (tide, current, wind, sea state, sky, air temp — all from
 * the map-spots strip at the day-peak hour, hover-scrubbable) + the 24h
 * best-window chart. At rest the headline is the day's PEAK ("how good does
 * this day get here"); the shell's strip scrubber (`scrubHour`) and the
 * chart's own hover both pull it off peak onto a specific hour.
 *
 * The active hour is stated three times along the eye's path — headline in the
 * header, caption over the conditions grid, readout pill under the cursor on
 * the chart — because scrubbing changes the score and all six condition cells
 * at once, and one 9px stamp at the top was too far from them to read as cause
 * and effect. All three read the same `displayHour`.
 */
export default function SpotDrawer({
  spot,
  date,
  tz,
  scrubHour = null,
  onBack,
  onHourHover,
  onSetAlert,
  fresh,
  freshDays = 21,
  freshSpeciesNames,
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
  /** Opens the create-alert modal in place for this spot. When omitted, the
      "Set alert" button falls back to the spot page (which opens the modal). */
  onSetAlert?: (spot: RailSpot) => void;
  /** Scraped catch reports for this spot. Already Pro-gated by the route —
      a free viewer's entry is `{ locked: true }` and carries no numbers. */
  fresh?: RailFreshCatch;
  freshDays?: number;
  /** speciesId → display name, for the per-species split. */
  freshSpeciesNames?: Record<string, string>;
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
  // Carries the ad frame onto the spot page when there is one — see
  // SpotCard's copy of this line.
  //
  // The alert button is built separately rather than by appending to `href`.
  // It used to be `${href}?alert=1`, which is fine while `href` is a bare path
  // and produces `?ad=today?alert=1` the moment it is not: two query strings,
  // one of them read as part of the other's value.
  const adFrame = useAdFrame();
  const href = withAdParams(spotHref(spot), adFrame);
  // Under the ad frame both links below stay on the map and open the trial
  // modal instead (AdFrame.onOpenSpot); modified clicks keep the href.
  const openSpotOnAd = (e: React.MouseEvent) => {
    if (adFrame?.onOpenSpot && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
      e.preventDefault();
      adFrame.onOpenSpot(spot);
    }
  };
  const alertHref = withAdParams(`${spotHref(spot)}?alert=1`, adFrame);
  const [fav, toggleFav] = useFavorite(spot.slug);
  const { isPaid } = useSubscription();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [reportsUpgradeOpen, setReportsUpgradeOpen] = useState(false);
  // Drives the one-shot "pop" animation when a spot is favorited (not on load).
  const [popping, setPopping] = useState(false);
  const onStar = async () => {
    const res = await toggleFav({ isPaid, spotId: spot.id });
    if (res === "signed-out" || res === "at-cap") {
      setUpgradeOpen(true);
      return;
    }
    if (res === "saved") {
      setPopping(true);
      window.setTimeout(() => setPopping(false), 600);
    }
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

  // "Is this the day's best, or a moment I went looking for?" — the header
  // chip answers it, and it's the only cue that scrubbing has moved the whole
  // drawer off its resting state.
  const scrubbing = hoverHour !== null || scrubHour !== null;

  // The panel is sized by its content (the rail caps it with max-height), so
  // `min-h-0` — not `flex-1` — is what lets the body scroll on short viewports
  // while leaving no dead space under the chart on tall ones.
  return (
    <div className="flex flex-col min-h-0">
      {/* Header — the hour is the headline here, not a footnote: it is what
          the score, the conditions grid, and the chart marker are all keyed to,
          and it moves under the cursor while scrubbing. */}
      <div className="flex items-center gap-2 px-4 pt-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to list"
          className="p-1 -ml-1 rounded-md text-rc-brand hover:bg-rc-surface transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="rc-label text-[9px]">{dateStamp(date)}</span>
          <span className="font-rc-mono text-[15px] font-semibold leading-none text-rc-ink tabular-nums">
            {hourStamp(tz, displayHour)}
          </span>
        </div>
        <span
          className={`ml-auto shrink-0 rounded px-1.5 py-0.5 font-rc-mono text-[9px] font-bold tracking-[0.1em] ${
            scrubbing
              ? "bg-rc-brand/10 text-rc-brand"
              : "bg-rc-surface text-rc-ink-mute"
          }`}
        >
          {scrubbing ? "SCRUBBING" : "PEAK"}
        </span>
      </div>

      <div className="min-h-0 overflow-y-auto px-4 pb-4">
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

        {/* Score block — the number lives in a fixed three-digit gutter with
            tabular figures, so scrubbing the 24h chart from 83 to 5 can't drag
            the tier pill and species line sideways with it. */}
        <div className="flex items-center gap-4 mt-4 pb-5 border-b border-rc-rule-soft">
          <span
            className={`w-[3ch] shrink-0 tabular-nums text-[60px] leading-none font-bold tracking-[-0.04em] ${TIER_TEXT[tier]}`}
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

        {/* Fresh catch reports — the evidence, directly under the prediction.
            Renders nothing when this spot has no reports in the window. */}
        {fresh && (
          <FreshCatchBlock
            fresh={fresh}
            days={freshDays}
            speciesNames={freshSpeciesNames}
            onUpgrade={() => setReportsUpgradeOpen(true)}
            className="mt-5 pb-5 border-b border-rc-rule-soft"
          />
        )}

        {/* Conditions grid — captioned with the hour it is read at, so the
            values and the time they belong to change together in one glance
            instead of the time living alone up in the header. */}
        <div className="rc-label text-[9px] mt-5 mb-2">
          CONDITIONS AT{" "}
          <span className="font-semibold text-rc-ink tabular-nums">
            {hourStamp(tz, displayHour)}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-y-4 pb-5 border-b border-rc-rule-soft">
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
          href={href}
          onClick={openSpotOnAd}
          className="flex-1 text-center px-4 py-2.5 rounded-lg bg-rc-brand hover:bg-rc-brand-hover text-white font-rc-mono text-xs font-semibold tracking-[0.08em] transition-colors"
        >
          VIEW SPOT DETAILS
        </Link>
        {onSetAlert ? (
          <button
            type="button"
            onClick={() => onSetAlert(spot)}
            className="px-4 py-2.5 rounded-lg border border-rc-brand text-rc-brand font-rc-mono text-xs font-semibold tracking-[0.08em] hover:bg-rc-brand-soft transition-colors text-center"
          >
            SET ALERT
          </button>
        ) : (
          <Link
            href={alertHref}
            onClick={openSpotOnAd}
            className="px-4 py-2.5 rounded-lg border border-rc-brand text-rc-brand font-rc-mono text-xs font-semibold tracking-[0.08em] hover:bg-rc-brand-soft transition-colors text-center"
          >
            SET ALERT
          </Link>
        )}
      </div>

      <ProTrialModal
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        feature="favorite-spots"
        from="explore-drawer"
        spotName={spot.name}
      />
      <ProTrialModal
        open={reportsUpgradeOpen}
        onOpenChange={setReportsUpgradeOpen}
        feature="catch-reports"
        from="explore-drawer-reports"
      />
    </div>
  );
}

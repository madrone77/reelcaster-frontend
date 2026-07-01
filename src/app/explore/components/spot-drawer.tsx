"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ChevronLeft, X } from "lucide-react";
import {
  TIER_PILL,
  TIER_TEXT,
  currentLocalHour,
  fmtPeak,
  tierFor,
  type RailSpot,
} from "../lib/explore-data";
import HourlyBars from "./hourly-bars";
import { useSpotIntel } from "../lib/use-spot-intel";

function headerStamp(date: string, tz: string): string {
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
  parts.push(`${String(currentLocalHour(tz)).padStart(2, "0")}:00`);
  return parts.join(" · ");
}

/**
 * Spot drawer per the Figma — fills the same rail slot as the list. Renders
 * instantly from the in-memory RailSpot, then fills the WATER cell from
 * BlueCaster's live spot-page. Kept intentionally lean: identity + score +
 * the six-cell conditions grid + the 24h best-window chart. (PRESSURE / MOON
 * stay placeholders — not in the payload.)
 */
export default function SpotDrawer({
  spot,
  date,
  tz,
  onBack,
}: {
  spot: RailSpot;
  date: string;
  tz: string;
  onBack: () => void;
}) {
  const tier = tierFor(spot.score);
  const peak = fmtPeak(spot.peakHour);
  const spotHref = `/explore/spot/${spot.slug}`;

  // Live spot-page (slug only) — used to fill the WATER temp cell.
  const { page } = useSpotIntel({
    slug: spot.slug,
    spotId: null,
    speciesId: null,
    evidenceEnabled: false,
  });

  // WATER temp from the live spot-page's current-hour cell (fills one gap).
  const waterTemp = useMemo(() => {
    const cell = page?.hourlyConditionsGrid?.[0]?.[currentLocalHour(tz)];
    const t = cell?.seaTempC;
    return t != null ? `${t.toFixed(1)}°C` : null;
  }, [page, tz]);

  const conditionCells: Array<{ label: string; value: string; sub: string | null }> = [
    { label: "WIND", value: spot.conditions.wind ?? "—", sub: null },
    { label: "TIDE", value: spot.conditions.tide ?? "—", sub: null },
    { label: "SEA", value: spot.conditions.sea ?? "—", sub: null },
    { label: "PRESSURE", value: "—", sub: "coming soon" },
    { label: "WATER", value: waterTemp ?? "—", sub: waterTemp ? null : "coming soon" },
    { label: "MOON", value: "—", sub: "coming soon" },
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
        <span className="rc-label text-[9px]">{headerStamp(date, tz)}</span>
        <button
          type="button"
          onClick={onBack}
          aria-label="Close"
          className="ml-auto p-1 rounded-md text-rc-ink-mute hover:bg-rc-surface hover:text-rc-ink transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {/* Name + details link */}
        <div className="flex items-start justify-between gap-3 mt-2">
          <h2 className="rc-title-lg truncate">{spot.name}</h2>
          <Link
            href={spotHref}
            className="shrink-0 text-sm font-semibold text-rc-brand hover:underline mt-1"
          >
            View spot details
          </Link>
        </div>
        <p className="font-rc-mono text-xs text-rc-ink-soft mt-1">
          {spot.regionName}
          {spot.distanceKm !== null ? ` · ${spot.distanceKm} km` : ""}
        </p>

        {/* Score block */}
        <div className="flex items-center gap-4 mt-6 pb-5 border-b border-rc-rule-soft">
          <span
            className={`text-[60px] leading-none font-bold tracking-[-0.04em] ${TIER_TEXT[tier]}`}
          >
            {spot.score ?? "—"}
          </span>
          <div className="space-y-1.5">
            <span
              className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${TIER_PILL[tier]}`}
            >
              {spot.score !== null ? tier.toUpperCase() : "NO SCORE"}
            </span>
            {spot.driverSpecies && (
              <p className="font-rc-mono text-xs text-rc-ink-soft">
                {spot.driverSpecies} driving{peak ? ` · peak ${peak}` : ""}
              </p>
            )}
          </div>
        </div>

        {/* Conditions grid */}
        <div className="grid grid-cols-3 gap-y-4 mt-5 pb-5 border-b border-rc-rule-soft">
          {conditionCells.map((cell) => (
            <div key={cell.label}>
              <div className="rc-label text-[9px]">{cell.label}</div>
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

        {/* 24h chart */}
        <div className="mt-5">
          <HourlyBars hours={spot.hours24} tz={tz} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 px-4 py-4 border-t border-rc-rule-soft">
        <Link
          href={spotHref}
          className="flex-1 text-center px-4 py-2.5 rounded-lg bg-rc-brand hover:bg-rc-brand-hover text-white font-rc-mono text-xs font-semibold tracking-[0.08em] transition-colors"
        >
          VIEW 14-DAY REPORT →
        </Link>
        <Link
          href="/profile/custom-alerts"
          className="px-4 py-2.5 rounded-lg border border-rc-rule text-rc-ink font-rc-mono text-xs font-semibold tracking-[0.08em] hover:bg-rc-surface transition-colors text-center"
        >
          SET ALERT
        </Link>
      </div>
    </div>
  );
}

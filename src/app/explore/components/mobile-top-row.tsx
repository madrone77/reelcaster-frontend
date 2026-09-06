"use client";

import type { ReactNode } from "react";
import { MapPinPlus, SlidersHorizontal } from "lucide-react";
import { TOP_BAR_CTA_WIDTH } from "@/app/components/ui/button";

/**
 * The phone's top row, floating over the map: Search, Filters, a compass, and
 * Add spot filling whatever is left.
 *
 * It used to be one white bar carrying the city name, Add spot, Near me and
 * Filters, and it read as a second header. These are four separate controls
 * on the water now, and the widths say what matters. Search is a small pill
 * because it is rarely used and the browse sheet already names the city.
 * Add spot takes the rest of the row because a custom spot is the Pro feature
 * most anglers reach for first, and the one they most need to see. Near me
 * moved inside the search sheet, where the desktop already keeps it.
 *
 * The compass sits between Filters and Add spot. The map rotates under two
 * fingers, and a rotated chart with no north on it is a chart you cannot read;
 * the needle turns with the map and a tap puts north back on top.
 */
/**
 * The row lines up with the blue bar above it. Search is exactly the width of
 * the ReelCaster mark (104px, see ExploreTopBar), Add spot is exactly the width
 * of the bar's Start free trial button (TOP_BAR_CTA_WIDTH, pinned in
 * button.ts), and both sit on the bar's own gutters, so the pill's left edge is
 * the mark's left edge and Add spot's right edge is the button's. Filters and
 * the compass float between them with equal air on either side.
 */
export const MARK_WIDTH_CLASS = "w-[104px]";

export default function MobileTopRow({
  search,
  onFilterClick,
  activeFilters,
  bearing,
  onResetNorth,
  onAddSpot,
}: {
  /** The compact location selector: a Search pill that opens the sheet. */
  search: ReactNode;
  onFilterClick: () => void;
  /** How many filters are off their default. Badges the button. */
  activeFilters: number;
  /** The map's bearing in degrees; 0 is north-up. */
  bearing: number;
  onResetNorth: () => void;
  /** Undefined while placement is armed. Present even while the tier is
   *  still resolving: the shell holds a press until it knows. */
  onAddSpot?: () => void;
}) {
  const rotated = Math.abs(bearing) > 0.5;
  return (
    <div className="flex items-center justify-between gap-1">
      {search}

      <button
        type="button"
        onClick={onFilterClick}
        aria-label={activeFilters > 0 ? `Filters (${activeFilters} on)` : "Filters"}
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-rc-rule bg-rc-panel/95 text-rc-ink shadow-rc-panel backdrop-blur"
      >
        <SlidersHorizontal className="h-[18px] w-[18px]" />
        {/* The only thing on this screen that says the map is narrowed. */}
        {activeFilters > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-rc-panel bg-rc-brand px-1 font-rc-mono text-[9px] font-bold leading-none text-white">
            {activeFilters}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={onResetNorth}
        aria-label={rotated ? "Reset map to north" : "Map is facing north"}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-rc-rule bg-rc-panel/95 shadow-rc-panel backdrop-blur"
      >
        {/* A needle: the north half in red, the south in ink. Turned by the
            map's bearing so it always points at true north on screen. */}
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6 transition-transform duration-150"
          style={{ transform: `rotate(${-bearing}deg)` }}
          aria-hidden
        >
          <circle cx="12" cy="12" r="10.5" fill="none" stroke="currentColor" strokeWidth="1" className="text-rc-rule" />
          <path d="M12 2.5 L15.2 12 L8.8 12 Z" fill="#E11D2E" />
          <path d="M12 21.5 L15.2 12 L8.8 12 Z" fill="currentColor" className="text-rc-ink-soft" />
        </svg>
      </button>

      {/* The same width as the bar's Start free trial button, so the two stack
          edge to edge. */}
      <button
        type="button"
        onClick={onAddSpot}
        disabled={!onAddSpot}
        className={`${TOP_BAR_CTA_WIDTH} flex h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-rc-brand bg-rc-brand px-3 text-[14px] font-bold text-white shadow-rc-panel outline outline-2 outline-white -outline-offset-5 transition-colors hover:bg-rc-brand-hover disabled:opacity-70`}
      >
        <MapPinPlus className="h-[18px] w-[18px] shrink-0" />
        <span className="truncate">Add spot</span>
      </button>
    </div>
  );
}

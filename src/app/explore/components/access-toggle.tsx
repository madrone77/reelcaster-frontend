"use client";

import type { AccessFilter } from "@/lib/spot-access";

const OPTIONS: Array<[AccessFilter, string]> = [
  ["all", "All"],
  ["boat", "Boat"],
  ["shore", "Shore"],
];

export const EMPTY_TITLE: Record<AccessFilter, string> = {
  all: "No published spots here yet",
  boat: "No boat spots here yet",
  shore: "No shore spots here yet",
};

/** Shore coverage is thin, so an empty Shore list says so and points at the
 *  way out, rather than reading as a broken map. */
export const SHORE_EMPTY_BODY =
  "We're adding piers, beaches and jetties city by city. Pan the map, or switch to All to see every spot.";

/**
 * All / Boat / Shore. Boat and shore anglers want different water, so this
 * narrows the map, the pins and the list to the kind of fishing you do. It
 * sits beside the spot count rather than in the filter sheet because it
 * decides what the whole map is about, not one search.
 */
export default function AccessToggle({
  value,
  onChange,
  size = "md",
}: {
  value: AccessFilter;
  onChange: (v: AccessFilter) => void;
  /** "sm" fits the phone sheet's header row without moving its peek height. */
  size?: "sm" | "md";
}) {
  const pad = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-[11px]";
  return (
    <div
      role="radiogroup"
      aria-label="Fishing from"
      className="inline-flex shrink-0 rounded-sm border border-rc-rule bg-rc-panel p-0.5"
    >
      {OPTIONS.map(([v, label]) => {
        const on = value === v;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(v)}
            className={`${pad} rounded-sm transition-colors duration-[180ms] ${
              on
                ? "bg-rc-brand-soft text-rc-ink font-semibold"
                : "text-rc-ink-soft font-medium hover:bg-rc-surface"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

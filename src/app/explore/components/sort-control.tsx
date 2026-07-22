"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpDown } from "lucide-react";
import type { RailSpot } from "../lib/explore-data";

export type SortKey = "score" | "name";

export const SORT_LABEL: Record<SortKey, string> = {
  score: "Best score",
  name: "Name A–Z",
};

/** Rail-local presentation sort (never reorders the map / forecast anchor). */
export function sortSpots(spots: RailSpot[], sort: SortKey): RailSpot[] {
  if (sort === "name") {
    return [...spots].sort((a, b) => a.name.localeCompare(b.name));
  }
  // Score, desc — nulls last (mirrors the shell's default order).
  return [...spots].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}

/**
 * The shared "Sort ▾" pill + dropdown used by both the desktop rail and the
 * mobile/tablet list so the control stays identical across breakpoints.
 */
export default function SortControl({
  sort,
  onSort,
}: {
  sort: SortKey;
  onSort: (key: SortKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Sort spots"
        title="Sort"
        className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-colors ${
          open
            ? "bg-rc-brand border-rc-brand text-white"
            : sort !== "score"
              ? // A non-default sort is active — a soft brand tint marks it.
                "bg-rc-brand-soft border-rc-brand-soft text-rc-brand hover:bg-rc-brand-soft/70"
              : // Resting state (default sort, closed) — neutral until used.
                "border-rc-rule text-rc-ink-soft hover:bg-rc-surface hover:border-rc-brand"
        }`}
      >
        <ArrowUpDown className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-40 bg-rc-panel border border-rc-rule rounded-xl shadow-rc-panel py-1">
          {(Object.keys(SORT_LABEL) as SortKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                onSort(key);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                sort === key
                  ? "bg-rc-brand-soft text-rc-brand font-semibold"
                  : "text-rc-ink hover:bg-rc-surface"
              }`}
            >
              {SORT_LABEL[key]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

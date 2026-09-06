"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowUpDown } from "lucide-react";
import type { RailSpot } from "../lib/explore-data";
import type { FreshCatchesResponse } from "../lib/fresh-catch-types";
import { useSubscription } from "@/hooks/use-subscription";

const ProTrialModal = dynamic(
  () => import("@/app/components/paywall/pro-trial-modal"),
  { ssr: false },
);

export type SortKey = "score" | "active" | "name";

export const SORT_LABEL: Record<SortKey, string> = {
  score: "Best score",
  active: "Most active",
  name: "Name A-Z",
};

/** Sorts that read Pro-only data. Picking one as a free or anonymous viewer
 *  opens the Pro modal instead of reordering: the ranking would give away
 *  which spots carry catch reports, the same fact the badge hides from them. */
const PRO_SORTS: ReadonlySet<SortKey> = new Set<SortKey>(["active"]);

const byScore = (a: RailSpot, b: RailSpot) => (b.score ?? -1) - (a.score ?? -1);

/** Rail-local presentation sort (never reorders the map / forecast anchor).
 *
 *  `fresh` is the Pro-gated catch-report payload. "Most active" ranks by its
 *  report count inside the intel window; a spot the payload has not landed for
 *  yet falls back to the boolean `hasReports` that rides on the map payload, so
 *  tracked spots still float up on the first paint. Ties break on score. */
export function sortSpots(
  spots: RailSpot[],
  sort: SortKey,
  fresh?: FreshCatchesResponse | null,
): RailSpot[] {
  if (sort === "name") {
    return [...spots].sort((a, b) => a.name.localeCompare(b.name));
  }
  if (sort === "active") {
    const activity = (s: RailSpot) =>
      fresh?.spots[s.id]?.count ?? (s.hasReports ? 0.5 : 0);
    return [...spots].sort(
      (a, b) => activity(b) - activity(a) || byScore(a, b),
    );
  }
  // Score, desc — nulls last (mirrors the shell's default order).
  return [...spots].sort(byScore);
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
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { isPaid } = useSubscription();

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
                setOpen(false);
                if (PRO_SORTS.has(key) && !isPaid) {
                  setUpgradeOpen(true);
                  return;
                }
                onSort(key);
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
      {/* Same pitch as the reports badge: the offer is the reporting stream,
          which is also what this ranking reads. */}
      <ProTrialModal
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        feature="catch-reports"
        from="explore-sort-most-active"
      />
    </div>
  );
}

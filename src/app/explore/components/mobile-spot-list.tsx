"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { RailSpot } from "../lib/explore-data";
import SpotCard from "./spot-card";

type SortKey = "score" | "name";

const SORT_LABEL: Record<SortKey, string> = {
  score: "Best score",
  name: "Name A–Z",
};

/**
 * Mobile (<lg) list section for the Explore document flow: the "Viewing all
 * spots" header + count, a Sort control, and the SpotCard list. Reuses the
 * same SpotCard the desktop rail renders. Sort is local presentation state —
 * kept out of the shell so it never reorders the map / forecast anchor.
 */
export default function MobileSpotList({
  spots,
  onSelectSpot,
}: {
  spots: RailSpot[];
  onSelectSpot: (slug: string) => void;
}) {
  const [sort, setSort] = useState<SortKey>("score");
  const [menuOpen, setMenuOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  // Close the sort menu on outside click.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!sortRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  const above60 = spots.filter((s) => (s.score ?? 0) >= 60).length;

  const sorted = useMemo(() => {
    if (sort === "name") {
      return [...spots].sort((a, b) => a.name.localeCompare(b.name));
    }
    // Score, desc — nulls last (mirrors the shell's default order).
    return [...spots].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  }, [spots, sort]);

  return (
    <section className="lg:hidden bg-rc-page">
      <div className="px-4 pt-4 pb-2 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="rc-label text-[9px]">Viewing all spots</div>
          <div className="text-[15px] font-semibold text-rc-ink mt-0.5">
            {spots.length} spot{spots.length === 1 ? "" : "s"}
            {spots.length > 0 && (
              <span className="font-rc-mono text-rc-ink-mute font-normal">
                {" · "}
                {above60} above 60
              </span>
            )}
          </div>
        </div>

        {spots.length > 1 && (
          <div ref={sortRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rc-brand-soft text-rc-brand text-xs font-semibold transition-colors"
            >
              Sort
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${menuOpen ? "rotate-180" : ""}`}
              />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-20 mt-1 w-40 bg-rc-panel border border-rc-rule rounded-xl shadow-rc-panel py-1">
                {(Object.keys(SORT_LABEL) as SortKey[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setSort(key);
                      setMenuOpen(false);
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
        )}
      </div>

      <div className="px-4 pb-4 space-y-3">
        {sorted.map((spot) => (
          <SpotCard
            key={spot.id}
            spot={spot}
            onSelect={() => onSelectSpot(spot.slug)}
          />
        ))}

        {spots.length === 0 && (
          <div className="text-center py-10 px-4">
            <p className="text-sm font-semibold text-rc-ink mb-1">
              No published spots here yet
            </p>
            <p className="text-xs text-rc-ink-mute">
              Coverage is rolling out across BC, WA, and OR — new spots are
              added every week.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

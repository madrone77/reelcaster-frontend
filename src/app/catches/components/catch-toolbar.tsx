"use client";

import { Search, LayoutGrid, List } from "lucide-react";

export type SortKey = "newest" | "oldest" | "heaviest" | "longest" | "best-score";

export const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: "newest", label: "Newest" },
  { key: "oldest", label: "Oldest" },
  { key: "heaviest", label: "Heaviest" },
  { key: "longest", label: "Longest" },
  { key: "best-score", label: "Best score" },
];

/** Search box + sort dropdown + grid/list view toggle. */
export default function CatchToolbar({
  query,
  onQuery,
  sort,
  onSort,
  view,
  onView,
}: {
  query: string;
  onQuery: (q: string) => void;
  sort: SortKey;
  onSort: (s: SortKey) => void;
  view: "list" | "grid";
  onView: (v: "list" | "grid") => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 rounded-lg border border-rc-rule bg-rc-panel px-3 py-1.5">
        <Search className="w-4 h-4 text-rc-ink-mute" />
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search catches"
          className="w-36 sm:w-44 bg-transparent text-[13px] text-rc-ink placeholder:text-rc-ink-mute focus:outline-none"
        />
      </div>

      <select
        value={sort}
        onChange={(e) => onSort(e.target.value as SortKey)}
        className="rounded-lg border border-rc-rule bg-rc-panel px-3 py-2 text-[13px] font-semibold text-rc-ink focus:outline-none cursor-pointer"
        aria-label="Sort catches"
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>

      <div className="flex rounded-lg border border-rc-rule overflow-hidden">
        <button
          type="button"
          aria-label="Grid view"
          onClick={() => onView("grid")}
          className={`px-2.5 py-2 transition-colors ${
            view === "grid" ? "bg-rc-brand text-white" : "bg-rc-panel text-rc-ink-mute hover:bg-rc-surface"
          }`}
        >
          <LayoutGrid className="w-4 h-4" />
        </button>
        <button
          type="button"
          aria-label="List view"
          onClick={() => onView("list")}
          className={`px-2.5 py-2 transition-colors ${
            view === "list" ? "bg-rc-brand text-white" : "bg-rc-panel text-rc-ink-mute hover:bg-rc-surface"
          }`}
        >
          <List className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

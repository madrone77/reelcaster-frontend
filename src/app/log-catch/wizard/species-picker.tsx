"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { fetchSpeciesList } from "@/lib/bluecaster-client";
import type { SpeciesChoice } from "./types";

interface Option {
  bcId: string;
  slug: string | null;
  name: string;
  atSpot: boolean;
}

/**
 * "Not right?" species corrector. Species known at the matched spot rank
 * first; the full BlueCaster list (lazy-loaded, 1h-cached proxy) fills the
 * rest, searchable.
 */
export default function SpeciesPicker({
  speciesAtSpot,
  onSelect,
  onClose,
}: {
  speciesAtSpot: Array<{ id: string; name: string; slug: string | null }>;
  onSelect: (choice: SpeciesChoice) => void;
  onClose: () => void;
}) {
  const [all, setAll] = useState<Option[] | null>(null);
  const [query, setQuery] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    fetchSpeciesList().then((list) => {
      if (!alive) return;
      setAll(
        (list ?? []).map((s) => ({
          bcId: s.id,
          slug: s.slug,
          name: s.name,
          atSpot: false,
        })),
      );
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);

  const options = useMemo(() => {
    const atSpotIds = new Set(speciesAtSpot.map((s) => s.id));
    const head: Option[] = speciesAtSpot.map((s) => ({
      bcId: s.id,
      slug: s.slug,
      name: s.name,
      atSpot: true,
    }));
    const tail = (all ?? []).filter((o) => !atSpotIds.has(o.bcId));
    const merged = [...head, ...tail];
    const q = query.trim().toLowerCase();
    return q ? merged.filter((o) => o.name.toLowerCase().includes(q)) : merged;
  }, [speciesAtSpot, all, query]);

  return (
    <div
      ref={panelRef}
      className="absolute z-30 mt-2 w-72 rounded-xl border border-rc-rule bg-rc-panel shadow-rc-panel overflow-hidden"
    >
      <div className="flex items-center gap-2 border-b border-rc-rule px-3 py-2">
        <Search className="w-3.5 h-3.5 text-rc-ink-mute" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search species"
          className="w-full bg-transparent text-sm text-rc-ink placeholder:text-rc-ink-mute focus:outline-none"
        />
      </div>
      <div className="max-h-64 overflow-y-auto py-1">
        {options.length === 0 && (
          <div className="px-3 py-4 text-center text-[13px] text-rc-ink-mute">
            {all === null ? "Loading species…" : "No matches"}
          </div>
        )}
        {options.map((o) => (
          <button
            key={o.bcId}
            type="button"
            onClick={() =>
              onSelect({ bcId: o.bcId, slug: o.slug, name: o.name, confidence: null })
            }
            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-rc-ink hover:bg-rc-surface transition-colors"
          >
            <span>{o.name}</span>
            {o.atSpot && (
              <span className="rc-label text-[8px] text-rc-brand">AT THIS SPOT</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

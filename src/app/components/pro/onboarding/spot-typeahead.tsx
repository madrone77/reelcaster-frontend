"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, MapPin, Search, X } from "lucide-react";
import type { OnboardingSpot } from "@/app/api/onboarding/spots/route";

export type PickedSpot = OnboardingSpot;

/**
 * Compact spot picker for the onboarding wizard — a filter over the published
 * roster from `/api/onboarding/spots`, not the map. A map in a 560px modal is a
 * worse version of /explore; someone who already knows their home water types
 * its name faster than they pan to it, and someone who doesn't should skip this
 * step and go browse the real map.
 *
 * The roster is fetched once and filtered in memory, so matches appear as fast
 * as the angler types. It also sidesteps `/api/search`, which currently returns
 * nothing for every query — see the route comment for why.
 */
export default function SpotTypeahead({
  value,
  onChange,
  provinceFilter,
  autoFocus,
}: {
  value: PickedSpot | null;
  onChange: (spot: PickedSpot | null) => void;
  /** Restrict results to one province code, when the angler has picked one. */
  provinceFilter?: string | null;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [roster, setRoster] = useState<OnboardingSpot[] | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/onboarding/spots")
      .then((r) => (r.ok ? r.json() : { spots: [] }))
      .then((body: { spots?: OnboardingSpot[] }) => {
        if (!cancelled) setRoster(body.spots ?? []);
      })
      .catch(() => {
        if (!cancelled) setRoster([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!roster || q.length < 2) return null;
    const scoped = provinceFilter
      ? roster.filter((s) => s.province === provinceFilter.toUpperCase())
      : roster;
    // A spot whose name starts with the query is almost always the one meant,
    // so those float above mid-word and city-only matches.
    const starts: OnboardingSpot[] = [];
    const contains: OnboardingSpot[] = [];
    for (const s of scoped) {
      const name = s.name.toLowerCase();
      if (name.startsWith(q)) starts.push(s);
      else if (name.includes(q) || s.city.toLowerCase().includes(q))
        contains.push(s);
    }
    return [...starts, ...contains].slice(0, 6);
  }, [query, roster, provinceFilter]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const pick = (spot: OnboardingSpot) => {
    onChange(spot);
    setQuery("");
  };

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-rc-brand bg-rc-brand-soft px-3 py-2.5">
        <MapPin className="w-4 h-4 text-rc-brand shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-rc-ink truncate">
            {value.name}
          </p>
          <p className="text-xs text-rc-ink-soft truncate">
            {value.city}, {value.province}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label={`Clear ${value.name}`}
          className="p-1.5 rounded-full text-rc-ink-mute hover:text-rc-ink hover:bg-white/60 transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!results?.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(results[activeIndex]);
    }
  };

  return (
    <div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-rc-ink-mute pointer-events-none" />
        <input
          type="text"
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search a spot: Pedder Bay, Constance Bank…"
          aria-label="Search for your home spot"
          className="w-full min-h-11 rounded-lg border border-rc-rule bg-white pl-9 pr-9 py-2.5 text-sm text-rc-ink placeholder:text-rc-ink-mute focus:outline-none focus:ring-2 focus:ring-rc-brand focus:border-rc-brand"
        />
        {roster === null && query.trim().length >= 2 && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-rc-ink-mute animate-spin" />
        )}
      </div>

      {results !== null && (
        <ul className="mt-2 rounded-lg border border-rc-rule divide-y divide-rc-rule overflow-hidden">
          {results.length === 0 ? (
            <li className="px-3 py-3 text-sm text-rc-ink-soft">
              No spots match “{query.trim()}”
              {provinceFilter ? ` in ${provinceFilter}` : ""}. Try a nearby bay
              or bank, or skip this and pin one from the map later.
            </li>
          ) : (
            results.map((r, i) => (
              <li key={r.slug}>
                <button
                  type="button"
                  onClick={() => pick(r)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`w-full text-left px-3 py-2.5 transition-colors ${
                    i === activeIndex ? "bg-rc-surface" : "bg-white"
                  }`}
                >
                  <p className="text-sm font-medium text-rc-ink truncate">
                    {r.name}
                  </p>
                  <p className="text-xs text-rc-ink-soft truncate">
                    {r.city}, {r.province}
                  </p>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

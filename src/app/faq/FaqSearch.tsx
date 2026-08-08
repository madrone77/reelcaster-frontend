"use client";

// Client search over the full FAQ set. Renders its `children` (the static
// top-10 + browse-by-topic grid, server-rendered) when the box is empty, and
// live-filtered results when the user types. All matching happens in-memory —
// no network — over a precomputed lowercase haystack.

import { useMemo, useState } from "react";
import { FaqItem } from "./FaqItem";
import { itemSearchText, type FaqItem as FaqItemT } from "./faq-data";

function SearchIcon() {
  return (
    <svg
      className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-rcc-faint"
      width="18"
      height="18"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
    >
      <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.75" />
      <path d="M14 14l3.5 3.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function FaqSearch({
  allItems,
  children,
}: {
  allItems: FaqItemT[];
  children: React.ReactNode;
}) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();

  const index = useMemo(
    () => allItems.map((it) => ({ it, hay: itemSearchText(it) })),
    [allItems],
  );

  const results = useMemo(() => {
    if (!query) return [];
    const terms = query.split(/\s+/).filter(Boolean);
    const match = (pred: (hay: string) => boolean) =>
      index.filter(({ hay }) => pred(hay)).map(({ it }) => it);
    // Prefer items matching every term; if none (e.g. the user mixed two
    // topics), fall back to any-term so the search never dead-ends.
    const strict = match((hay) => terms.every((t) => hay.includes(t)));
    if (strict.length > 0 || terms.length === 1) return strict;
    return match((hay) => terms.some((t) => hay.includes(t)));
  }, [index, query]);

  return (
    <div>
      <div className="relative">
        <SearchIcon />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search questions — e.g. is it free, how the score works"
          aria-label="Search frequently asked questions"
          className="w-full rounded-full border border-rcc-line bg-rcc-surface py-3.5 pl-11 pr-11 text-[15px] text-rcc-ink shadow-sm outline-none transition placeholder:text-rcc-faint focus:border-rcc-brand focus:ring-2 focus:ring-rcc-brand/20"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-rcc-faint transition hover:bg-rcc-bg hover:text-rcc-ink"
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      {query ? (
        <div className="mt-6" aria-live="polite">
          {results.length > 0 ? (
            <>
              <p className="mb-3 text-sm text-rcc-muted">
                {results.length} {results.length === 1 ? "result" : "results"} for &ldquo;{q.trim()}&rdquo;
              </p>
              <div className="space-y-3">
                {results.map((it) => (
                  <FaqItem key={it.id} item={it} showCategory defaultOpen={results.length <= 3} />
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-rcc-line bg-rcc-surface p-8 text-center">
              <p className="font-medium text-rcc-ink">No matches for &ldquo;{q.trim()}&rdquo;</p>
              <p className="mt-1 text-sm text-rcc-muted">
                Try fewer or different words, or clear the search to browse by topic.
              </p>
              <button
                type="button"
                onClick={() => setQ("")}
                className="mt-4 text-sm font-semibold text-rcc-brand hover:underline"
              >
                Clear search
              </button>
            </div>
          )}
        </div>
      ) : (
        children
      )}
    </div>
  );
}

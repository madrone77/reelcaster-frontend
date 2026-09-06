"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  BlueCasterSearchResponse,
  BlueCasterSearchResult,
  SearchKind,
} from "@/lib/bluecaster";

export type SearchResult = BlueCasterSearchResult;

/** Display names per kind. Group ORDER is decided by rank — see groupResults. */
export const SEARCH_GROUPS: { kind: SearchKind; heading: string }[] = [
  { kind: "spot", heading: "Spots" },
  { kind: "city", heading: "Cities" },
  { kind: "region", heading: "Areas" },
];

/** Max rows rendered per group. The ranking decides which ones survive. */
export const PER_GROUP = 6;

const DEBOUNCE_MS = 180;
const MIN_CHARS = 2;

export interface SearchState {
  /** Flat, rank-ordered. Group with `groupResults` for display. */
  results: SearchResult[];
  loading: boolean;
  truncated: boolean;
  /** True once a response for the current query has landed. */
  settled: boolean;
}

/**
 * Split the flat ranked array into display groups, preserving rank order
 * inside each. Groups with no matches are dropped entirely.
 *
 * Groups are ordered by their own best-ranked member, NOT by a fixed kind
 * order. That keeps the server's ranking intact end to end: the overall top
 * match is always the first row, which is what Enter selects. A fixed order
 * would quietly override it — searching "sooke" ranks the *city* highest (it's
 * the broader landing), and pinning Spots to the top would hand Enter a single
 * spot instead.
 */
export function groupResults(
  results: SearchResult[],
): { kind: SearchKind; heading: string; items: SearchResult[] }[] {
  return SEARCH_GROUPS.map(({ kind, heading }) => ({
    kind,
    heading,
    items: results.filter((r) => r.kind === kind).slice(0, PER_GROUP),
  }))
    .filter((g) => g.items.length > 0)
    .sort((a, b) => b.items[0].rank - a.items[0].rank);
}

/**
 * Debounced typeahead against /api/search.
 *
 * Three deliberate behaviours:
 *
 *  - **Previous results are held while a new query is in flight.** Clearing
 *    them on every keystroke makes the dropdown strobe between content and an
 *    empty state; holding them means the list only ever updates to newer, more
 *    specific results.
 *  - **In-flight requests are aborted** when a newer keystroke supersedes them,
 *    so a slow early request can't land after a fast later one and repaint the
 *    dropdown with stale matches.
 *  - **A failed request is not an error state.** The user is mid-word; a
 *    transient blip should leave the last good results up, not replace them
 *    with a failure banner.
 */
export function useSearch(query: string, near?: { lat: number; lng: number }): SearchState {
  const [state, setState] = useState<SearchState>({
    results: [],
    loading: false,
    truncated: false,
    settled: false,
  });

  const abortRef = useRef<AbortController | null>(null);
  // Held in a ref, not a dep: `near` changes on every map pan, and making it a
  // dependency would re-run the search on each frame of a fly-to animation.
  // Tie-breaking wants the centre at the moment of the keystroke, not a live
  // feed.
  const nearRef = useRef(near);
  nearRef.current = near;

  useEffect(() => {
    const q = query.trim();

    if (q.length < MIN_CHARS) {
      abortRef.current?.abort();
      abortRef.current = null;
      setState({ results: [], loading: false, truncated: false, settled: false });
      return;
    }

    setState((s) => ({ ...s, loading: true }));

    const timer = setTimeout(() => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      const params = new URLSearchParams({ q });
      const n = nearRef.current;
      if (n) params.set("near", `${n.lat.toFixed(4)},${n.lng.toFixed(4)}`);

      fetch(`/api/search?${params}`, { signal: ac.signal })
        .then((r) => (r.ok ? (r.json() as Promise<BlueCasterSearchResponse>) : null))
        .then((data) => {
          if (ac.signal.aborted) return;
          setState({
            results: data?.results ?? [],
            loading: false,
            truncated: data?.meta?.truncated ?? false,
            settled: true,
          });
        })
        .catch(() => {
          if (ac.signal.aborted) return; // superseded, not failed
          // Keep whatever is on screen; just stop the spinner.
          setState((s) => ({ ...s, loading: false, settled: true }));
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => () => abortRef.current?.abort(), []);

  return state;
}

/**
 * Flattens the display groups back into the keyboard-navigation order, so
 * arrow keys walk the list exactly as it reads on screen.
 */
export function useFlatNavigation(
  groups: { items: SearchResult[] }[],
): [SearchResult[], number, (i: number) => void, (e: React.KeyboardEvent) => SearchResult | null] {
  const flat = groups.flatMap((g) => g.items);
  const [active, setActive] = useState(0);

  // Any change to the result set resets the cursor to the top match — the old
  // index would point at an unrelated row.
  const key = flat.map((r) => r.id).join(",");
  useEffect(() => setActive(0), [key]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent): SearchResult | null => {
      if (flat.length === 0) return null;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => (i + 1) % flat.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => (i - 1 + flat.length) % flat.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        return flat[active] ?? null;
      }
      return null;
    },
    [flat, active],
  );

  return [flat, active, setActive, onKeyDown];
}

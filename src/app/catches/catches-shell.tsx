"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Plus } from "lucide-react";
import ExploreTopBar from "@/app/explore/components/explore-top-bar";
import { useAuth } from "@/contexts/auth-context";
import { getCatchPhotoSignedUrls } from "@/lib/catch-photo-upload";
import type { CatchLogRow } from "@/lib/catch-log-types";
import StatsRow, { type SeasonStats } from "./components/stats-row";
import SpeciesChips, { type SpeciesChip } from "./components/species-chips";
import CatchToolbar, { type SortKey } from "./components/catch-toolbar";
import CatchRow from "./components/catch-row";
import CatchGridCard from "./components/catch-grid-card";

const PAGE_SIZE = 100;

const SORT_PARAMS: Record<SortKey, { sort: string; order: "asc" | "desc" }> = {
  newest: { sort: "caught_at", order: "desc" },
  oldest: { sort: "caught_at", order: "asc" },
  heaviest: { sort: "weight_kg", order: "desc" },
  longest: { sort: "length_cm", order: "desc" },
  "best-score": { sort: "score", order: "desc" },
};

/**
 * "My catches" — the API-backed catch log list (replaces the old
 * IndexedDB-backed history page). Season stats header, species
 * filter chips, search, sort, grid/list toggle, month-grouped rows.
 */
export default function CatchesShell() {
  const { user, session, loading } = useAuth();

  const [rows, setRows] = useState<CatchLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<SeasonStats | null>(null);
  const [fetching, setFetching] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [speciesFilter, setSpeciesFilter] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [view, setView] = useState<"list" | "grid">("list");

  const [photoUrls, setPhotoUrls] = useState<Map<string, string>>(new Map());
  const seqRef = useRef(0);

  // Debounce the search box → server q param.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const fetchPage = useCallback(
    async (offset: number, append: boolean) => {
      if (!session?.access_token) return;
      const seq = ++seqRef.current;
      if (!append) setFetching(true);
      const { sort: sortCol, order } = SORT_PARAMS[sort];
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
        status: "all",
        sort: sortCol,
        order,
      });
      if (debouncedQuery) params.set("q", debouncedQuery);
      const res = await fetch(`/api/catches?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      if (seq !== seqRef.current) return;
      if (res.ok) {
        const data = (await res.json()) as { catches: CatchLogRow[]; total: number };
        setRows((prev) => (append ? [...prev, ...data.catches] : data.catches));
        setTotal(data.total ?? data.catches.length);
      }
      setFetching(false);
      setLoadingMore(false);
    },
    [session, sort, debouncedQuery],
  );

  useEffect(() => {
    if (!session?.access_token) return;
    fetchPage(0, false);
  }, [session, fetchPage]);

  useEffect(() => {
    if (!session?.access_token) return;
    fetch("/api/catches/stats", {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setStats(d as SeasonStats))
      .catch(() => undefined);
  }, [session]);

  // Batch-sign thumbnails for any rows we haven't signed yet.
  useEffect(() => {
    const missing = rows
      .map((r) => r.photos?.[0])
      .filter((p): p is string => !!p && !photoUrls.has(p));
    if (missing.length === 0) return;
    getCatchPhotoSignedUrls(missing).then((fresh) => {
      if (fresh.size === 0) return;
      setPhotoUrls((prev) => new Map([...prev, ...fresh]));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  // Species chips from the loaded rows.
  const chips: SpeciesChip[] = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const r of rows) {
      const key = r.species_id ?? r.species_name ?? "unknown";
      const label = (r.species_name ?? "Unknown").replace(/ Salmon$/, "");
      const cur = counts.get(key);
      counts.set(key, { label, count: (cur?.count ?? 0) + 1 });
    }
    return [...counts.entries()]
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.count - a.count);
  }, [rows]);

  const visible = useMemo(
    () =>
      speciesFilter
        ? rows.filter((r) => (r.species_id ?? r.species_name ?? "unknown") === speciesFilter)
        : rows,
    [rows, speciesFilter],
  );

  // Month grouping (only meaningful for date sorts).
  const groups = useMemo(() => {
    const grouped: Array<{ label: string; rows: CatchLogRow[] }> = [];
    const byMonth = sort === "newest" || sort === "oldest";
    if (!byMonth) return [{ label: "", rows: visible }];
    for (const r of visible) {
      const label = new Intl.DateTimeFormat("en-US", {
        month: "long",
        year: "numeric",
      })
        .format(new Date(r.caught_at))
        .toUpperCase();
      const last = grouped[grouped.length - 1];
      if (last && last.label === label) last.rows.push(r);
      else grouped.push({ label, rows: [r] });
    }
    return grouped;
  }, [visible, sort]);

  const season = new Date().getFullYear();

  return (
    <div className="min-h-dvh bg-rc-page">
      <ExploreTopBar />
      <main className="pt-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          {!loading && !user ? (
            <SignedOut />
          ) : (
            <>
              {/* Header */}
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="rc-label text-[10px] text-rc-ink-mute">
                    REELCASTER · CATCH LOG
                  </div>
                  <h1 className="mt-1 text-4xl font-bold tracking-[-0.02em] text-rc-ink">
                    My catches
                  </h1>
                  <div className="mt-1 font-rc-mono text-[13px] text-rc-ink-soft">
                    {stats ? `${stats.catches} logged` : "—"} · {season} season
                  </div>
                </div>
                <Link
                  href="/log-catch"
                  className="flex items-center gap-1.5 rounded-xl bg-rc-brand hover:bg-rc-brand-hover px-4 py-2.5 font-semibold text-white transition-colors shrink-0"
                >
                  <Plus className="w-4 h-4" /> Log a catch
                </Link>
              </div>

              {/* Season stats */}
              <div className="mt-6">
                <StatsRow stats={stats} />
              </div>

              {/* Filters */}
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <SpeciesChips
                  chips={chips.slice(0, 6)}
                  total={rows.length}
                  active={speciesFilter}
                  onSelect={setSpeciesFilter}
                />
                <CatchToolbar
                  query={query}
                  onQuery={setQuery}
                  sort={sort}
                  onSort={setSort}
                  view={view}
                  onView={setView}
                />
              </div>

              {/* List */}
              <div className="mt-6">
                {fetching ? (
                  <div className="flex items-center justify-center py-20 text-rc-ink-mute">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : visible.length === 0 ? (
                  <EmptyState searched={!!debouncedQuery || !!speciesFilter} />
                ) : (
                  groups.map((g) => (
                    <div key={g.label || "all"} className="mb-6">
                      {g.label && (
                        <div className="flex items-center gap-3 mb-3">
                          <span className="rc-label text-[10px] text-rc-ink-mute shrink-0">
                            {g.label}
                          </span>
                          <span className="h-px flex-1 bg-rc-rule" />
                        </div>
                      )}
                      {view === "list" ? (
                        <div className="space-y-3">
                          {g.rows.map((r) => (
                            <Link key={r.id} href={`/catches/${r.id}`} className="block">
                              <CatchRow
                                row={r}
                                photoUrl={r.photos?.[0] ? (photoUrls.get(r.photos[0]) ?? null) : null}
                              />
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          {g.rows.map((r) => (
                            <Link key={r.id} href={`/catches/${r.id}`} className="block">
                              <CatchGridCard
                                row={r}
                                photoUrl={r.photos?.[0] ? (photoUrls.get(r.photos[0]) ?? null) : null}
                              />
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}

                {!fetching && rows.length < total && (
                  <div className="text-center">
                    <button
                      type="button"
                      disabled={loadingMore}
                      onClick={() => {
                        setLoadingMore(true);
                        fetchPage(rows.length, true);
                      }}
                      className="rounded-xl border border-rc-rule bg-rc-panel px-5 py-2.5 font-semibold text-rc-ink hover:bg-rc-surface disabled:opacity-50 transition-colors"
                    >
                      {loadingMore ? "Loading…" : `Load more (${total - rows.length})`}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function EmptyState({ searched }: { searched: boolean }) {
  return (
    <div className="rounded-2xl border border-rc-rule bg-rc-panel py-16 text-center">
      <div className="text-lg font-bold text-rc-ink">
        {searched ? "No catches match" : "No catches yet"}
      </div>
      <p className="mt-1 text-sm text-rc-ink-soft">
        {searched
          ? "Try a different search or species filter."
          : "Log your first catch. Drop a photo and we'll do the rest."}
      </p>
      {!searched && (
        <Link
          href="/log-catch"
          className="mt-5 inline-block px-5 py-2.5 rounded-xl bg-rc-brand hover:bg-rc-brand-hover text-white font-semibold transition-colors"
        >
          Log a catch
        </Link>
      )}
    </div>
  );
}

function SignedOut() {
  return (
    <div className="rounded-2xl border border-rc-rule bg-rc-panel p-8 text-center max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-rc-ink">My catches</h1>
      <p className="mt-2 text-sm text-rc-ink-soft">
        Sign in to see your private catch log.
      </p>
      <Link
        href="/login?next=/catches"
        className="mt-5 inline-block px-5 py-2.5 rounded-xl bg-rc-brand hover:bg-rc-brand-hover text-white font-semibold transition-colors"
      >
        Sign in
      </Link>
    </div>
  );
}

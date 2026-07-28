"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  MapPin,
  ChevronRight,
  Bell,
  ScrollText,
  Star,
  Home,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import {
  fetchMyCustomSpots,
  fetchMapSpotsAsViewer,
  type OwnedCustomSpot,
} from "@/lib/bluecaster-client";
import type { MapSpotsPayload } from "@/lib/bluecaster";
import {
  tierFor,
  TIER_PILL,
  railSpotFromEntry,
  type RailSpot,
} from "@/app/explore/lib/explore-data";
import { readHomeSpot } from "@/app/explore/lib/use-home-spot";
import SpotCard from "@/app/explore/components/spot-card";

// The whole covered extent — favourites can live anywhere in it.
const COVERED_BBOX_ALL = "-139.06,41.99,-114.03,60";

/**
 * "victoria-waterfront-ad3f9b" → "Victoria Waterfront" — last-resort label for
 * a favourited slug the API didn't return (unscored, or outside the payload).
 *
 * The trailing id is stripped by shape, not by charset: custom-spot slugs end
 * in a base36 millisecond stamp ("lingcod-honey-hole-ms20jgs9"), which a
 * hex-only rule missed and title-cased into the name. Any short trailing token
 * carrying a digit is an id — real words don't have digits in them.
 */
function prettify(slug: string): string {
  return slug
    .replace(/-(?=[a-z0-9]*\d)[a-z0-9]{5,10}$/i, "")
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const NO_CONDITIONS = {
  wind: null,
  sea: null,
  tide: null,
  current: null,
  sky: null,
  air: null,
};

/**
 * A card for a spot the map payload didn't carry — a custom spot still waiting
 * on its first score, or a favourite that has since gone unpublished. Renders
 * as the same card, just with "NO SCORE" and empty KPIs.
 */
function unscoredRailSpot(
  slug: string,
  name: string,
  extra: Partial<RailSpot> = {},
): RailSpot {
  return {
    id: slug,
    slug,
    name,
    lat: 0,
    lng: 0,
    citySlug: "",
    cityName: "",
    regionSlug: "",
    regionName: "",
    provinceCode: "",
    score: null,
    bestSpeciesId: null,
    driverSpecies: null,
    peakHour: null,
    distanceKm: null,
    conditions: NO_CONDITIONS,
    condStrip: null,
    hours24: new Array(24).fill(null),
    scoresBySpecies: {},
    ...extra,
  };
}

function firstName(email: string | null | undefined): string | null {
  if (!email) return null;
  const local = email.split("@")[0]?.replace(/[._-]+/g, " ").trim();
  if (!local) return null;
  return local.charAt(0).toUpperCase() + local.slice(1);
}

function todayVancouver(): string {
  // en-CA renders YYYY-MM-DD.
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Vancouver" });
}

type TopSpot = { slug: string; name: string; score: number; species: string | null };

/**
 * Logged-in home / dashboard — the angler's saved + custom spots, today's
 * scores, and quick access to alerts and regulation changes. Auth-gated by the
 * global AuthGate (this route isn't in the public allowlist).
 */
export default function DashboardPage() {
  const { user } = useAuth();
  const [custom, setCustom] = useState<OwnedCustomSpot[] | null>(null);
  const [favSlugs, setFavSlugs] = useState<string[] | null>(null);
  // Today's map payload — the same numbers Explore builds its cards from.
  const [payload, setPayload] = useState<MapSpotsPayload | null>(null);

  // Custom spots (owner-scoped backend fetch).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchMyCustomSpots()
      .then((rows) => {
        if (!cancelled) setCustom(rows);
      })
      .catch(() => {
        if (!cancelled) setCustom([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Favourites (localStorage rc-fav:<slug>).
  useEffect(() => {
    try {
      const out: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith("rc-fav:") && localStorage.getItem(k) === "1") {
          out.push(k.slice("rc-fav:".length));
        }
      }
      setFavSlugs(out);
    } catch {
      setFavSlugs([]);
    }
  }, []);

  // Today's scores + conditions across the covered extent — the viewer's own
  // custom spots ride along. Degrades silently if unavailable.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchMapSpotsAsViewer(COVERED_BBOX_ALL, todayVancouver())
      .then((p) => {
        if (!cancelled && p?.spots) setPayload(p);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

  // The designated home spot (localStorage), if the angler has pinned one.
  const [homeSlug, setHomeSlug] = useState<string | null>(null);
  useEffect(() => {
    const sync = () => setHomeSlug(readHomeSpot());
    sync();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "rc-home-spot" || e.key === null) sync();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const name = firstName(user?.email);

  // Every spot in today's payload as an Explore rail spot, keyed by slug.
  // Names come from here, never from the slug: a custom spot's slug carries a
  // generated id suffix that has no business showing up in a card title.
  const railBySlug = useMemo(() => {
    const out = new Map<string, RailSpot>();
    if (!payload) return out;
    for (const entry of payload.spots) {
      out.set(entry.slug, railSpotFromEntry(entry, payload, true));
    }
    return out;
  }, [payload]);

  // CREATED — spots this angler built. Ownership metadata (name, visibility)
  // is authoritative from the owner-scoped fetch; scores and conditions come
  // from the payload once the spot has been scored.
  const created: RailSpot[] | null = useMemo(() => {
    if (custom === null) return null;
    return custom.map((c) => {
      const rail =
        railBySlug.get(c.slug) ??
        unscoredRailSpot(c.slug, c.name, {
          id: c.id,
          lat: c.lat,
          lng: c.lng,
          score: c.score_status === "scored" ? c.score : null,
          driverSpecies: c.best_species_name,
        });
      return { ...rail, name: c.name, isCustom: true, visibility: c.visibility };
    });
  }, [custom, railBySlug]);

  // SAVED — spots hearted from the map. Custom spots are auto-favourited on
  // create, so anything already in CREATED is dropped here rather than listed
  // twice under two different headings.
  const saved: RailSpot[] | null = useMemo(() => {
    if (favSlugs === null) return null;
    const createdSlugs = new Set((created ?? []).map((s) => s.slug));
    return favSlugs
      .filter((slug) => !createdSlugs.has(slug))
      .map((slug) => railBySlug.get(slug) ?? unscoredRailSpot(slug, prettify(slug)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [favSlugs, created, railBySlug]);

  // Top spot = highest live score across custom + favourites.
  const topSpot: TopSpot | null = useMemo(() => {
    const pool: TopSpot[] = [];
    for (const s of [...(created ?? []), ...(saved ?? [])]) {
      if (typeof s.score === "number") {
        pool.push({
          slug: s.slug,
          name: s.name,
          score: s.score,
          species: s.driverSpecies,
        });
      }
    }
    if (pool.length === 0) return null;
    return pool.sort((a, b) => b.score - a.score)[0];
  }, [created, saved]);

  // The hero: the designated home spot if the angler pinned one, else today's
  // top scorer.
  type Hero = {
    slug: string;
    name: string;
    score: number | null;
    species: string | null;
    isHome: boolean;
  };
  const heroSpot: Hero | null = (() => {
    if (homeSlug) {
      const home =
        (created ?? []).find((x) => x.slug === homeSlug) ??
        (saved ?? []).find((x) => x.slug === homeSlug) ??
        railBySlug.get(homeSlug);
      return {
        slug: homeSlug,
        name: home?.name ?? prettify(homeSlug),
        score: home?.score ?? null,
        species: home?.driverSpecies ?? null,
        isHome: true,
      };
    }
    return topSpot ? { ...topSpot, isHome: false } : null;
  })();

  const customCount = created?.length ?? 0;
  const favCount = saved?.length ?? 0;

  return (
    <div className="min-h-dvh bg-rc-page">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="bg-rc-panel border-b border-rc-rule">
        <div className="max-w-2xl mx-auto px-5 pt-10 pb-6">
          <p className="font-rc-mono text-[10px] uppercase tracking-[0.16em] text-rc-ink-mute">
            Your dashboard
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.02em] text-rc-ink">
            {name ? `Welcome back, ${name}` : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-rc-ink-soft">
            Your spots, today’s scores, and alerts — all in one place.
          </p>

          {/* Quick counts. */}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 font-rc-mono text-[11px] text-rc-ink-mute">
            <span>
              <span className="font-bold text-rc-ink">{customCount}</span> created
            </span>
            <span className="text-rc-rule">·</span>
            <span>
              <span className="font-bold text-rc-ink">{favCount}</span> saved
            </span>
            <span className="text-rc-rule">·</span>
            <Link href="/alerts" className="text-rc-brand hover:underline">
              Alerts
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-6 space-y-8">
        {/* ── Hero: home spot (if pinned) or today's top scorer ────────── */}
        {heroSpot && (
          <section>
            <div className="mb-3 flex items-center gap-1.5">
              {heroSpot.isHome ? (
                <Home className="h-4 w-4 text-rc-brand" />
              ) : (
                <Star className="h-4 w-4 text-rc-brand" />
              )}
              <h2 className="font-rc-mono text-[11px] uppercase tracking-[0.12em] text-rc-ink-mute">
                {heroSpot.isHome ? "Home spot" : "Your top spot right now"}
              </h2>
            </div>
            <Link
              href={`/explore/spot/${heroSpot.slug}`}
              className="block rounded-2xl border border-rc-rule bg-rc-panel p-5 shadow-rc-panel transition-colors hover:border-rc-brand/40"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  {heroSpot.species && (
                    <span className="inline-block rounded bg-rc-brand-soft px-2 py-0.5 font-rc-mono text-[10px] font-bold uppercase tracking-[0.1em] text-rc-brand">
                      {heroSpot.species}
                    </span>
                  )}
                  <h3 className="mt-2 truncate text-xl font-black tracking-[-0.01em] text-rc-ink">
                    {heroSpot.name}
                  </h3>
                  <p className="mt-1 font-rc-mono text-[11px] text-rc-ink-mute">
                    {heroSpot.isHome
                      ? "Your pinned home spot"
                      : "Best score across your spots today"}
                  </p>
                </div>
                <div className="shrink-0 text-center">
                  {typeof heroSpot.score === "number" ? (
                    <>
                      <div
                        className={`text-4xl font-black leading-none tabular-nums ${
                          tierFor(heroSpot.score) === "good"
                            ? "text-rc-good"
                            : tierFor(heroSpot.score) === "fair"
                              ? "text-rc-fair"
                              : "text-rc-poor"
                        }`}
                      >
                        {heroSpot.score}
                      </div>
                      <span
                        className={`mt-2 inline-block rounded px-2 py-0.5 font-rc-mono text-[10px] font-bold uppercase ${TIER_PILL[tierFor(heroSpot.score)]}`}
                      >
                        {tierFor(heroSpot.score)}
                      </span>
                    </>
                  ) : (
                    <span className="font-rc-mono text-[11px] text-rc-ink-mute">
                      No score yet
                    </span>
                  )}
                </div>
              </div>
            </Link>
          </section>
        )}

        {/* ── Your Spots: created + saved ──────────────────────────────── */}
        <section>
          <h2 className="mb-3 text-lg font-bold text-rc-ink">Your Spots</h2>

          {created === null && saved === null ? (
            <SkeletonRows />
          ) : customCount === 0 && favCount === 0 ? (
            <EmptyCard
              icon={<MapPin className="w-8 h-8 text-rc-ink-mute mx-auto mb-3" />}
              title="No spots yet"
              body="Create a custom spot on the map, or tap the heart on any spot to save it here."
              cta="Explore the map"
              href="/explore"
            />
          ) : (
            <div className="space-y-6">
              {/* CREATED — spots the angler built (edit/delete). Leads because
                  ownership outranks a bookmark. */}
              {created && created.length > 0 && (
                <div>
                  <p className="mb-2.5 font-rc-mono text-[11px] uppercase tracking-[0.12em] text-rc-ink-mute">
                    Created · {created.length}
                  </p>
                  <ul className="grid gap-2.5 sm:grid-cols-2">
                    {created.map((spot) => (
                      <li key={spot.id}>
                        <SpotCard spot={spot} showVisibility />
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* SAVED — spots the angler hearted from the map. Un-starring a
                  card here drops it from the list on the spot. */}
              {saved && saved.length > 0 && (
                <div>
                  <div className="mb-2.5 flex items-center justify-between">
                    <p className="font-rc-mono text-[11px] uppercase tracking-[0.12em] text-rc-ink-mute">
                      Saved · {saved.length}
                    </p>
                    <Link
                      href="/favorites"
                      className="font-rc-mono text-[11px] text-rc-brand hover:underline"
                    >
                      View all
                    </Link>
                  </div>
                  <ul className="grid gap-2.5 sm:grid-cols-2">
                    {saved.map((spot) => (
                      <li key={spot.slug}>
                        <SpotCard
                          spot={spot}
                          onFavoriteChange={(fav) => {
                            if (!fav) {
                              setFavSlugs((prev) =>
                                (prev ?? []).filter((s) => s !== spot.slug),
                              );
                            }
                          }}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── Stay in the loop: alerts + regulation changes ────────────── */}
        <section>
          <h2 className="mb-3 text-lg font-bold text-rc-ink">Stay in the loop</h2>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <LinkCard
              href="/alerts"
              icon={<Bell className="h-5 w-5 text-rc-brand" />}
              title="Custom alerts"
              body="Get emailed when a spot hits your conditions."
            />
            <LinkCard
              href="/profile/notification-settings"
              icon={<ScrollText className="h-5 w-5 text-rc-brand" />}
              title="Regulations & notifications"
              body="DFO openings, closures, and what you hear about."
            />
          </div>
        </section>
      </main>
    </div>
  );
}

// ── bits ────────────────────────────────────────────────────────────────────

function LinkCard({
  href,
  icon,
  title,
  body,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-3 rounded-xl border border-rc-rule bg-rc-panel p-4 transition-colors hover:border-rc-brand/40"
    >
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rc-brand-soft">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-rc-ink">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-rc-ink-soft">
          {body}
        </span>
      </span>
      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-rc-ink-mute" />
    </Link>
  );
}

function SkeletonRows() {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-[132px] rounded border-2 border-rc-rule bg-rc-surface animate-pulse"
        />
      ))}
    </div>
  );
}

function EmptyCard({
  icon,
  title,
  body,
  cta,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  cta: string;
  href: string;
}) {
  return (
    <div className="rounded-xl border border-rc-rule bg-rc-panel p-8 text-center">
      {icon}
      <p className="text-base font-semibold text-rc-ink mb-1">{title}</p>
      <p className="text-sm text-rc-ink-soft mb-5 max-w-sm mx-auto">{body}</p>
      <Link
        href={href}
        className="inline-flex items-center gap-2 rounded-lg bg-rc-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-rc-brand-hover transition-colors"
      >
        <MapPin className="w-4 h-4" />
        {cta}
      </Link>
    </div>
  );
}

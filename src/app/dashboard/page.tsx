"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  MapPin,
  ChevronRight,
  Lock,
  Globe,
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
import { tierFor, TIER_PILL } from "@/app/explore/lib/explore-data";
import { readHomeSpot } from "@/app/explore/lib/use-home-spot";

// The whole covered extent — favourites can live anywhere in it.
const COVERED_BBOX_ALL = "-139.06,41.99,-114.03,60";

// "victoria-waterfront-ad3f9b" → "Victoria Waterfront" (strip id suffix, title-case).
function prettify(slug: string): string {
  return slug
    .replace(/-[0-9a-f]{5,}$/i, "")
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
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

type Scored = { score: number; species: string | null };
type Fav = { slug: string; name: string; score: number | null; species: string | null };
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
  // slug → today's best score, for enriching favourites + finding the top spot.
  const [scoreBySlug, setScoreBySlug] = useState<Record<string, Scored>>({});

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
      out.sort((a, b) => prettify(a).localeCompare(prettify(b)));
      setFavSlugs(out);
    } catch {
      setFavSlugs([]);
    }
  }, []);

  // Today's scores across the covered extent — used to put a live score on each
  // favourite and to pick the top spot. Degrades silently if unavailable.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchMapSpotsAsViewer(COVERED_BBOX_ALL, todayVancouver())
      .then((payload) => {
        if (cancelled || !payload?.spots) return;
        const species = payload.species ?? {};
        const map: Record<string, Scored> = {};
        for (const s of payload.spots) {
          let best = 0;
          let bestId: string | null = null;
          for (const [id, strip] of Object.entries(s.scores ?? {})) {
            const peak = (strip as { peak?: number })?.peak;
            if (typeof peak === "number" && peak > best) {
              best = peak;
              bestId = id;
            }
          }
          if (best > 0) {
            map[s.slug] = {
              score: Math.round(best * 100),
              species: (bestId && species[bestId]?.name) || null,
            };
          }
        }
        setScoreBySlug(map);
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

  // Favourites enriched with today's score.
  const favs: Fav[] | null =
    favSlugs === null
      ? null
      : favSlugs.map((slug) => ({
          slug,
          name: prettify(slug),
          score: scoreBySlug[slug]?.score ?? null,
          species: scoreBySlug[slug]?.species ?? null,
        }));

  // Top spot = highest live score across custom + favourites.
  const topSpot: TopSpot | null = (() => {
    const pool: TopSpot[] = [];
    for (const c of custom ?? []) {
      if (c.score_status === "scored" && typeof c.score === "number") {
        pool.push({ slug: c.slug, name: c.name, score: c.score, species: c.best_species_name ?? null });
      }
    }
    for (const f of favs ?? []) {
      if (typeof f.score === "number") {
        pool.push({ slug: f.slug, name: f.name, score: f.score, species: f.species });
      }
    }
    if (pool.length === 0) return null;
    return pool.sort((a, b) => b.score - a.score)[0];
  })();

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
      const c = (custom ?? []).find((x) => x.slug === homeSlug);
      const f = (favs ?? []).find((x) => x.slug === homeSlug);
      const sc = scoreBySlug[homeSlug];
      const score =
        (c && typeof c.score === "number" ? c.score : null) ??
        (f && typeof f.score === "number" ? f.score : null) ??
        (sc ? sc.score : null);
      return {
        slug: homeSlug,
        name: c?.name ?? f?.name ?? prettify(homeSlug),
        score,
        species: c?.best_species_name ?? f?.species ?? sc?.species ?? null,
        isHome: true,
      };
    }
    return topSpot ? { ...topSpot, isHome: false } : null;
  })();

  const customCount = custom?.length ?? 0;
  const favCount = favSlugs?.length ?? 0;

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

          {custom === null && favs === null ? (
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
              {custom && custom.length > 0 && (
                <div>
                  <p className="mb-2.5 font-rc-mono text-[11px] uppercase tracking-[0.12em] text-rc-ink-mute">
                    Created · {custom.length}
                  </p>
                  <ul className="space-y-2.5">
                    {custom.map((spot) => (
                      <li key={spot.id}>
                        <Link
                          href={`/explore/spot/${spot.slug}`}
                          className="flex items-center gap-3 rounded-xl border border-rc-rule bg-rc-panel px-4 py-3.5 transition-colors hover:border-rc-brand/40"
                        >
                          <ScoreChip score={spot.score} status={spot.score_status} />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              <span className="truncate text-sm font-semibold text-rc-ink">
                                {spot.name}
                              </span>
                              <VisibilityTag visibility={spot.visibility} />
                            </span>
                            <span className="mt-0.5 block font-rc-mono text-[11px] text-rc-ink-mute">
                              {spot.score_status === "pending"
                                ? "Scoring soon — new spot"
                                : spot.best_species_name
                                  ? `Best: ${spot.best_species_name}`
                                  : "Your custom spot"}
                            </span>
                          </span>
                          <ChevronRight className="w-4 h-4 shrink-0 text-rc-ink-mute" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* SAVED — spots the angler hearted from the map. */}
              {favs && favs.length > 0 && (
                <div>
                  <div className="mb-2.5 flex items-center justify-between">
                    <p className="font-rc-mono text-[11px] uppercase tracking-[0.12em] text-rc-ink-mute">
                      Saved · {favs.length}
                    </p>
                    <Link
                      href="/favorites"
                      className="font-rc-mono text-[11px] text-rc-brand hover:underline"
                    >
                      View all
                    </Link>
                  </div>
                  <ul className="space-y-2.5">
                    {favs.map((fav) => (
                      <li key={fav.slug}>
                        <Link
                          href={`/explore/spot/${fav.slug}`}
                          className="flex items-center gap-3 rounded-xl border border-rc-rule bg-rc-panel px-4 py-3.5 transition-colors hover:border-rc-brand/40"
                        >
                          <ScoreChip score={fav.score} status={fav.score === null ? "pending" : "scored"} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-rc-ink">
                              {fav.name}
                            </span>
                            <span className="mt-0.5 block font-rc-mono text-[11px] text-rc-ink-mute">
                              {fav.species ? `Best: ${fav.species}` : "Saved spot"}
                            </span>
                          </span>
                          <ChevronRight className="w-4 h-4 shrink-0 text-rc-ink-mute" />
                        </Link>
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

function ScoreChip({
  score,
  status,
}: {
  score: number | null;
  status: "scored" | "pending";
}) {
  if (status === "pending" || score === null) {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rc-surface text-rc-ink-mute">
        <MapPin className="w-4 h-4" />
      </span>
    );
  }
  const tier = tierFor(score);
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-rc-mono text-[13px] font-bold ${TIER_PILL[tier]}`}
    >
      {score}
    </span>
  );
}

function VisibilityTag({ visibility }: { visibility: "private" | "public" }) {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-rc-surface px-1.5 py-0.5 font-rc-mono text-[9px] uppercase tracking-[0.06em] text-rc-ink-mute">
      {visibility === "private" ? (
        <Lock className="w-2.5 h-2.5" />
      ) : (
        <Globe className="w-2.5 h-2.5" />
      )}
      {visibility}
    </span>
  );
}

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
    <div className="space-y-2.5">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-16 rounded-xl border border-rc-rule bg-rc-surface animate-pulse"
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

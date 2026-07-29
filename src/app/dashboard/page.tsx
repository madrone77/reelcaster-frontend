"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Lock, Home, Plus } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import {
  fetchMyCustomSpots,
  fetchMapSpotsAsViewer,
  fetchSpotLive,
  type OwnedCustomSpot,
} from "@/lib/bluecaster-client";
import { TIER_PILL, tierFor } from "@/app/explore/lib/explore-data";
import { readHomeSpot } from "@/app/explore/lib/use-home-spot";
import type { AlertProfile } from "@/lib/custom-alert-engine";
import type { SpotPageInitial } from "@/lib/bluecaster/live-spot-types";

// The whole covered extent — favourites can live anywhere in it.
const COVERED_BBOX_ALL = "-139.06,41.99,-114.03,60";

// ── tier + formatting helpers ───────────────────────────────────────────────
const TIER = {
  good: { line: "#16A34A", fill: "#DCFCE7" },
  fair: { line: "#D78711", fill: "#FEF3E2" },
  poor: { line: "#DC2626", fill: "#FEE2E2" },
} as const;
type Tier = keyof typeof TIER;
const tierOf = (s: number): Tier => (s >= 75 ? "good" : s >= 55 ? "fair" : "poor");

// "victoria-waterfront-ad3f9b" → "Victoria Waterfront" (strip id suffix, title-case).
function prettify(slug: string): string {
  return slug
    .replace(/-(?=[a-z0-9]*\d)[a-z0-9]{5,10}$/i, "")
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
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Vancouver" });
}

function longDate(): string {
  return new Date().toLocaleDateString("en-US", {
    timeZone: "America/Vancouver",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function relTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 60) return mins <= 1 ? "just now" : `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

function kgToLb(kg: number | null | undefined): number | null {
  if (typeof kg !== "number") return null;
  return Math.round(kg * 2.2046);
}

function seaState(waveM: number | null | undefined): string | null {
  if (typeof waveM !== "number") return null;
  if (waveM < 0.3) return "Calm";
  if (waveM < 0.6) return "Light chop";
  if (waveM < 1.2) return "Moderate";
  return "Rough";
}

type Scored = { score: number; species: string | null };
type SpotCard = {
  slug: string;
  name: string;
  score: number | null;
  species: string | null;
  tag: "home" | "private" | null;
};
type CatchRow = {
  species_name?: string | null;
  weight_kg?: number | null;
  location_name?: string | null;
  caught_at: string;
};

/**
 * Logged-in home / dashboard — the angler's saved + custom spots with today's
 * scores, a pinned home-spot hero, and a rail of alerts, fresh catches, and
 * regulation changes. Auth-gated by the global AuthGate.
 */
export default function DashboardPage() {
  const { user, session } = useAuth();
  const [custom, setCustom] = useState<OwnedCustomSpot[] | null>(null);
  const [favSlugs, setFavSlugs] = useState<string[] | null>(null);
  const [scoreBySlug, setScoreBySlug] = useState<Record<string, Scored>>({});
  const [homeSlug, setHomeSlug] = useState<string | null>(null);
  const [homeLive, setHomeLive] = useState<SpotPageInitial | null>(null);
  const [alerts, setAlerts] = useState<AlertProfile[] | null>(null);
  const [catches, setCatches] = useState<CatchRow[] | null>(null);
  const [catchTotal, setCatchTotal] = useState<number | null>(null);

  // Custom spots (owner-scoped).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchMyCustomSpots()
      .then((rows) => !cancelled && setCustom(rows))
      .catch(() => !cancelled && setCustom([]));
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

  // Today's best score per spot across the covered extent.
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

  // Pinned home spot (localStorage).
  useEffect(() => {
    const sync = () => setHomeSlug(readHomeSpot());
    sync();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "rc-home-spot" || e.key === null) sync();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Home-spot live payload — powers the hero conditions, sparkline, and the
  // regulations rail (the spot's own DFO regs). Degrades to null.
  useEffect(() => {
    if (!homeSlug) {
      setHomeLive(null);
      return;
    }
    let cancelled = false;
    fetchSpotLive(homeSlug)
      .then((p) => !cancelled && setHomeLive(p))
      .catch(() => !cancelled && setHomeLive(null));
    return () => {
      cancelled = true;
    };
  }, [homeSlug]);

  // Custom alerts (owner-scoped, token-authed).
  useEffect(() => {
    const token = session?.access_token;
    if (!token) return;
    let cancelled = false;
    fetch("/api/alerts", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => !cancelled && setAlerts(data?.profiles ?? []))
      .catch(() => !cancelled && setAlerts([]));
    return () => {
      cancelled = true;
    };
  }, [session]);

  // Fresh catches — the angler's own catch log, last 14 days.
  useEffect(() => {
    const token = session?.access_token;
    if (!token) return;
    let cancelled = false;
    const since = new Date(Date.now() - 14 * 86400000).toISOString();
    const qs = new URLSearchParams({
      sort: "caught_at",
      order: "desc",
      limit: "3",
      start_date: since,
    });
    fetch(`/api/catches?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        setCatches(data?.catches ?? []);
        setCatchTotal(typeof data?.total === "number" ? data.total : null);
      })
      .catch(() => {
        if (!cancelled) {
          setCatches([]);
          setCatchTotal(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  // The spots shown in the grid — custom (private) + favourites, deduped,
  // scored, tagged, ranked by score. Home spot floats via its tag, not order.
  const spotCards: SpotCard[] | null = useMemo(() => {
    if (custom === null || favSlugs === null) return null;
    const bySlug = new Map<string, SpotCard>();
    for (const c of custom) {
      const score = scoreBySlug[c.slug]?.score ?? (typeof c.score === "number" ? c.score : null);
      bySlug.set(c.slug, {
        slug: c.slug,
        name: c.name,
        score,
        species: c.best_species_name ?? scoreBySlug[c.slug]?.species ?? null,
        tag: c.slug === homeSlug ? "home" : "private",
      });
    }
    for (const slug of favSlugs) {
      if (bySlug.has(slug)) continue;
      bySlug.set(slug, {
        slug,
        name: prettify(slug),
        score: scoreBySlug[slug]?.score ?? null,
        species: scoreBySlug[slug]?.species ?? null,
        tag: slug === homeSlug ? "home" : null,
      });
    }
    return [...bySlug.values()].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  }, [custom, favSlugs, scoreBySlug, homeSlug]);

  // ── derived ────────────────────────────────────────────────────────────────
  const activeAlertCount = (alerts ?? []).filter((a) => a.is_active).length;
  const trackedCount = spotCards?.length ?? 0;

  const name = (() => {
    const m = (user?.user_metadata ?? {}) as Record<string, unknown>;
    const raw = m.given_name ?? m.first_name ?? m.name ?? m.full_name;
    if (typeof raw === "string" && raw.trim()) return raw.trim().split(/\s+/)[0];
    return firstName(user?.email);
  })();

  const scored = (spotCards ?? []).filter(
    (s): s is SpotCard & { score: number } => typeof s.score === "number"
  );
  const spotsHot = scored.filter((s) => s.score >= 80).length;
  const topScore = scored.length ? Math.max(...scored.map((s) => s.score)) : null;
  const avgScore = scored.length
    ? Math.round(scored.reduce((a, s) => a + s.score, 0) / scored.length)
    : null;

  const spotsLoading = spotCards === null;
  const homeCard = spotCards?.find((s) => s.slug === homeSlug) ?? null;
  const rn = homeLive?.rightNow ?? null;

  // Regulations rail — a restrictive reg on the home spot, if any.
  const restrictiveReg = (homeLive?.regulations ?? []).find(
    (r) => r.status !== "Open" || r.nextOpenDate
  );

  // Alert rail — the first (active-preferred) alert, with pts-away if we can
  // resolve its spot's current score.
  const watchAlert =
    (alerts ?? []).find((a) => a.is_active) ?? (alerts ?? [])[0] ?? null;
  const watchCurrent = (() => {
    if (!watchAlert?.location_name) return null;
    const hit = Object.entries(scoreBySlug).find(
      ([slug]) => prettify(slug) === watchAlert.location_name
    );
    return hit ? hit[1].score : null;
  })();
  const ptsAway =
    watchAlert?.score_threshold != null && watchCurrent != null
      ? watchAlert.score_threshold - watchCurrent
      : null;

  const customCount = custom?.length ?? 0;
  const favCount = favSlugs?.length ?? 0;

  return (
    <div className="min-h-dvh bg-rc-page">
      <div className="mx-auto max-w-[1400px] px-5 py-8 lg:px-10 lg:py-10">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="font-rc-mono text-[10px] uppercase tracking-[0.16em] text-rc-ink-mute">
              Your dashboard
            </p>
            <h1 className="mt-1.5 text-3xl font-black tracking-[-0.02em] text-rc-ink">
              {name ? `Welcome back, ${name}` : "Welcome back"}
            </h1>
            <p className="mt-1.5 font-rc-mono text-[12px] text-rc-ink-mute">
              {longDate()} · {trackedCount} spot{trackedCount === 1 ? "" : "s"}{" "}
              tracked · {activeAlertCount} alert
              {activeAlertCount === 1 ? "" : "s"} armed
            </p>
          </div>
          <div className="flex items-start gap-5 divide-x divide-rc-rule sm:gap-6">
            <Stat n={spotsHot != null ? String(spotsHot) : "—"} label="Spots ≥ 80" tone="good" />
            <Stat n={topScore != null ? String(topScore) : "—"} label="Top score" tone="good" pad />
            <Stat
              n={catchTotal != null ? String(catchTotal) : "—"}
              label="Fresh catches"
              tone="good"
              pad
            />
            <Stat n={avgScore != null ? String(avgScore) : "—"} label="Avg score" pad />
          </div>
        </header>

        {/* ── Two-column body ────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
          {/* LEFT — hero + spots */}
          <div>
            {spotsLoading && homeSlug ? (
              <div className="h-[188px] animate-pulse rounded bg-rc-navy/90" />
            ) : homeCard ? (
              <Link
                href={`/explore/spot/${homeCard.slug}`}
                className="block rounded bg-rc-navy p-6 text-white transition-transform hover:-translate-y-0.5"
              >
                <div className="flex flex-col gap-6 md:flex-row md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 font-rc-mono text-[11px] uppercase tracking-[0.14em] text-white/60">
                      <Home className="h-3.5 w-3.5" />
                      Home spot
                    </div>
                    <h2 className="mt-2 text-3xl font-black tracking-[-0.02em]">
                      {homeCard.name}
                    </h2>
                    {homeCard.species && (
                      <span className="mt-2 inline-block rounded bg-white/10 px-2 py-1 font-rc-mono text-[10px] font-bold uppercase tracking-[0.1em] text-white/80">
                        {homeCard.species}
                      </span>
                    )}
                    {rn && (
                      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                        <HeroStat
                          k="Tide"
                          v={
                            rn.tideM != null
                              ? `${rn.tideM.toFixed(1)} m${
                                  rn.tideTrend === "rising"
                                    ? " ↑"
                                    : rn.tideTrend === "falling"
                                      ? " ↓"
                                      : ""
                                }`
                              : null
                          }
                        />
                        <HeroStat
                          k="Wind"
                          v={
                            rn.windKt != null
                              ? `${Math.round(rn.windKt)} kn${rn.windDir ? ` ${rn.windDir}` : ""}`
                              : null
                          }
                        />
                        <HeroStat
                          k="Water"
                          v={rn.seaTempC != null ? `${rn.seaTempC.toFixed(1)} °C` : null}
                        />
                        <HeroStat k="Sea" v={seaState(rn.waveM)} />
                      </div>
                    )}
                    {rn?.tideTrend && (
                      <div className="mt-5 flex items-center gap-2 font-rc-mono text-[11px] text-rc-good">
                        <span className="h-1.5 w-1.5 rounded-full bg-rc-good" />
                        {rn.tideTrend === "rising" ? "FLOOD TIDE · WATER RISING" : "EBB TIDE · WATER FALLING"}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-row items-start justify-between gap-4 md:w-[210px] md:flex-col md:items-end md:border-l md:border-white/10 md:pl-6">
                    <div className="text-right">
                      <div className="text-5xl font-black leading-none tabular-nums">
                        {homeCard.score ?? "—"}
                      </div>
                      {homeCard.score != null && (
                        <span
                          className="mt-2 inline-block rounded px-2 py-0.5 font-rc-mono text-[10px] font-bold uppercase"
                          style={{
                            background: TIER[tierOf(homeCard.score)].fill,
                            color: TIER[tierOf(homeCard.score)].line,
                          }}
                        >
                          {tierOf(homeCard.score)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ) : (
              <Link
                href="/explore"
                className="flex items-center justify-between rounded border-2 border-dashed border-rc-rule bg-rc-panel px-6 py-8 text-rc-ink-soft transition-colors hover:border-rc-brand/40"
              >
                <span className="flex items-center gap-3">
                  <Home className="h-5 w-5 text-rc-ink-mute" />
                  <span className="text-sm">
                    Pin a home spot for daily conditions at a glance
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 text-rc-ink-mute" />
              </Link>
            )}

            {/* Your spots */}
            <div className="mb-3 mt-8 flex items-center justify-between">
              <div className="flex items-baseline gap-3">
                <h2 className="text-lg font-bold text-rc-ink">Your spots</h2>
                <span className="font-rc-mono text-[11px] text-rc-ink-mute">
                  {customCount} created · {favCount} saved
                </span>
              </div>
              <Link
                href="/explore?create=1"
                className="inline-flex h-8 items-center gap-1.5 rounded bg-rc-brand px-3 text-sm font-normal text-white transition-colors hover:bg-rc-brand-hover"
              >
                <Plus className="h-4 w-4" />
                New spot
              </Link>
            </div>

            {spotsLoading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="h-40 animate-pulse rounded border-2 border-rc-rule bg-rc-surface"
                  />
                ))}
              </div>
            ) : spotCards && spotCards.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {spotCards.map((s) => {
                  const key = s.score != null ? tierFor(s.score) : "none";
                  return (
                    <Link
                      key={s.slug}
                      href={`/explore/spot/${s.slug}`}
                      className="block rounded border-2 border-rc-rule bg-rc-panel px-4 py-3.5 transition-colors hover:bg-rc-surface"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="truncate text-[15px] font-medium text-rc-ink">
                          {s.name}
                        </span>
                        <Pill className={TIER_PILL[key]}>
                          {s.score != null
                            ? `${s.score} ${key.toUpperCase()}`
                            : "NO SCORE"}
                        </Pill>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5">
                        {s.tag === "home" ? (
                          <span className="rc-label text-[9px] shrink-0 rounded bg-rc-brand-soft px-1.5 py-0.5 text-rc-brand">
                            Home
                          </span>
                        ) : s.tag === "private" ? (
                          <span className="rc-label text-[9px] inline-flex shrink-0 items-center gap-1 rounded bg-rc-surface px-1.5 py-0.5 text-rc-ink-mute">
                            <Lock className="h-2.5 w-2.5" />
                            Private
                          </span>
                        ) : null}
                        <span className="truncate font-rc-mono text-[12px] text-rc-ink-soft">
                          {s.species ? `Best ${s.species}` : "No live score yet"}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="rounded border-2 border-dashed border-rc-rule bg-rc-panel p-8 text-center">
                <p className="text-sm font-semibold text-rc-ink">No spots yet</p>
                <p className="mt-1 text-sm text-rc-ink-soft">
                  Save a spot or drop your own to see it here.
                </p>
                <Link
                  href="/explore"
                  className="mt-4 inline-flex h-8 items-center gap-1.5 rounded bg-rc-brand px-3 text-sm font-normal text-white transition-colors hover:bg-rc-brand-hover"
                >
                  Explore spots
                </Link>
              </div>
            )}
          </div>

          {/* RIGHT — rail. Cards share the Explore spot-card language: a 2px
              rule, a mono status pill top-right, and a plain-English
              conclusion line — no colored top-borders or filled boxes. */}
          <div className="space-y-4">
            {/* Alerts */}
            <RailCard
              title="Alerts"
              pill={
                <Link href="/alerts">
                  <Pill className={activeAlertCount > 0 ? TIER_PILL.good : TIER_PILL.none}>
                    {activeAlertCount} ARMED
                  </Pill>
                </Link>
              }
            >
              {alerts === null ? (
                <RailSkeleton />
              ) : watchAlert ? (
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="truncate text-sm font-medium text-rc-ink">
                      {watchAlert.location_name ?? watchAlert.name ?? "Your spot"}
                    </span>
                    {watchCurrent != null && (
                      <Pill className={TIER_PILL[tierFor(watchCurrent)]}>
                        {watchCurrent} {tierFor(watchCurrent).toUpperCase()}
                      </Pill>
                    )}
                  </div>
                  <div className="mt-0.5 font-rc-mono text-[12px] text-rc-ink-soft">
                    {[
                      watchAlert.target_species,
                      watchAlert.score_threshold != null
                        ? `needs ${watchAlert.score_threshold}`
                        : null,
                      ptsAway != null
                        ? ptsAway > 0
                          ? `${ptsAway} to go`
                          : "hitting the mark"
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Custom conditions"}
                  </div>
                </div>
              ) : (
                <RailEmpty
                  body="Get pinged when a spot hits your conditions."
                  cta="Create an alert"
                  href="/alerts"
                />
              )}
            </RailCard>

            {/* Fresh catches */}
            <RailCard
              title="Fresh catches"
              pill={
                catches && catches.length > 0 ? (
                  <Pill className={TIER_PILL.none}>
                    {catchTotal ?? catches.length} · 14D
                  </Pill>
                ) : null
              }
            >
              {catches === null ? (
                <RailSkeleton />
              ) : catches.length > 0 ? (
                <ul className="space-y-2.5">
                  {catches.map((c, i) => {
                    const lb = kgToLb(c.weight_kg);
                    return (
                      <li key={i} className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-rc-ink">
                            {c.species_name ?? "Catch"}
                            {lb != null ? ` ${lb} lb` : ""}
                          </div>
                          {c.location_name && (
                            <div className="truncate font-rc-mono text-[11px] text-rc-ink-soft">
                              {c.location_name}
                            </div>
                          )}
                        </div>
                        <span className="shrink-0 font-rc-mono text-[11px] text-rc-ink-mute">
                          {relTime(c.caught_at)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <RailEmpty
                  body="No catches logged yet."
                  cta="Log a catch"
                  href="/log-catch"
                />
              )}
            </RailCard>

            {/* Regulations */}
            <RailCard
              title="Regulations"
              pill={
                homeLive?.regAreaCode ? (
                  <Pill className={TIER_PILL.none}>AREA {homeLive.regAreaCode}</Pill>
                ) : null
              }
            >
              {restrictiveReg ? (
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="truncate text-sm font-medium text-rc-ink">
                      {restrictiveReg.speciesCommon}
                    </span>
                    <Pill className={REG_PILL[restrictiveReg.status]}>
                      {restrictiveReg.status.toUpperCase()}
                    </Pill>
                  </div>
                  <div className="mt-0.5 font-rc-mono text-[12px] text-rc-ink-soft">
                    {restrictiveReg.nextOpenSummary ??
                      restrictiveReg.detail ??
                      "See details"}
                  </div>
                  <Link
                    href={`/explore/spot/${homeSlug}`}
                    className="mt-2 inline-block font-rc-mono text-[11px] font-bold text-rc-brand"
                  >
                    View all regulations ›
                  </Link>
                </div>
              ) : (
                <RailEmpty
                  body={
                    homeSlug
                      ? "No retention changes on your home spot right now."
                      : "Pin a home spot to track DFO openings and closures."
                  }
                  cta={homeSlug ? "View regulations" : "Explore spots"}
                  href={homeSlug ? `/explore/spot/${homeSlug}` : "/explore"}
                />
              )}
            </RailCard>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── bits ────────────────────────────────────────────────────────────────────
// Regulation status → the same tier-pill palette the score badges use.
const REG_PILL: Record<string, string> = {
  Open: TIER_PILL.good,
  Release: TIER_PILL.fair,
  Closed: TIER_PILL.poor,
};

function Pill({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`shrink-0 rounded px-2 py-0.5 font-rc-mono text-[11px] font-bold ${className}`}
    >
      {children}
    </span>
  );
}

// Rail card in the Explore spot-card language: 2px rule, a title + status pill
// header, then the body (a divider-led conclusion, list, or empty state).
function RailCard({
  title,
  pill,
  children,
}: {
  title: string;
  pill?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded border-2 border-rc-rule bg-rc-panel">
      <div className="px-4 pb-3.5 pt-3.5">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[15px] font-medium text-rc-ink">{title}</span>
          {pill}
        </div>
        <div className="mt-3 border-t border-rc-rule pt-3">{children}</div>
      </div>
    </div>
  );
}

function RailSkeleton() {
  return <div className="h-12 animate-pulse rounded bg-rc-surface" />;
}

function RailEmpty({
  body,
  cta,
  href,
}: {
  body: string;
  cta: string;
  href: string;
}) {
  return (
    <div>
      <p className="font-rc-mono text-[12px] text-rc-ink-soft">{body}</p>
      <Link
        href={href}
        className="mt-2 inline-block font-rc-mono text-[11px] font-bold text-rc-brand"
      >
        {cta} ›
      </Link>
    </div>
  );
}

function Stat({
  n,
  label,
  tone,
  pad,
}: {
  n: string;
  label: string;
  tone?: "good";
  pad?: boolean;
}) {
  return (
    <div className={pad ? "pl-5 sm:pl-6" : ""}>
      <div
        className={`text-2xl font-black tabular-nums leading-none ${
          tone === "good" ? "text-rc-good" : "text-rc-ink"
        }`}
      >
        {n}
      </div>
      <div className="mt-1.5 font-rc-mono text-[9px] uppercase tracking-[0.1em] text-rc-ink-mute">
        {label}
      </div>
    </div>
  );
}

function HeroStat({ k, v }: { k: string; v: string | null }) {
  return (
    <div>
      <div className="font-rc-mono text-[9px] uppercase tracking-[0.1em] text-white/40">
        {k}
      </div>
      <div className="mt-1 text-sm font-semibold">{v ?? "—"}</div>
    </div>
  );
}

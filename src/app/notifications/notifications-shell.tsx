"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Pause, Pencil, Play, Plus, Trash2 } from "lucide-react";
import ExploreTopBar from "@/app/explore/components/explore-top-bar";
import { PAGE_MEASURE } from "@/app/components/layout/page-measure";
import { useAuth } from "@/contexts/auth-context";
import { getSpeciesById } from "@/app/config/species";
import {
  tierFor,
  TIER_TEXT,
  currentLocalHour,
  type Tier,
} from "@/app/explore/lib/explore-data";
import { bestWindow } from "@/app/explore/components/hourly-bars";
import { fetchSpotLive } from "@/lib/bluecaster-client";
import type { SpotPageInitial } from "@/lib/bluecaster/live-spot-types";

interface AlertProfileRow {
  id: string;
  name: string;
  location_name: string | null;
  is_active: boolean;
  score_threshold: number | null;
  target_species: string | null;
  target_bluecaster_spot_slug: string | null;
  delivery_channels: string[] | null;
  last_triggered_at: string | null;
  triggers: { fishing_score?: { min_score?: number } } | null;
}

interface HistoryEntry {
  id: string;
  alert_profile_id: string;
  triggered_at: string;
  condition_snapshot: { fishing_score?: number | null } | null;
}

/** Live current-hour read joined to an alert's spot + species. */
interface LiveInfo {
  score: number | null;
  windowLabel: string | null;
  speciesName: string | null;
  city: string | null;
}

type AlertState = "live" | "watching" | "paused";
type Tab = "all" | "live" | "watching" | "paused";

const TZ = "America/Vancouver";

/** Solid tier dot color for the score gauge knob. */
const TIER_DOT: Record<Tier, string> = {
  good: "bg-rc-good",
  fair: "bg-rc-fair",
  poor: "bg-rc-poor",
  none: "bg-rc-ink-mute",
};

function thresholdOf(p: AlertProfileRow): number | null {
  return p.score_threshold ?? p.triggers?.fishing_score?.min_score ?? null;
}

function stateOf(p: AlertProfileRow, live: LiveInfo | undefined): AlertState {
  if (!p.is_active) return "paused";
  const th = thresholdOf(p);
  if (live?.score != null && th != null && live.score >= th) return "live";
  return "watching";
}

/** Resolve the species UUID for an alert within a spot payload. */
function resolveSpeciesId(
  payload: SpotPageInitial,
  slug: string | null,
): string | null {
  if (slug) {
    const found = payload.species.find((s) => s.slug === slug);
    if (found) return found.id;
  }
  // "Any" (or unmatched) → the spot's top-scoring species today.
  let best: string | null = null;
  let max = -Infinity;
  for (const [id, v] of Object.entries(payload.topScoreTodayBySpecies)) {
    if (v > max) {
      max = v;
      best = id;
    }
  }
  return best;
}

function deriveLive(
  p: AlertProfileRow,
  payload: SpotPageInitial | null,
  nowHour: number,
): LiveInfo {
  if (!payload) {
    return { score: null, windowLabel: null, speciesName: null, city: null };
  }
  const uuid = resolveSpeciesId(payload, p.target_species);
  const series = uuid ? (payload.hourlyScoreGrid[uuid]?.[0] ?? null) : null;
  const raw = series ? series[nowHour] : null;
  const speciesEntry = uuid
    ? (payload.species.find((s) => s.id === uuid) ?? null)
    : null;
  return {
    score: raw == null ? null : Math.round(raw),
    windowLabel: series ? bestWindow(series).label : null,
    speciesName: speciesEntry?.name ?? null,
    city: payload.spot.city ?? null,
  };
}

export default function NotificationsShell() {
  const router = useRouter();
  const { user, session, loading: authLoading } = useAuth();

  const [profiles, setProfiles] = useState<AlertProfileRow[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState<Record<string, LiveInfo>>({});
  const [tab, setTab] = useState<Tab>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showAllTriggers, setShowAllTriggers] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login?next=/notifications");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!session?.access_token) return;
    (async () => {
      try {
        const res = await fetch("/api/alerts?include_history=true", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        setProfiles((data.profiles ?? []) as AlertProfileRow[]);
        const hist: HistoryEntry[] = [];
        const map = (data.history ?? {}) as Record<string, HistoryEntry[]>;
        for (const list of Object.values(map)) hist.push(...list);
        hist.sort((a, b) => b.triggered_at.localeCompare(a.triggered_at));
        setHistory(hist);
      } finally {
        setLoading(false);
      }
    })();
    // Key on the token string, not the `session` object — the auth context
    // hands back a fresh `session` reference each render, so depending on it
    // re-runs this fetch every render (thrashing `profiles`' identity, which
    // in turn cancels the live-score fetch before it can commit).
  }, [session?.access_token]);

  // Hydrate live current-hour scores once the profiles are in. One fetch per
  // unique spot slug (deduped, parallel); rows render before this resolves and
  // degrade gracefully to "no live score" on any failure.
  useEffect(() => {
    if (profiles.length === 0) return;
    let cancelled = false;
    (async () => {
      const slugs = Array.from(
        new Set(
          profiles
            .map((p) => p.target_bluecaster_spot_slug)
            .filter((s): s is string => !!s),
        ),
      );
      const payloads = await Promise.all(slugs.map((s) => fetchSpotLive(s)));
      if (cancelled) return;
      const bySlug = new Map<string, SpotPageInitial | null>();
      slugs.forEach((s, i) => bySlug.set(s, payloads[i]));
      const nowHour = currentLocalHour(TZ);
      const next: Record<string, LiveInfo> = {};
      for (const p of profiles) {
        const payload = p.target_bluecaster_spot_slug
          ? (bySlug.get(p.target_bluecaster_spot_slug) ?? null)
          : null;
        next[p.id] = deriveLive(p, payload, nowHour);
      }
      setLive(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [profiles]);

  const liveCount = useMemo(
    () => profiles.filter((p) => stateOf(p, live[p.id]) === "live").length,
    [profiles, live],
  );
  const watchingCount = useMemo(
    () => profiles.filter((p) => stateOf(p, live[p.id]) === "watching").length,
    [profiles, live],
  );
  const pausedCount = profiles.filter((p) => !p.is_active).length;

  const triggersThisMonth = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    return history.filter((h) => {
      const d = new Date(h.triggered_at);
      return d.getFullYear() === y && d.getMonth() === m;
    }).length;
  }, [history]);

  // Top live alert (greatest margin above the line) drives the banner.
  const banner = useMemo(() => {
    let best: {
      p: AlertProfileRow;
      info: LiveInfo;
      th: number;
      delta: number;
    } | null = null;
    for (const p of profiles) {
      if (stateOf(p, live[p.id]) !== "live") continue;
      const info = live[p.id];
      const th = thresholdOf(p);
      if (info?.score == null || th == null) continue;
      const delta = info.score - th;
      if (!best || delta > best.delta) best = { p, info, th, delta };
    }
    return best;
  }, [profiles, live]);

  const toggle = async (p: AlertProfileRow) => {
    if (!session?.access_token) return;
    setBusyId(p.id);
    const res = await fetch("/api/alerts", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ id: p.id, is_active: !p.is_active }),
    });
    if (res.ok) {
      const { profile } = await res.json();
      setProfiles((cur) =>
        cur.map((x) => (x.id === p.id ? { ...x, ...profile } : x)),
      );
    }
    setBusyId(null);
  };

  const remove = async (p: AlertProfileRow) => {
    if (!session?.access_token) return;
    setBusyId(p.id);
    const res = await fetch(`/api/alerts?id=${p.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.ok) setProfiles((cur) => cur.filter((x) => x.id !== p.id));
    setBusyId(null);
  };

  if (authLoading || !user) return null;

  const rows = profiles.filter((p) => {
    if (tab === "all") return true;
    if (tab === "paused") return !p.is_active;
    return stateOf(p, live[p.id]) === tab;
  });

  return (
    <div className="min-h-dvh bg-rc-page">
      <ExploreTopBar />
      <main className="pt-16">
        <div className={`${PAGE_MEASURE} py-8`}>
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold tracking-[-0.02em] text-rc-ink">
                Notifications
              </h1>
              <div className="mt-1.5 font-rc-mono text-[12px] text-rc-ink-mute">
                <span className="text-rc-good font-semibold">
                  {liveCount} live now
                </span>
                {" · "}
                {watchingCount} watching {" · "}
                {pausedCount} paused {" · "}
                {triggersThisMonth} triggers this month
              </div>
            </div>
            <Link
              href="/explore"
              className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rc-brand hover:bg-rc-brand-hover text-white text-sm font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" /> New alert
            </Link>
          </div>

          {/* Live-now banner */}
          {banner && (
            <div className="mt-6 flex items-center justify-between gap-4 rounded-xl border border-rc-rule border-l-4 border-l-rc-good bg-rc-panel px-4 py-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-2 h-2 rounded-full bg-rc-good shrink-0" />
                <p className="text-sm text-rc-ink min-w-0">
                  <span className="font-bold">
                    {banner.p.location_name ?? banner.p.name}
                  </span>{" "}
                  is live at{" "}
                  <span className="font-bold text-rc-good">
                    {banner.info.score}
                  </span>
                  , {banner.delta} above your {banner.th} line.
                  {banner.info.windowLabel
                    ? ` Best window ${banner.info.windowLabel} today.`
                    : ""}
                </p>
              </div>
              {banner.p.target_bluecaster_spot_slug && (
                <Link
                  href={`/explore/spot/${banner.p.target_bluecaster_spot_slug}`}
                  className="shrink-0 font-rc-mono text-[11px] font-semibold text-rc-brand hover:underline"
                >
                  VIEW SPOT →
                </Link>
              )}
            </div>
          )}

          {/* Tabs */}
          <div className="mt-6 flex items-center gap-2">
            <TabPill label="All" count={profiles.length} on={tab === "all"} onClick={() => setTab("all")} />
            <TabPill label="Live" count={liveCount} on={tab === "live"} onClick={() => setTab("live")} />
            <TabPill label="Watching" count={watchingCount} on={tab === "watching"} onClick={() => setTab("watching")} />
            <TabPill label="Paused" count={pausedCount} on={tab === "paused"} onClick={() => setTab("paused")} />
          </div>

          {loading ? (
            <div className="mt-10 flex items-center gap-2 text-rc-ink-mute">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading alerts…
            </div>
          ) : rows.length === 0 ? (
            <EmptyState tab={tab} />
          ) : (
            <AlertsTable
              rows={rows}
              live={live}
              busyId={busyId}
              onToggle={toggle}
              onRemove={remove}
            />
          )}

          {/* Recent triggers */}
          {!loading && history.length > 0 && (
            <div className="mt-10">
              <div className="rc-label text-[9px] text-rc-ink-mute">
                RECENT TRIGGERS
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                {(showAllTriggers ? history : history.slice(0, 2)).map((h) => (
                  <TriggerCard
                    key={h.id}
                    entry={h}
                    profile={
                      profiles.find((p) => p.id === h.alert_profile_id) ?? null
                    }
                    live={live[h.alert_profile_id]}
                    email={user.email ?? ""}
                  />
                ))}
              </div>
              {history.length > 2 && (
                <button
                  type="button"
                  onClick={() => setShowAllTriggers((v) => !v)}
                  className="mt-4 font-rc-mono text-[12px] font-semibold text-rc-brand hover:underline"
                >
                  {showAllTriggers
                    ? "SHOW FEWER"
                    : `VIEW ALL ${history.length} TRIGGERS →`}
                </button>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ── pieces ───────────────────────────────────────────────────────────

function TabPill({
  label,
  count,
  on,
  onClick,
}: {
  label: string;
  count: number;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
        on
          ? "bg-rc-ink text-white"
          : "border border-rc-rule text-rc-ink-soft hover:bg-rc-surface"
      }`}
    >
      {label}{" "}
      <span className={on ? "text-white/70" : "text-rc-ink-mute"}>{count}</span>
    </button>
  );
}

function AlertsTable({
  rows,
  live,
  busyId,
  onToggle,
  onRemove,
}: {
  rows: AlertProfileRow[];
  live: Record<string, LiveInfo>;
  busyId: string | null;
  onToggle: (p: AlertProfileRow) => void;
  onRemove: (p: AlertProfileRow) => void;
}) {
  return (
    <div className="mt-6 overflow-x-auto rounded-xl border border-rc-rule">
      <table className="w-full min-w-[880px] text-left">
        <thead>
          <tr className="bg-rc-surface rc-label text-[9px] text-rc-ink-mute">
            <Th>Spot</Th>
            <Th>Species</Th>
            <Th>Score vs your line</Th>
            <Th>Delivery</Th>
            <Th>Status</Th>
            <Th>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const info = live[p.id];
            const threshold = thresholdOf(p);
            const state = stateOf(p, info);
            const tier = tierFor(info?.score ?? null);
            const speciesName =
              info?.speciesName ??
              (p.target_species
                ? (getSpeciesById(p.target_species)?.name ?? p.target_species)
                : "Any");
            return (
              <tr key={p.id} className="border-t border-rc-rule-soft bg-rc-panel">
                <Td>
                  <div className="font-bold text-rc-ink">
                    {p.location_name ?? p.name}
                  </div>
                  {info?.city && (
                    <div className="font-rc-mono text-[11px] text-rc-ink-mute mt-0.5">
                      {info.city}
                    </div>
                  )}
                </Td>
                <Td>
                  <span className="inline-block px-2.5 py-1 rounded-md border border-rc-rule text-xs font-semibold text-rc-ink">
                    {shortName(speciesName)}
                  </span>
                </Td>
                <Td>
                  <ScoreLineGauge
                    score={info?.score ?? null}
                    threshold={threshold}
                    tier={tier}
                  />
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {(p.delivery_channels ?? ["email"]).map((c) => (
                      <span
                        key={c}
                        className="px-2 py-0.5 rounded-md bg-rc-brand-soft text-rc-brand text-[10px] font-semibold uppercase tracking-[0.06em]"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </Td>
                <Td>
                  <StatusCell state={state} lastTriggeredAt={p.last_triggered_at} />
                </Td>
                <Td>
                  <div className="flex items-center gap-1.5">
                    <IconBtn
                      label={p.is_active ? "Pause" : "Activate"}
                      onClick={() => onToggle(p)}
                      disabled={busyId === p.id}
                    >
                      {p.is_active ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </IconBtn>
                    {p.target_bluecaster_spot_slug && (
                      <IconLink
                        label="Edit at spot"
                        href={`/explore/spot/${p.target_bluecaster_spot_slug}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </IconLink>
                    )}
                    <IconBtn
                      label="Delete"
                      danger
                      onClick={() => onRemove(p)}
                      disabled={busyId === p.id}
                    >
                      <Trash2 className="w-4 h-4" />
                    </IconBtn>
                  </div>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Score-vs-threshold gauge: mono line label, tier score + delta pill, and a
 *  0–100 track with a threshold tick and a tier-colored knob at the score. */
function ScoreLineGauge({
  score,
  threshold,
  tier,
}: {
  score: number | null;
  threshold: number | null;
  tier: Tier;
}) {
  const delta =
    score != null && threshold != null ? score - threshold : null;
  const clamp = (v: number) => Math.max(0, Math.min(100, v));
  return (
    <div className="min-w-[180px]">
      <div className="rc-label text-[9px] text-rc-ink-mute">
        YOUR LINE ≥ {threshold ?? "—"}
      </div>
      <div className="flex items-center gap-2 mt-1">
        {score != null ? (
          <span className={`text-2xl font-bold leading-none ${TIER_TEXT[tier]}`}>
            {score}
          </span>
        ) : (
          <span className="font-rc-mono text-[11px] text-rc-ink-mute">
            No live score
          </span>
        )}
        {delta != null && (
          <span
            className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
              delta >= 0
                ? "bg-rc-good-bg text-rc-good-ink"
                : "bg-rc-surface text-rc-ink-soft"
            }`}
          >
            {delta >= 0 ? `+${delta} above` : `${Math.abs(delta)} below`}
          </span>
        )}
      </div>
      <div className="relative mt-2 h-2 rounded-full bg-rc-surface">
        {threshold != null && (
          <span
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[2px] h-3.5 rounded-full bg-rc-ink"
            style={{ left: `${clamp(threshold)}%` }}
          />
        )}
        {score != null && (
          <span
            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full ring-2 ring-white ${TIER_DOT[tier]}`}
            style={{ left: `${clamp(score)}%` }}
          />
        )}
      </div>
    </div>
  );
}

function StatusCell({
  state,
  lastTriggeredAt,
}: {
  state: AlertState;
  lastTriggeredAt: string | null;
}) {
  const cfg: Record<
    AlertState,
    { text: string; dot: string; label: string; hollow: boolean }
  > = {
    live: { text: "text-rc-good", dot: "bg-rc-good", label: "LIVE", hollow: false },
    watching: {
      text: "text-rc-ink-soft",
      dot: "bg-rc-ink-mute",
      label: "WATCHING",
      hollow: false,
    },
    paused: {
      text: "text-rc-ink-mute",
      dot: "",
      label: "PAUSED",
      hollow: true,
    },
  };
  const c = cfg[state];
  return (
    <div>
      <span
        className={`inline-flex items-center gap-1.5 text-xs font-semibold ${c.text}`}
      >
        <span
          className={
            c.hollow
              ? "w-2 h-2 rounded-full border border-rc-ink-mute"
              : `w-2 h-2 rounded-full ${c.dot}`
          }
        />
        {c.label}
      </span>
      <div className="font-rc-mono text-[11px] text-rc-ink-mute mt-1">
        {lastTriggeredAt
          ? `Last hit ${fmtDateTime(lastTriggeredAt)}`
          : "Never triggered"}
      </div>
    </div>
  );
}

function TriggerCard({
  entry,
  profile,
  live,
  email,
}: {
  entry: HistoryEntry;
  profile: AlertProfileRow | null;
  live: LiveInfo | undefined;
  email: string;
}) {
  const score = entry.condition_snapshot?.fishing_score ?? null;
  const threshold = profile ? thresholdOf(profile) : null;
  const speciesName =
    live?.speciesName ??
    (profile?.target_species
      ? (getSpeciesById(profile.target_species)?.name ?? profile.target_species)
      : null);
  const spotName = profile?.location_name ?? profile?.name ?? "Spot";
  const slug = profile?.target_bluecaster_spot_slug ?? null;
  const sub = [
    speciesName ? shortName(speciesName) : null,
    live?.windowLabel ? `best window ${live.windowLabel}` : null,
    email ? `emailed to ${email}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="rounded-xl border border-rc-rule bg-rc-panel p-4">
      <div className="rc-label text-[9px] text-rc-good">
        TRIGGERED · {fmtDateTime(entry.triggered_at).toUpperCase()}
      </div>
      <div className="mt-1.5 font-bold text-rc-ink">
        {spotName}
        {score != null ? ` hit ${Math.round(score)}` : ""}
        {threshold != null ? ` · your line was ≥ ${threshold}` : ""}
      </div>
      {sub && (
        <div className="mt-1 font-rc-mono text-[11px] text-rc-ink-mute">
          {sub}
        </div>
      )}
      {slug && (
        <Link
          href={`/explore/spot/${slug}`}
          className="mt-3 inline-block font-rc-mono text-[11px] font-semibold text-rc-brand hover:underline"
        >
          VIEW SPOT →
        </Link>
      )}
    </div>
  );
}

function EmptyState({ tab }: { tab: Tab }) {
  const msg: Record<Tab, string> = {
    all: "No alerts yet.",
    live: "No alerts are live right now.",
    watching: "No alerts are watching right now.",
    paused: "No paused alerts.",
  };
  return (
    <div className="mt-8 rounded-xl border border-rc-rule bg-rc-panel p-10 text-center">
      <p className="text-rc-ink-soft">{msg[tab]}</p>
      <Link
        href="/explore"
        className="mt-4 inline-block px-4 py-2.5 rounded-xl bg-rc-brand hover:bg-rc-brand-hover text-white text-sm font-semibold transition-colors"
      >
        Pick a spot to create an alert →
      </Link>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 font-semibold uppercase tracking-[0.06em]">
      {children}
    </th>
  );
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-middle">{children}</td>;
}
function IconBtn({
  children,
  label,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors disabled:opacity-40 ${
        danger
          ? "border-rc-rule text-rc-poor hover:bg-rc-poor-bg"
          : "border-rc-rule text-rc-ink-soft hover:bg-rc-surface"
      }`}
    >
      {children}
    </button>
  );
}
function IconLink({
  children,
  label,
  href,
}: {
  children: React.ReactNode;
  label: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="w-8 h-8 rounded-lg border border-rc-rule text-rc-ink-soft hover:bg-rc-surface flex items-center justify-center transition-colors"
    >
      {children}
    </Link>
  );
}

function shortName(name: string): string {
  return name.replace(/\s+(Salmon|Crab)$/i, "").replace(/^Pacific\s+/i, "");
}

// ── date helpers ─────────────────────────────────────────────────────
function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(new Date(iso));
}
function fmtTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}
function fmtDateTime(iso: string): string {
  return `${fmtDate(iso)} · ${fmtTime(iso)}`;
}

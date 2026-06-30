"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pause, Play, Plus, Trash2 } from "lucide-react";
import ExploreTopBar from "@/app/explore/components/explore-top-bar";
import { useAuth } from "@/contexts/auth-context";
import { getSpeciesById } from "@/app/config/species";
import { tierFor, TIER_TEXT } from "@/app/explore/lib/explore-data";

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

type Tab = "active" | "paused" | "triggered";

export default function NotificationsShell() {
  const router = useRouter();
  const { user, session, loading: authLoading } = useAuth();

  const [profiles, setProfiles] = useState<AlertProfileRow[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("active");
  const [busyId, setBusyId] = useState<string | null>(null);

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
  }, [session]);

  const active = profiles.filter((p) => p.is_active);
  const paused = profiles.filter((p) => !p.is_active);

  const lastTriggeredAt = useMemo(
    () => history[0]?.triggered_at ?? null,
    [history],
  );

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
      setProfiles((cur) => cur.map((x) => (x.id === p.id ? { ...x, ...profile } : x)));
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

  const rows = tab === "paused" ? paused : active;

  return (
    <div className="min-h-dvh bg-rc-page">
      <ExploreTopBar />
      <main className="pt-14">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="rc-label text-[10px] text-rc-ink-mute">
                NOTIFICATIONS · ALERT MANAGEMENT
              </div>
              <h1 className="mt-1 text-4xl font-bold tracking-[-0.02em] text-rc-brand">
                Your alerts
              </h1>
              <div className="mt-1 font-rc-mono text-[12px] text-rc-ink-mute">
                {active.length} active · {paused.length} paused
                {lastTriggeredAt
                  ? ` · last triggered ${fmtDateTime(lastTriggeredAt)}`
                  : ""}
              </div>
            </div>
            <Link
              href="/explore"
              className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rc-brand hover:bg-rc-brand-hover text-white text-sm font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" /> New alert
            </Link>
          </div>

          {/* Tabs */}
          <div className="mt-6 flex items-center gap-2">
            <TabPill label="Active" count={active.length} on={tab === "active"} onClick={() => setTab("active")} />
            <TabPill label="Paused" count={paused.length} on={tab === "paused"} onClick={() => setTab("paused")} />
            <TabPill label="Triggered" count={history.length} on={tab === "triggered"} onClick={() => setTab("triggered")} />
          </div>

          {loading ? (
            <div className="mt-10 flex items-center gap-2 text-rc-ink-mute">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading alerts…
            </div>
          ) : tab === "triggered" ? (
            <TriggeredList history={history} profiles={profiles} email={user.email ?? ""} />
          ) : rows.length === 0 ? (
            <EmptyState tab={tab} />
          ) : (
            <AlertsTable
              rows={rows}
              history={history}
              busyId={busyId}
              onToggle={toggle}
              onRemove={remove}
            />
          )}

          {/* Recent triggers (always under the table on active/paused) */}
          {!loading && tab !== "triggered" && history.length > 0 && (
            <div className="mt-10">
              <div className="rc-label text-[9px] text-rc-ink-mute">
                RECENT TRIGGERS
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                {history.slice(0, 2).map((h) => (
                  <TriggerCard
                    key={h.id}
                    entry={h}
                    profile={profiles.find((p) => p.id === h.alert_profile_id) ?? null}
                    email={user.email ?? ""}
                  />
                ))}
              </div>
              {history.length > 2 && (
                <button
                  type="button"
                  onClick={() => setTab("triggered")}
                  className="mt-4 font-rc-mono text-[12px] font-semibold text-rc-brand hover:underline"
                >
                  VIEW ALL {history.length} TRIGGERS →
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
          ? "bg-rc-brand text-white"
          : "border border-rc-rule text-rc-ink-soft hover:bg-rc-surface"
      }`}
    >
      {label}{" "}
      <span className={on ? "text-white/80" : "text-rc-ink-mute"}>{count}</span>
    </button>
  );
}

function AlertsTable({
  rows,
  history,
  busyId,
  onToggle,
  onRemove,
}: {
  rows: AlertProfileRow[];
  history: HistoryEntry[];
  busyId: string | null;
  onToggle: (p: AlertProfileRow) => void;
  onRemove: (p: AlertProfileRow) => void;
}) {
  return (
    <div className="mt-6 overflow-x-auto rounded-xl border border-rc-rule">
      <table className="w-full min-w-[820px] text-left">
        <thead>
          <tr className="bg-rc-surface rc-label text-[9px] text-rc-ink-mute">
            <Th>Spot</Th>
            <Th>Species</Th>
            <Th>Threshold</Th>
            <Th>Delivery</Th>
            <Th>Last triggered</Th>
            <Th>Status</Th>
            <Th>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const threshold =
              p.score_threshold ?? p.triggers?.fishing_score?.min_score ?? null;
            const tier = tierFor(threshold);
            const speciesName = p.target_species
              ? (getSpeciesById(p.target_species)?.name ?? p.target_species)
              : "Any";
            const last = history.find((h) => h.alert_profile_id === p.id) ?? null;
            return (
              <tr key={p.id} className="border-t border-rc-rule-soft bg-rc-panel">
                <Td>
                  <div className="font-bold text-rc-ink">
                    {p.location_name ?? p.name}
                  </div>
                </Td>
                <Td>
                  <span className="inline-block px-2.5 py-1 rounded-md border border-rc-rule text-xs font-semibold text-rc-ink">
                    {shortName(speciesName)}
                  </span>
                </Td>
                <Td>
                  <div className={`text-lg font-bold ${TIER_TEXT[tier]}`}>
                    ≥ {threshold ?? "—"}
                  </div>
                  <div className={`rc-label text-[9px] ${TIER_TEXT[tier]}`}>
                    {tier !== "none" ? tier : ""}
                  </div>
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
                  {p.last_triggered_at ? (
                    <div>
                      <div className="font-semibold text-rc-ink text-sm">
                        {fmtDate(p.last_triggered_at)}
                      </div>
                      <div className="font-rc-mono text-[11px] text-rc-ink-mute">
                        {fmtTime(p.last_triggered_at)}
                        {last?.condition_snapshot?.fishing_score != null
                          ? ` · score ${Math.round(last.condition_snapshot.fishing_score)}`
                          : ""}
                      </div>
                    </div>
                  ) : (
                    <span className="font-rc-mono text-[12px] text-rc-ink-mute">
                      Never triggered
                    </span>
                  )}
                </Td>
                <Td>
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                      p.is_active ? "text-rc-good" : "text-rc-ink-mute"
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        p.is_active ? "bg-rc-good" : "bg-rc-ink-mute"
                      }`}
                    />
                    {p.is_active ? "ACTIVE" : "PAUSED"}
                  </span>
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
                    <IconBtn
                      label="Confirm active"
                      onClick={() => onToggle(p)}
                      disabled={busyId === p.id}
                    >
                      <Check className="w-4 h-4" />
                    </IconBtn>
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

function TriggeredList({
  history,
  profiles,
  email,
}: {
  history: HistoryEntry[];
  profiles: AlertProfileRow[];
  email: string;
}) {
  if (history.length === 0) {
    return (
      <div className="mt-8 text-rc-ink-mute font-rc-mono text-sm">
        No alerts have triggered yet.
      </div>
    );
  }
  return (
    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
      {history.map((h) => (
        <TriggerCard
          key={h.id}
          entry={h}
          profile={profiles.find((p) => p.id === h.alert_profile_id) ?? null}
          email={email}
        />
      ))}
    </div>
  );
}

function TriggerCard({
  entry,
  profile,
  email,
}: {
  entry: HistoryEntry;
  profile: AlertProfileRow | null;
  email: string;
}) {
  const score = entry.condition_snapshot?.fishing_score ?? null;
  const threshold =
    profile?.score_threshold ?? profile?.triggers?.fishing_score?.min_score ?? null;
  const speciesName = profile?.target_species
    ? (getSpeciesById(profile.target_species)?.name ?? profile.target_species)
    : null;
  const spotName = profile?.location_name ?? profile?.name ?? "Spot";
  const slug = profile?.target_bluecaster_spot_slug ?? null;
  return (
    <div className="rounded-xl border border-rc-rule bg-rc-panel p-4">
      <div className="rc-label text-[9px] text-rc-good">
        TRIGGERED · {fmtDateTime(entry.triggered_at).toUpperCase()}
      </div>
      <div className="mt-1.5 font-bold text-rc-ink">
        {spotName}
        {score != null ? ` hit ${Math.round(score)}` : ""}
        {threshold != null ? ` (≥ ${threshold} threshold)` : ""}
      </div>
      <div className="mt-1 font-rc-mono text-[11px] text-rc-ink-mute">
        {[shortName(speciesName ?? ""), email ? `sent to ${email}` : null]
          .filter(Boolean)
          .join(" · ")}
      </div>
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
  return (
    <div className="mt-8 rounded-xl border border-rc-rule bg-rc-panel p-10 text-center">
      <p className="text-rc-ink-soft">
        {tab === "active"
          ? "No active alerts yet."
          : "No paused alerts."}
      </p>
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
  return <th className="px-4 py-3 font-semibold uppercase tracking-[0.06em]">{children}</th>;
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

function shortName(name: string): string {
  return name.replace(/\s+(Salmon|Crab)$/i, "").replace(/^Pacific\s+/i, "");
}

// ── date helpers ─────────────────────────────────────────────────────
const TZ = "America/Vancouver";
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

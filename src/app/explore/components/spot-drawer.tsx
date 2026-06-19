"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronDown, ExternalLink, X } from "lucide-react";
import {
  TIER_PILL,
  TIER_TEXT,
  currentLocalHour,
  fmtPeak,
  tierFor,
  type RailSpot,
} from "../lib/explore-data";
import HourlyBars from "./hourly-bars";
import { useSpotIntel } from "../lib/use-spot-intel";
import type { PoolBucketRate } from "@/lib/bluecaster/intel-types";

function headerStamp(date: string, tz: string): string {
  const parts: string[] = ["SELECTED"];
  if (date) {
    const d = new Date(`${date}T12:00:00`);
    parts.push(
      d
        .toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
        .replace(/,/g, "")
        .toUpperCase(),
    );
  }
  parts.push(`${String(currentLocalHour(tz)).padStart(2, "0")}:00`);
  return parts.join(" · ");
}

// ── small presentational helpers ───────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="rc-label text-[9px] mb-2">{children}</div>;
}

function titleCase(v: string): string {
  return v
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Highest-rate non-suppressed bucket, or null. */
function topBucket(rates: PoolBucketRate[] | undefined): PoolBucketRate | null {
  if (!rates) return null;
  const usable = rates.filter((b) => !b.sample_too_small && b.rate !== null);
  if (usable.length === 0) return null;
  return usable.reduce((a, b) => ((b.rate ?? 0) > (a.rate ?? 0) ? b : a));
}

const FACTOR_TEXT: Record<string, string> = {
  Prime: "text-rc-good-ink",
  Fair: "text-rc-fair-ink",
  Poor: "text-rc-poor-ink",
};

const REG_PILL: Record<string, string> = {
  Open: "bg-rc-good-bg text-rc-good-ink",
  Release: "bg-rc-fair-bg text-rc-fair-ink",
  Closed: "bg-rc-poor-bg text-rc-poor-ink",
};

const SEASON_LABEL: Record<string, string> = {
  peak: "Peak season",
  shoulder: "Shoulder season",
  off: "Off season",
  closed: "Closed",
  nodata: "",
};

function confidenceLabel(c: number): string {
  if (c >= 0.66) return "Strong";
  if (c >= 0.4) return "Moderate";
  return "Thin";
}

/**
 * Spot drawer per the Figma — fills the same rail slot as the list.
 * Renders instantly from the in-memory RailSpot, then progressively enriches
 * with BlueCaster's live spot-page (catch signals, score drivers, regulations,
 * season, water temp), the community catch pool, and an on-demand "why this
 * score" evidence panel. PRESSURE / MOON stay placeholders (not in the payload).
 */
export default function SpotDrawer({
  spot,
  date,
  tz,
  onBack,
}: {
  spot: RailSpot;
  date: string;
  tz: string;
  onBack: () => void;
}) {
  const tier = tierFor(spot.score);
  const peak = fmtPeak(spot.peakHour);
  const spotHref = `/fishing/${spot.provinceCode.toLowerCase()}/${spot.citySlug}/${spot.slug}`;

  const [whyOpen, setWhyOpen] = useState(false);
  const { page, pool, evidence, evidenceLoading } = useSpotIntel({
    slug: spot.slug,
    spotId: spot.id,
    speciesId: spot.bestSpeciesId,
    evidenceEnabled: whyOpen,
  });

  const species = spot.bestSpeciesId;

  // WATER temp from the live spot-page's current-hour cell (fills one gap).
  const waterTemp = useMemo(() => {
    const cell = page?.hourlyConditionsGrid?.[0]?.[currentLocalHour(tz)];
    const t = cell?.seaTempC;
    return t != null ? `${t.toFixed(1)}°C` : null;
  }, [page, tz]);

  const drivers = useMemo(
    () => (species ? (page?.todayFactorsBySpecies?.[species] ?? []).slice(0, 3) : []),
    [page, species],
  );

  const regulation = useMemo(
    () => page?.regulations?.find((r) => r.speciesId === species) ?? null,
    [page, species],
  );

  const seasonState = species ? page?.seasonStateBySpecies?.[species] ?? null : null;

  const catches = useMemo(
    () =>
      (page?.catchSignals ?? [])
        .slice()
        .sort((a, b) => (a.daysAgo ?? 999) - (b.daysAgo ?? 999))
        .slice(0, 2),
    [page],
  );

  // Pool "best conditions" — top non-suppressed bucket per factor.
  const poolLines = useMemo(() => {
    if (!pool || pool.total_catches_in_window === 0) return [];
    const factors: Array<[string, PoolBucketRate[] | undefined]> = [
      ["Tide", pool.rates.tide_phase],
      ["Time", pool.rates.time_of_day],
      ["Moon", pool.rates.moon_phase],
      ["Depth", pool.rates.depth_band],
    ];
    return factors
      .map(([label, rates]) => {
        const b = topBucket(rates);
        return b ? { label, value: titleCase(b.value), rate: Math.round(b.rate ?? 0) } : null;
      })
      .filter((x): x is { label: string; value: string; rate: number } => x !== null);
  }, [pool]);

  const topLures = useMemo(
    () => (pool?.top_lures ?? []).filter((l) => !l.sample_too_small).slice(0, 3),
    [pool],
  );

  const conditionCells: Array<{ label: string; value: string; sub: string | null }> = [
    { label: "WIND", value: spot.conditions.wind ?? "—", sub: null },
    { label: "TIDE", value: spot.conditions.tide ?? "—", sub: null },
    { label: "SEA", value: spot.conditions.sea ?? "—", sub: null },
    { label: "PRESSURE", value: "—", sub: "coming soon" },
    { label: "WATER", value: waterTemp ?? "—", sub: waterTemp ? null : "coming soon" },
    { label: "MOON", value: "—", sub: "coming soon" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to list"
          className="p-1 -ml-1 rounded-md text-rc-brand hover:bg-rc-surface transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="rc-label text-[9px]">{headerStamp(date, tz)}</span>
        <button
          type="button"
          onClick={onBack}
          aria-label="Close"
          className="ml-auto p-1 rounded-md text-rc-ink-mute hover:bg-rc-surface hover:text-rc-ink transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {/* Name + details link */}
        <div className="flex items-start justify-between gap-3 mt-2">
          <h2 className="rc-title-lg truncate">{spot.name}</h2>
          <Link
            href={spotHref}
            className="shrink-0 text-sm font-semibold text-rc-brand hover:underline mt-1"
          >
            View spot details
          </Link>
        </div>
        <p className="font-rc-mono text-xs text-rc-ink-soft mt-1">
          {spot.regionName}
          {spot.distanceKm !== null ? ` · ${spot.distanceKm} km` : ""}
        </p>

        {/* Score block */}
        <div className="flex items-center gap-4 mt-6 pb-5 border-b border-rc-rule-soft">
          <span
            className={`text-[60px] leading-none font-bold tracking-[-0.04em] ${TIER_TEXT[tier]}`}
          >
            {spot.score ?? "—"}
          </span>
          <div className="space-y-1.5">
            <span
              className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${TIER_PILL[tier]}`}
            >
              {spot.score !== null ? tier.toUpperCase() : "NO SCORE"}
            </span>
            {spot.driverSpecies && (
              <p className="font-rc-mono text-xs text-rc-ink-soft">
                {spot.driverSpecies} driving{peak ? ` · peak ${peak}` : ""}
              </p>
            )}
            {seasonState && SEASON_LABEL[seasonState] && (
              <p className="font-rc-mono text-[10px] text-rc-ink-mute uppercase tracking-[0.06em]">
                {SEASON_LABEL[seasonState]}
              </p>
            )}
          </div>
        </div>

        {/* Conditions grid */}
        <div className="grid grid-cols-3 gap-y-4 mt-5 pb-5 border-b border-rc-rule-soft">
          {conditionCells.map((cell) => (
            <div key={cell.label}>
              <div className="rc-label text-[9px]">{cell.label}</div>
              <div className="font-rc-mono text-sm font-medium text-rc-ink mt-1">
                {cell.value}
              </div>
              {cell.sub && (
                <div className="font-rc-mono text-[10px] text-rc-ink-mute mt-0.5 italic">
                  {cell.sub}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Score drivers (from live spot-page) */}
        {drivers.length > 0 && (
          <div className="mt-5 pb-5 border-b border-rc-rule-soft">
            <SectionLabel>WHAT&apos;S DRIVING IT</SectionLabel>
            <ul className="space-y-1.5">
              {drivers.map((f) => (
                <li key={f.label} className="flex items-baseline justify-between gap-3">
                  <span className="font-rc-mono text-xs text-rc-ink-soft">{f.label}</span>
                  <span className="flex items-baseline gap-2 text-right">
                    {f.valueLine && (
                      <span className="font-rc-mono text-[11px] text-rc-ink-mute">
                        {f.valueLine}
                      </span>
                    )}
                    <span
                      className={`font-rc-mono text-[11px] font-semibold ${FACTOR_TEXT[f.status] ?? "text-rc-ink"}`}
                    >
                      {f.status}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Regulation status */}
        {regulation && (
          <div className="mt-5 pb-5 border-b border-rc-rule-soft">
            <SectionLabel>REGULATIONS · {regulation.speciesCommon.toUpperCase()}</SectionLabel>
            <div className="flex items-center gap-2">
              <span
                className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${REG_PILL[regulation.status] ?? "bg-rc-surface text-rc-ink-soft"}`}
              >
                {regulation.status.toUpperCase()}
              </span>
              <span className="font-rc-mono text-[11px] text-rc-ink-soft">
                {regulation.detail}
              </span>
            </div>
          </div>
        )}

        {/* Community catch pool */}
        {poolLines.length > 0 && (
          <div className="mt-5 pb-5 border-b border-rc-rule-soft">
            <SectionLabel>
              ANGLERS HERE CATCH MOST ON
              <span className="text-rc-ink-mute normal-case">
                {" "}
                · {pool?.total_catches_in_window} logged
              </span>
            </SectionLabel>
            <div className="grid grid-cols-2 gap-y-2 gap-x-4">
              {poolLines.map((l) => (
                <div key={l.label} className="flex items-baseline justify-between gap-2">
                  <span className="font-rc-mono text-[11px] text-rc-ink-soft">{l.label}</span>
                  <span className="font-rc-mono text-[11px] font-medium text-rc-ink">
                    {l.value}
                    <span className="text-rc-ink-mute"> {l.rate}%</span>
                  </span>
                </div>
              ))}
            </div>
            {topLures.length > 0 && (
              <p className="font-rc-mono text-[11px] text-rc-ink-soft mt-2">
                Top lures:{" "}
                <span className="text-rc-ink">
                  {topLures.map((l) => titleCase(l.value)).join(", ")}
                </span>
              </p>
            )}
          </div>
        )}

        {/* Recent catch signals */}
        {catches.length > 0 && (
          <div className="mt-5 pb-5 border-b border-rc-rule-soft">
            <SectionLabel>RECENT CATCHES</SectionLabel>
            <ul className="space-y-2.5">
              {catches.map((c) => (
                <li key={c.id}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-rc-mono text-[11px] font-semibold text-rc-ink">
                      {c.speciesName ?? "Catch"}
                    </span>
                    <span className="font-rc-mono text-[10px] text-rc-ink-mute">
                      {c.daysAgo != null
                        ? c.daysAgo === 0
                          ? "today"
                          : `${c.daysAgo}d ago`
                        : ""}
                    </span>
                  </div>
                  <p className="font-rc-mono text-[11px] text-rc-ink-soft leading-snug mt-0.5 line-clamp-2">
                    {c.excerpt}
                  </p>
                  {c.sourceUrl && (
                    <a
                      href={c.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-rc-mono text-[10px] text-rc-brand hover:underline mt-0.5"
                    >
                      {c.sourceDomain ?? "source"}
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Why this score (evidence) — lazy on expand */}
        {species && (
          <div className="mt-5 pb-5 border-b border-rc-rule-soft">
            <button
              type="button"
              onClick={() => setWhyOpen((v) => !v)}
              className="flex items-center justify-between w-full"
              aria-expanded={whyOpen}
            >
              <span className="rc-label text-[9px]">WHY THIS SCORE</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-rc-ink-mute transition-transform ${whyOpen ? "rotate-180" : ""}`}
              />
            </button>
            {whyOpen && (
              <div className="mt-3">
                {evidenceLoading && !evidence ? (
                  <p className="font-rc-mono text-[11px] text-rc-ink-mute">Loading evidence…</p>
                ) : evidence ? (
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-baseline justify-between">
                        <span className="font-rc-mono text-[11px] text-rc-ink-soft">
                          Confidence
                        </span>
                        <span className="font-rc-mono text-[11px] font-semibold text-rc-ink">
                          {confidenceLabel(evidence.overall_confidence)} ·{" "}
                          {Math.round(evidence.overall_confidence * 100)}%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-rc-rule-soft mt-1.5 overflow-hidden">
                        <div
                          className="h-full bg-rc-brand rounded-full"
                          style={{ width: `${Math.round(evidence.overall_confidence * 100)}%` }}
                        />
                      </div>
                    </div>
                    {Object.keys(evidence.source_counts).length > 0 && (
                      <p className="font-rc-mono text-[11px] text-rc-ink-soft">
                        {evidence.total_evidence} sources:{" "}
                        <span className="text-rc-ink">
                          {Object.entries(evidence.source_counts)
                            .map(([k, n]) => `${n} ${titleCase(k)}`)
                            .join(" · ")}
                        </span>
                      </p>
                    )}
                    {evidence.algo_variables.filter((v) => v.is_enabled).length > 0 && (
                      <ul className="space-y-1">
                        {evidence.algo_variables
                          .filter((v) => v.is_enabled)
                          .sort((a, b) => (b.confidence_score ?? 0) - (a.confidence_score ?? 0))
                          .slice(0, 4)
                          .map((v) => (
                            <li
                              key={v.id}
                              className="flex items-baseline justify-between gap-3"
                            >
                              <span className="font-rc-mono text-[11px] text-rc-ink-soft">
                                {titleCase(v.variable_name)}
                              </span>
                              <span className="font-rc-mono text-[11px] text-rc-ink-mute">
                                {v.confidence_score != null
                                  ? `${Math.round(v.confidence_score * 100)}%`
                                  : "—"}
                              </span>
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <p className="font-rc-mono text-[11px] text-rc-ink-mute">
                    No evidence recorded yet.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* 24h chart */}
        <div className="mt-5">
          <HourlyBars hours={spot.hours24} tz={tz} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 px-4 py-4 border-t border-rc-rule-soft">
        <Link
          href={spotHref}
          className="flex-1 text-center px-4 py-2.5 rounded-lg bg-rc-brand hover:bg-rc-brand-hover text-white font-rc-mono text-xs font-semibold tracking-[0.08em] transition-colors"
        >
          VIEW 14-DAY REPORT →
        </Link>
        <Link
          href="/profile/custom-alerts"
          className="px-4 py-2.5 rounded-lg border border-rc-rule text-rc-ink font-rc-mono text-xs font-semibold tracking-[0.08em] hover:bg-rc-surface transition-colors text-center"
        >
          SET ALERT
        </Link>
      </div>
    </div>
  );
}

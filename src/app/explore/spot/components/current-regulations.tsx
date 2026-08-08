"use client";

import type { LiveRegulation, RegStatus } from "@/lib/bluecaster/live-spot-types";
import { regulatorFor } from "@/lib/regions";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const STATUS_LABEL: Record<RegStatus, string> = {
  Open: "Retention open",
  Release: "Catch & release",
  Closed: "Closed",
};

// Soft status pill — same tier language as the rest of the page.
const STATUS_PILL: Record<RegStatus, string> = {
  Open: "bg-rc-good-bg text-rc-good-ink",
  Release: "bg-rc-fair-bg text-rc-fair-ink",
  Closed: "bg-rc-poor-bg text-rc-poor-ink",
};

// Compact status tag for the other-species row.
const STATUS_TAG: Record<RegStatus, string> = {
  Open: "text-rc-good-ink",
  Release: "text-rc-fair-ink",
  Closed: "text-rc-poor-ink",
};

/** "2026-08-01" | "08-01" → "Aug 1". Null-safe. Year (when present) is a
 *  convention on annual MM-DD windows, so only month/day are shown. */
function fmtMD(iso: string | null): string | null {
  if (!iso) return null;
  const m = /(?:\d{4}-)?(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const mon = MONTHS[Number(m[1]) - 1];
  if (!mon) return null;
  return `${mon} ${Number(m[2])}`;
}

// A limit we have no published figure for. A null limit must never render as a
// bare "0" — that reads as "zero allowed" (a closure), the opposite of "unknown".
const NOT_PUBLISHED = "Not published";

/** The daily-retention allowance (quantity). */
function limitText(r: LiveRegulation): string {
  if (r.status === "Closed") return "No retention";
  if (r.status === "Release" || r.dailyLimit === 0) return "Catch-and-release only";
  if (r.dailyLimit != null && r.dailyLimit > 0)
    return `${r.dailyLimit} per day`;
  return "See DFO";
}

/** Possession allowance (how many you may hold), or "Not published". */
function possessionText(r: LiveRegulation): string {
  if (r.possessionLimit != null && r.possessionLimit > 0)
    return `${r.possessionLimit} in possession`;
  return NOT_PUBLISHED;
}

/** Annual/seasonal quota, or "Not published". */
function annualText(r: LiveRegulation): string {
  if (r.annualLimit != null && r.annualLimit > 0)
    return `${r.annualLimit} per year`;
  return NOT_PUBLISHED;
}

/** The size/length rule — min, max, or a slot. */
function sizeText(r: LiveRegulation): string | null {
  const min = r.sizeLimitCm;
  const max = r.sizeLimitMaxCm;
  if (min != null && max != null) return `${min}–${max} cm slot`;
  if (min != null) return `Minimum ${min} cm`;
  if (max != null) return `Maximum ${max} cm`;
  return null;
}

/**
 * ISO timestamp → "synced 3 days ago". Coarse relative buckets.
 *
 * `nowMs` is passed in rather than read from the clock: this renders inside a
 * page served from the ISR cache, and a relative date computed independently on
 * the server and the client disagrees as soon as the cached copy crosses a day
 * boundary — which aborted hydration. See `useSpotClock`.
 */
function syncedText(iso: string | null, nowMs: number): string {
  if (!iso) return "sync date unavailable";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "sync date unavailable";
  const days = Math.floor((nowMs - then) / 86_400_000);
  if (days <= 0) return "synced today";
  if (days === 1) return "synced yesterday";
  if (days < 30) return `synced ${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `synced ${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(days / 365);
  return `synced ${years} year${years === 1 ? "" : "s"} ago`;
}

/**
 * The current, in-effect regulations for the active species at this spot,
 * broken out — daily quantity, size/length, gear, and any other restrictions —
 * rather than collapsed into a one-liner or a bare status pill. Other species
 * at the spot are summarized compactly below. Reference only; DFO is authority.
 */
export default function CurrentRegulations({
  regulations,
  selectedId,
  areaCode,
  region,
  syncedAt,
  nowMs,
}: {
  regulations: LiveRegulation[];
  selectedId: string | null;
  areaCode: string | null;
  /** Province/state — picks the authority this panel names and links to. */
  region: string | null;
  syncedAt: string | null;
  /** Reference instant for the relative "synced …" label. */
  nowMs: number;
}) {
  if (!regulations.length) return null;

  // "Always check with DFO" is advice to verify against the governing
  // authority — which is WDFW, not DFO, for a Washington spot.
  const regulator = regulatorFor(region);

  const active =
    regulations.find((r) => r.speciesId === selectedId) ?? regulations[0];
  const others = regulations.filter((r) => r !== active);

  // Retention-context rows (possession + annual quota) only make sense where you
  // may actually keep fish; under a closure/release the daily row already says so.
  const canRetain = active.status === "Open";
  // Unverified default rows render muted, never dressed up as confirmed regs.
  const isExpected = active.confidence === "expected";

  const size = sizeText(active);
  const season =
    active.seasonOpenDate && active.seasonCloseDate
      ? `${fmtMD(active.seasonOpenDate)} – ${fmtMD(active.seasonCloseDate)}`
      : null;
  const reopen =
    active.status !== "Open" && active.nextOpenDate
      ? `${fmtMD(active.nextOpenDate)}${active.nextOpenSummary ? ` · ${active.nextOpenSummary}` : ""}`
      : null;

  // `muted` forces a value to the muted ink regardless of confidence — used for
  // "Not published", which is an absence, not a confirmed rule.
  const rows: Array<{ label: string; value: string; muted?: boolean }> = [
    { label: "Daily limit", value: limitText(active) },
    ...(canRetain
      ? [
          {
            label: "Possession",
            value: possessionText(active),
            muted: active.possessionLimit == null || active.possessionLimit <= 0,
          },
        ]
      : []),
    ...(size ? [{ label: "Size", value: size }] : []),
    ...(active.gearRestrictions
      ? [{ label: "Gear", value: active.gearRestrictions }]
      : []),
    ...(canRetain
      ? [
          {
            label: "Annual quota",
            value: annualText(active),
            muted: active.annualLimit == null || active.annualLimit <= 0,
          },
        ]
      : []),
    ...(active.notes ? [{ label: "Other", value: active.notes }] : []),
    ...(season ? [{ label: "Season", value: season }] : []),
    ...(reopen ? [{ label: "Reopens", value: reopen }] : []),
  ];

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-lg font-bold text-rc-ink">Current regulations</h3>
        <span className="font-rc-mono text-[11px] text-rc-ink-mute shrink-0">
          In effect now
        </span>
      </div>
      <p className="text-sm text-rc-ink-soft mt-0.5">
        What you can keep at this spot today
      </p>

      <div className="mt-4 rounded border border-rc-rule bg-rc-panel p-5">
        {/* Active species header */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-base font-bold text-rc-ink">
            {active.speciesCommon}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {isExpected && (
              <span className="px-2 py-0.5 rounded border border-dashed border-rc-rule font-rc-mono text-[9px] font-bold uppercase tracking-[0.08em] text-rc-ink-mute">
                Expected
              </span>
            )}
            <span
              className={`px-2.5 py-1 rounded font-rc-mono text-[10px] font-bold uppercase tracking-[0.08em] ${STATUS_PILL[active.status]}`}
            >
              {STATUS_LABEL[active.status]}
            </span>
          </div>
        </div>

        {/* Broken-out rules. Expected regs read muted; "Not published" values
            (row.muted) are always muted regardless of confidence. */}
        <dl className="mt-4 divide-y divide-rc-rule">
          {rows.map((row) => (
            <div key={row.label} className="flex gap-4 py-2.5">
              <dt className="w-24 shrink-0 font-rc-mono text-[11px] uppercase tracking-[0.06em] text-rc-ink-mute pt-0.5">
                {row.label}
              </dt>
              <dd
                className={`text-sm flex-1 ${
                  row.muted || isExpected ? "text-rc-ink-mute" : "text-rc-ink"
                }`}
              >
                {row.value}
              </dd>
            </div>
          ))}
        </dl>

        {/* Other species at this spot */}
        {others.length > 0 && (
          <div className="mt-4 pt-4 border-t border-rc-rule">
            <span className="font-rc-mono text-[10px] uppercase tracking-[0.08em] text-rc-ink-mute">
              Other species here
            </span>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
              {others.map((r) => (
                <span
                  key={r.speciesId ?? r.speciesCommon}
                  className="text-[13px] text-rc-ink-soft"
                >
                  {r.speciesCommon}{" "}
                  <span className={`font-semibold ${STATUS_TAG[r.status]}`}>
                    {STATUS_LABEL[r.status]}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        <a
          href={regulator.url}
          target="_blank"
          rel="noreferrer"
          className="inline-block mt-4 font-rc-mono text-[11px] font-medium text-rc-ink-mute hover:text-rc-ink underline"
        >
          Always check with {regulator.name} ↗
        </a>
      </div>

      {/* Provenance — text-only source + freshness attribution. */}
      <p className="mt-2 font-rc-mono text-[10px] text-rc-ink-mute">
        Source: {regulator.sourceName}
        {areaCode ? ` · ${regulator.areaLabel} ${areaCode}` : ""} ·{" "}
        {syncedText(syncedAt, nowMs)}
      </p>
    </div>
  );
}

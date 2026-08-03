"use client";

import type { LiveRegulation, RegStatus } from "@/lib/bluecaster/live-spot-types";

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

/** The daily-retention allowance (quantity). */
function limitText(r: LiveRegulation): string {
  if (r.status === "Closed") return "No retention";
  if (r.status === "Release" || r.dailyLimit === 0) return "Catch-and-release only";
  if (r.dailyLimit != null && r.dailyLimit > 0)
    return `${r.dailyLimit} per day`;
  return "See DFO";
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
 * The current, in-effect regulations for the active species at this spot,
 * broken out — daily quantity, size/length, gear, and any other restrictions —
 * rather than collapsed into a one-liner or a bare status pill. Other species
 * at the spot are summarized compactly below. Reference only; DFO is authority.
 */
export default function CurrentRegulations({
  regulations,
  selectedId,
  areaCode,
}: {
  regulations: LiveRegulation[];
  selectedId: string | null;
  areaCode: string | null;
}) {
  if (!regulations.length) return null;

  const active =
    regulations.find((r) => r.speciesId === selectedId) ?? regulations[0];
  const others = regulations.filter((r) => r !== active);

  const size = sizeText(active);
  const season =
    active.seasonOpenDate && active.seasonCloseDate
      ? `${fmtMD(active.seasonOpenDate)} – ${fmtMD(active.seasonCloseDate)}`
      : null;
  const reopen =
    active.status !== "Open" && active.nextOpenDate
      ? `${fmtMD(active.nextOpenDate)}${active.nextOpenSummary ? ` · ${active.nextOpenSummary}` : ""}`
      : null;

  const rows: Array<{ label: string; value: string }> = [
    { label: "Daily limit", value: limitText(active) },
    ...(size ? [{ label: "Size", value: size }] : []),
    ...(active.gearRestrictions
      ? [{ label: "Gear", value: active.gearRestrictions }]
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
          {areaCode ? `PFMA ${areaCode}` : "DFO"} · in effect now
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
          <span
            className={`shrink-0 px-2.5 py-1 rounded font-rc-mono text-[10px] font-bold uppercase tracking-[0.08em] ${STATUS_PILL[active.status]}`}
          >
            {STATUS_LABEL[active.status]}
          </span>
        </div>

        {/* Broken-out rules */}
        <dl className="mt-4 divide-y divide-rc-rule">
          {rows.map((row) => (
            <div key={row.label} className="flex gap-4 py-2.5">
              <dt className="w-24 shrink-0 font-rc-mono text-[11px] uppercase tracking-[0.06em] text-rc-ink-mute pt-0.5">
                {row.label}
              </dt>
              <dd className="text-sm text-rc-ink flex-1">{row.value}</dd>
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
          href="https://www.pac.dfo-mpo.gc.ca/fm-gp/rec/index-eng.html"
          target="_blank"
          rel="noreferrer"
          className="inline-block mt-4 font-rc-mono text-[11px] font-medium text-rc-ink-mute hover:text-rc-ink underline"
        >
          Always check with DFO ↗
        </a>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import type { LiveRegulation, RegStatus } from "@/lib/bluecaster/live-spot-types";

/** How many sibling species chips to show before collapsing into "more →". */
const MAX_SIBLINGS = 4;

const TAG_LABEL: Record<RegStatus, string> = {
  Open: "Open",
  Release: "C&R",
  Closed: "Closed",
};

/** Solid tag (active/expanded chip). */
const TAG_SOLID: Record<RegStatus, string> = {
  Open: "bg-rc-good text-white",
  Release: "bg-rc-fair text-white",
  Closed: "bg-rc-poor text-white",
};

/** Text-only tag (sibling chips). */
const TAG_TEXT: Record<RegStatus, string> = {
  Open: "text-rc-good-ink",
  Release: "text-rc-fair-ink",
  Closed: "text-rc-poor-ink",
};

/** Concise one-line summary, falling back to the structured fields. */
function oneLiner(r: LiveRegulation): string {
  if (r.detail) return r.detail;
  const parts: string[] = [];
  if (r.dailyLimit != null) parts.push(`${r.dailyLimit} / day`);
  if (r.sizeLimitCm != null && r.sizeLimitMaxCm != null)
    parts.push(`${r.sizeLimitCm}–${r.sizeLimitMaxCm} cm`);
  else if (r.sizeLimitCm != null) parts.push(`min ${r.sizeLimitCm} cm`);
  else if (r.sizeLimitMaxCm != null) parts.push(`max ${r.sizeLimitMaxCm} cm`);
  if (r.gearRestrictions) parts.push(r.gearRestrictions);
  return parts.join(" · ") || "See DFO";
}

/**
 * Full-width DFO regulations band — the selected species expanded with its
 * limits, sibling species as switcher chips, and a DFO disclaimer. Pulls from
 * the spot-page `regulations` payload; clicking a switchable species chip
 * changes the page's driver species. Reference only.
 */
export default function SpotRegulations({
  regulations,
  selectedId,
  switchableIds,
  onSelect,
  areaCode,
}: {
  regulations: LiveRegulation[];
  selectedId: string | null;
  /** Species ids that can be made the page driver (clickable chips). */
  switchableIds: string[];
  onSelect: (id: string) => void;
  areaCode: string | null;
}) {
  if (!regulations.length) return null;

  const switchable = new Set(switchableIds);
  const active = regulations.find((r) => r.speciesId === selectedId) ?? null;
  const others = regulations.filter((r) => r !== active);
  const shown = others.slice(0, MAX_SIBLINGS);
  const overflow = others.length - shown.length;

  return (
    <section className="border-y border-rc-fair-border bg-rc-fair-bg/40">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-6 py-3">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="flex flex-col gap-0.5 shrink-0">
            <span className="text-[13px] uppercase tracking-[0.12em] font-semibold text-rc-fair-ink">
              Regulations
            </span>
            {areaCode && (
              <span className="text-[11px] font-semibold text-rc-fair-ink">
                Area {areaCode}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
            {/* Active species — expanded with its limits (one line; full text on hover) */}
            {active && (
              <div
                className="flex items-baseline gap-2 rounded-md bg-rc-panel border-2 border-rc-brand px-3 py-1.5 shadow-sm max-w-full min-w-0"
                title={oneLiner(active)}
              >
                <span
                  className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide shrink-0 ${TAG_SOLID[active.status]}`}
                >
                  {TAG_LABEL[active.status]}
                </span>
                <span className="font-semibold text-rc-ink text-[15px] shrink-0">
                  {active.speciesCommon}
                </span>
                <span className="text-[15px] text-rc-ink-soft truncate min-w-0">
                  {oneLiner(active)}
                </span>
              </div>
            )}

            {/* Sibling species — clickable if switchable, else informational */}
            {shown.map((r) => {
              const canSwitch = r.speciesId != null && switchable.has(r.speciesId);
              if (canSwitch) {
                return (
                  <button
                    key={r.speciesId}
                    type="button"
                    onClick={() => onSelect(r.speciesId as string)}
                    title={oneLiner(r)}
                    className="flex items-baseline gap-2 rounded-md border border-rc-rule bg-rc-panel px-2.5 py-1 text-[13px] whitespace-nowrap hover:border-rc-brand hover:bg-rc-brand-soft/40 transition-colors"
                  >
                    <span className="font-medium text-rc-ink-soft">
                      {r.speciesCommon}
                    </span>
                    <span
                      className={`text-[10px] uppercase tracking-wide font-semibold ${TAG_TEXT[r.status]}`}
                    >
                      {TAG_LABEL[r.status]}
                    </span>
                  </button>
                );
              }
              return (
                <div
                  key={r.speciesId ?? r.speciesCommon}
                  title={oneLiner(r)}
                  className={`flex items-baseline gap-2 rounded-md border px-2.5 py-1 text-[13px] whitespace-nowrap ${
                    r.status === "Closed"
                      ? "border-rc-poor/30 bg-rc-poor-bg"
                      : "border-rc-rule bg-rc-surface"
                  }`}
                >
                  <span
                    className={`font-medium ${
                      r.status === "Closed" ? "text-rc-poor-ink" : "text-rc-ink-soft"
                    }`}
                  >
                    {r.speciesCommon}
                  </span>
                  <span
                    className={`text-[10px] uppercase tracking-wide font-semibold ${TAG_TEXT[r.status]}`}
                  >
                    {TAG_LABEL[r.status]}
                  </span>
                </div>
              );
            })}

            {/* "more" → full regulations */}
            {overflow > 0 && (
              <Link
                href="/regulations"
                className="flex items-center gap-1 rounded-md border border-rc-rule bg-rc-panel px-2.5 py-1 text-[13px] text-rc-fair-ink whitespace-nowrap hover:border-rc-fair hover:bg-rc-fair-bg/40 transition-colors"
              >
                <span className="font-medium">+{overflow} more</span>
                <span>→</span>
              </Link>
            )}

            {/* DFO disclaimer, pinned right */}
            <a
              href="https://www.pac.dfo-mpo.gc.ca/fm-gp/rec/index-eng.html"
              target="_blank"
              rel="noreferrer"
              className="ml-auto text-[11px] font-medium text-rc-fair-ink hover:text-rc-fair underline shrink-0"
            >
              Always check with DFO ↗
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

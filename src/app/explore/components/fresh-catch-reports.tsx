"use client";

// "Fresh catch reports" — the consumer face of BlueCaster's scraped intel.
//
//   • FreshCatchBadge — rail card + drawer name row. Locked: a neutral lock,
//     no colour and no number. Unlocked: verdict colour + report count.
//   • FreshCatchBlock — drawer / spot page. Locked: an upsell row. Unlocked:
//     hit-rate bar, summary line, and the per-species split.
//
// A spot with no reports in the window renders nothing at all — an empty
// "0 reports" row would be noise on the ~85% of spots with no coverage in any
// given three weeks.

import { Lock } from "lucide-react";
import {
  freshVerdictStyle,
  reportAge,
  type RailFreshCatch,
} from "@/app/explore/lib/fresh-catch-types";

/** Compact badge for a spot name row.
 *  When locked and given `onUnlock`, the badge itself is the paywall entry
 *  point. It sits inside the card's <Link>, so the click has to be stopped
 *  before it navigates to the spot page instead of opening the modal. */
export function FreshCatchBadge({
  fresh,
  onUnlock,
}: {
  fresh: RailFreshCatch;
  onUnlock?: () => void;
}) {
  if (fresh.locked) {
    const cls =
      "inline-flex shrink-0 items-center gap-1 rounded bg-rc-surface px-1.5 py-0.5 font-rc-mono text-[9px] uppercase tracking-[0.06em] text-rc-ink-mute";
    if (!onUnlock) {
      return (
        <span title="Catch reports tracked here — see them with Pro" className={cls}>
          <Lock className="h-2.5 w-2.5" />
          Reports
        </span>
      );
    }
    return (
      <button
        type="button"
        title="Catch reports tracked here — see them with Pro"
        aria-label="Unlock fresh catch reports"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onUnlock();
        }}
        className={`${cls} transition-colors hover:bg-rc-rule hover:text-rc-ink`}
      >
        <Lock className="h-2.5 w-2.5" />
        Reports
      </button>
    );
  }
  const v = freshVerdictStyle(fresh.verdict);
  return (
    <span
      title={`${fresh.count} recent catch report${fresh.count === 1 ? "" : "s"}`}
      className={`inline-flex shrink-0 items-center rounded px-1.5 py-0.5 font-rc-mono text-[9px] uppercase tracking-[0.06em] ${v.cls}`}
    >
      {fresh.count} {fresh.count === 1 ? "report" : "reports"}
    </span>
  );
}

interface BlockProps {
  fresh: RailFreshCatch;
  days: number;
  /** speciesId → display name. Missing names fold into "Other species". */
  speciesNames?: Record<string, string>;
  onUpgrade?: () => void;
  className?: string;
}

export function FreshCatchBlock({
  fresh,
  days,
  speciesNames = {},
  onUpgrade,
  className = "",
}: BlockProps) {
  const header = (
    <div className="flex items-baseline justify-between gap-2">
      <span className="font-rc-mono text-[10px] uppercase tracking-[0.08em] text-rc-ink-mute">
        Fresh catch reports
      </span>
      <span className="font-rc-mono text-[9px] uppercase tracking-[0.06em] text-rc-ink-mute">
        last {days} days
      </span>
    </div>
  );

  // Locked: say the spot is tracked and stop. No verdict, no count, no colour —
  // a free user must not be able to read how it's fishing off this block.
  if (fresh.locked) {
    return (
      <div className={className}>
        {header}
        <button
          type="button"
          onClick={onUpgrade}
          className="mt-2 flex w-full items-center gap-2.5 rounded border border-rc-rule bg-rc-surface px-3 py-2.5 text-left transition-colors hover:bg-rc-panel"
        >
          <Lock className="h-3.5 w-3.5 shrink-0 text-rc-ink-mute" />
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] text-rc-ink">
              Catch reports tracked here
            </span>
            <span className="block font-rc-mono text-[10px] text-rc-ink-mute">
              See what anglers caught with Pro
            </span>
          </span>
          <span className="shrink-0 font-rc-mono text-[10px] font-bold text-rc-brand">
            →
          </span>
        </button>
      </div>
    );
  }

  const total = fresh.count ?? 0;
  // Activity signal, NOT a landed-ratio. A run of reports means the spot is
  // being fished right now; "X of Y landed" read as a coin-flip and buried that.
  // The landed/reported split still lives in the per-species detail below.
  const activity =
    total >= 8
      ? { label: "Hot", cls: "bg-rc-good text-white" }
      : { label: "Active", cls: "bg-rc-good-bg text-rc-good-ink" };

  // The headline counts OUTINGS; these rows count per-species mentions. One
  // post naming two species is one outing above and two rows below, so the two
  // do not — and should not — add up. The rows are reconciled only against each
  // other: "Other species" sweeps up entries we have no display name for plus
  // anything past the top few, so nothing in the species view silently vanishes.
  const entries = Object.entries(fresh.species ?? {});
  const named = entries
    .filter(([id]) => speciesNames[id])
    .sort((a, b) => b[1].count - a[1].count);
  const rows = named.slice(0, 5);

  const shownCount = rows.reduce((a, [, s]) => a + s.count, 0);
  const shownPos = rows.reduce((a, [, s]) => a + s.positive, 0);
  const speciesTotal = entries.reduce((a, [, s]) => a + s.count, 0);
  const speciesPos = entries.reduce((a, [, s]) => a + s.positive, 0);
  const otherCount = speciesTotal - shownCount;
  const otherPos = Math.max(0, speciesPos - shownPos);

  return (
    <div className={className}>
      {header}
      <div className="mt-2 flex items-center gap-2">
        <span
          className={`shrink-0 rounded px-2 py-0.5 font-rc-mono text-[10px] font-bold uppercase tracking-[0.08em] ${activity.cls}`}
        >
          {activity.label}
        </span>
        <span className="text-[15px] font-bold text-rc-ink">
          {total} recent report{total === 1 ? "" : "s"}
        </span>
        {fresh.latestDate && (
          <span className="ml-auto shrink-0 font-rc-mono text-[10px] text-rc-ink-mute">
            latest {reportAge(fresh.latestDate)}
          </span>
        )}
      </div>

      {(rows.length > 0 || otherCount > 0) && (
        <>
        <div className="mt-3 font-rc-mono text-[9px] uppercase tracking-[0.06em] text-rc-ink-mute">
          Landed / reported, by species
        </div>
        <ul className="mt-1 flex flex-col gap-1">
          {rows.map(([id, s]) => (
            <li key={id} className="flex items-center justify-between gap-2">
              <span className="truncate text-[12px] text-rc-ink">
                {speciesNames[id]}
              </span>
              <span className="shrink-0 font-rc-mono text-[11px] text-rc-ink-mute">
                <span className={s.positive > 0 ? "text-rc-good" : undefined}>
                  {s.positive}
                </span>
                {` / ${s.count}`}
              </span>
            </li>
          ))}
          {otherCount > 0 && (
            <li className="flex items-center justify-between gap-2">
              <span className="truncate text-[12px] text-rc-ink-mute">
                Other species
              </span>
              <span className="shrink-0 font-rc-mono text-[11px] text-rc-ink-mute">
                <span className={otherPos > 0 ? "text-rc-good" : undefined}>
                  {otherPos}
                </span>
                {` / ${otherCount}`}
              </span>
            </li>
          )}
        </ul>
        </>
      )}
    </div>
  );
}

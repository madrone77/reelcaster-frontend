"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Target,
  Check,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { TIER_PILL, tierFor, type SpeciesOption } from "../lib/explore-data";

/** The three score bands, as the pins draw them. `tierFor` owns the numbers. */
export type ScoreFloor = 0 | 55 | 75;

interface MobileFilterSheetProps {
  open: boolean;
  onClose: () => void;
  relief: boolean;
  /** The depth gate applies: the bathymetry row becomes the way back.
   *  See @/lib/preview-gate. */
  depthLocked?: boolean;
  onUnlockDepth?: () => void;
  currents: boolean;
  wind: boolean;
  onToggleRelief: () => void;
  onToggleCurrents: () => void;
  onToggleWind: () => void;
  species: SpeciesOption[];
  speciesFilter: string | null;
  onSpeciesChange: (id: string | null) => void;
  /** Minimum score a spot must reach to stay on the map. */
  scoreFloor: ScoreFloor;
  onScoreFloorChange: (floor: ScoreFloor) => void;
  reportsOnly: boolean;
  onToggleReports: () => void;
  /** Spots in view carrying a report, at the current floor. */
  reportsCount: number;
  savedOnly: boolean;
  onToggleSaved: () => void;
  savedCount: number;
  /** False for a viewer with no saved spots — the row would only ever empty
   *  the map, so it isn't offered. */
  savedAvailable: boolean;
  /** How many spots survive every filter, in view. Counts the CTA. */
  matchCount: number;
  /** How many filters are off their default. Drives the header chip + Reset. */
  activeFilters: number;
  onReset: () => void;
}

/* ── The system's controls, as classes ──────────────────────────────────
 * Nothing here is invented for this sheet. The radiogroup is
 * components/ui/toggle-group.tsx (the units settings), the switch is the pill
 * from the notification preferences form, and the button is btn.primary.
 * Inlined rather than imported because each one wants full-width-in-a-sheet
 * geometry, and the shared components hug.
 *
 * The rule for which control a choice gets: exclusive → radiogroup, independent
 * → switch. That is what makes Currents/Wind read correctly (they are one
 * choice) without a comment explaining the rule to the user.
 */
const SEG_WRAP = "flex rounded-sm border border-rc-rule bg-rc-surface p-0.5";
const SEG_BTN =
  "flex-1 min-h-11 px-2 rounded-[3px] font-rc-mono text-xs uppercase tracking-wide transition-colors duration-[180ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-1 focus-visible:ring-offset-rc-surface";
const SEG_ON = "bg-rc-brand text-white";
const SEG_OFF = "text-rc-ink-mute hover:text-rc-ink";

function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={SEG_WRAP}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`${SEG_BTN} ${active ? SEG_ON : SEG_OFF}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function SwitchRow({
  label,
  count,
  checked,
  onChange,
}: {
  label: string;
  /** Spots this would leave in view. Omitted for a display toggle, which
   *  doesn't change how many spots there are. */
  count?: number;
  checked: boolean;
  onChange: () => void;
}) {
  // A filter with nothing to keep is a dead end: it empties the map and the
  // only way back is to notice and undo it. The count next to it already says
  // why it can't be pressed.
  const dead = count === 0 && !checked;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={dead}
      onClick={onChange}
      className={`flex min-h-11 w-full items-center gap-3 text-left ${dead ? "opacity-60" : ""}`}
    >
      <span className="flex-1 text-sm font-semibold text-rc-ink">{label}</span>
      {count != null && (
        <span className="font-rc-mono text-[11px] tabular-nums text-rc-ink-mute">
          {count}
        </span>
      )}
      <span
        className={`relative h-7 w-14 shrink-0 rounded-full transition-colors duration-[180ms] ${
          checked ? "bg-rc-brand" : "bg-rc-rule"
        }`}
      >
        <span
          className={`absolute top-0.5 left-1 h-6 w-6 rounded-full border bg-white transition-transform duration-[180ms] ${
            checked ? "translate-x-6 border-white" : "border-rc-rule"
          }`}
        />
      </span>
    </button>
  );
}

/** One species in the picker: a full-width row, thumb-sized, with the best
 *  score anywhere in view on the right so the choice is informed. */
function SpeciesRow({
  label,
  hint,
  score,
  active,
  onClick,
}: {
  label: string;
  hint?: string;
  score?: number | null;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex min-h-11 w-full items-center gap-3 rounded-sm px-3 py-3 text-left transition-colors duration-[180ms] ${
        active ? "bg-rc-brand-soft" : "hover:bg-rc-surface"
      }`}
    >
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-[15px] font-semibold ${
            active ? "text-rc-brand" : "text-rc-ink"
          }`}
        >
          {label}
        </span>
        {hint && (
          <span className="mt-0.5 block truncate text-xs text-rc-ink-mute">
            {hint}
          </span>
        )}
      </span>
      {score != null && (
        <span
          className={`shrink-0 rounded-sm px-2 py-0.5 font-rc-mono text-[11px] font-semibold ${
            TIER_PILL[tierFor(score)]
          }`}
        >
          {score}
        </span>
      )}
      <Check
        className={`w-4 h-4 shrink-0 ${active ? "text-rc-brand" : "text-transparent"}`}
        aria-hidden
      />
    </button>
  );
}

/**
 * Mobile (<lg) filter sheet opened by the location header's filter button.
 *
 * It was named "Map filters" while only one control in it filtered anything:
 * species narrowed the map, everything else was chart display. It now carries
 * the filters that name implies — a score floor at the pins' own band edges, a
 * fresh-reports toggle and saved-only — all computed on the RailSpots the shell
 * already holds, so nothing new is fetched to run them.
 *
 * The CTA counts what survives, the header says how many filters are on, and
 * Reset clears them: a filtered map and an unfiltered one used to look
 * identical from the outside, which is how you end up staring at three pins
 * wondering where the water went.
 *
 * Near me is gone from here — it moves the camera, it doesn't filter, and it
 * was the heaviest thing on the screen. It sits beside Add spot in the location
 * header now, with the other map moves.
 *
 * Species is a pushed subview of full-width rows, not the <select> the desktop
 * bar uses. A native select on a phone hands the choice to a menu the page has
 * no say over: it opened as a cramped desktop-sized list of 11px rows in the
 * corner of the screen, nothing like the sheet it belonged to, and unreadable
 * in a session replay. Rows also have somewhere to put each species' best
 * score, which a select cannot show at all.
 */
export default function MobileFilterSheet({
  open,
  onClose,
  relief,
  depthLocked = false,
  onUnlockDepth,
  currents,
  wind,
  onToggleRelief,
  onToggleCurrents,
  onToggleWind,
  species,
  speciesFilter,
  onSpeciesChange,
  scoreFloor,
  onScoreFloorChange,
  reportsOnly,
  onToggleReports,
  reportsCount,
  savedOnly,
  onToggleSaved,
  savedCount,
  savedAvailable,
  matchCount,
  activeFilters,
  onReset,
}: MobileFilterSheetProps) {
  const [pane, setPane] = useState<"filters" | "species">("filters");

  // The sheet stays mounted while closed, so a reopen would otherwise land on
  // whichever pane it was left on.
  useEffect(() => {
    if (!open) setPane("filters");
  }, [open]);

  // Best score first: the order the payload hands over is object-key order,
  // which is arbitrary, and "which species is worth chasing" is the whole
  // question this list answers.
  const ranked = useMemo(
    () =>
      [...species].sort((a, b) => (b.bestScore ?? -1) - (a.bestScore ?? -1)),
    [species],
  );

  if (!open) return null;

  const selected = species.find((s) => s.id === speciesFilter) ?? null;
  // On Best bet the row names the species actually driving the pins, which is
  // the one thing "Best bet" alone never tells you.
  const leader = selected ?? ranked[0] ?? null;

  const pickSpecies = (id: string | null) => {
    onSpeciesChange(id);
    onClose();
  };

  const flow: "off" | "currents" | "wind" = currents
    ? "currents"
    : wind
      ? "wind"
      : "off";

  return (
    <>
      {/* Backdrop and sheet both clear the floating tab bar's z-50: the bar is
          part of what this sheet covers, so it dims with everything else
          instead of floating lit on top of the scrim. */}
      <div
        className="lg:hidden fixed inset-0 bg-black/30 z-[60]"
        onClick={onClose}
      />
      {/* Runs to the bottom edge. It used to stop short at
          --rc-tabbar-clearance, which left a band of dimmed map between the
          sheet and the tab bar — a slab floating in the middle of nothing. The
          gap was there because at bottom-0 the pill swallowed the bottom of
          the sheet, but the sheet sits ABOVE the bar's z-50 and covers it
          outright, so there is nothing left to clear: only the safe-area
          inset. The bar comes back when the sheet closes. */}
      <div
        className="lg:hidden fixed inset-x-0 bottom-0 z-[61] bg-rc-panel rounded-t-sm shadow-rc-panel animate-slide-up"
        role="dialog"
        aria-label={pane === "species" ? "Filter by species" : "Map filters"}
      >
        <div className="flex items-center gap-1 px-4 pt-4 pb-2">
          {pane === "species" && (
            <button
              type="button"
              onClick={() => setPane("filters")}
              aria-label="Back to map filters"
              className="-ml-2 p-2 rounded-sm text-rc-ink-mute hover:bg-rc-surface"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          <span className="rc-label flex-1">
            {pane === "species" ? "Species" : "Map filters"}
          </span>
          {pane === "filters" && activeFilters > 0 && (
            <>
              <span className="rounded-sm border border-rc-brand bg-rc-brand-soft px-1.5 py-0.5 font-rc-mono text-[10px] font-semibold uppercase tracking-wide text-rc-ink">
                {activeFilters} on
              </span>
              {/* Not .rc-label: it hard-codes ink-mute, and a Reset that reads
                  as disabled defeats the point of showing it at all. */}
              <button
                type="button"
                onClick={onReset}
                className="px-2 py-1 font-rc-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-rc-brand hover:text-rc-brand-hover"
              >
                Reset
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 p-2 rounded-sm text-rc-ink-mute hover:bg-rc-surface"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {pane === "species" ? (
          <div className="max-h-[45vh] overflow-y-auto overscroll-contain px-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <SpeciesRow
              label="Best bet"
              hint="Whichever species scores highest at each spot"
              active={speciesFilter === null}
              onClick={() => pickSpecies(null)}
            />
            {ranked.map((s) => (
              <SpeciesRow
                key={s.id}
                label={s.name}
                score={s.bestScore}
                active={s.id === speciesFilter}
                onClick={() => pickSpecies(s.id)}
              />
            ))}
          </div>
        ) : (
          <div className="max-h-[70vh] space-y-5 overflow-y-auto overscroll-contain px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            {species.length > 0 && (
              <div>
                <div className="rc-label mb-1.5">Species</div>
                <button
                  type="button"
                  onClick={() => setPane("species")}
                  className="flex min-h-11 w-full items-center gap-2 rounded-sm bg-rc-surface px-3 py-2.5 text-left"
                >
                  <Target className="w-4 h-4 shrink-0 text-rc-ink-mute" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-rc-ink">
                      {selected ? selected.name : "Best bet"}
                    </span>
                    {leader && (
                      <span className="mt-0.5 block truncate text-xs text-rc-ink-mute">
                        {selected
                          ? "Every pin scored for this species"
                          : `${leader.name} leads in this view`}
                      </span>
                    )}
                  </span>
                  {leader?.bestScore != null && (
                    <span
                      className={`shrink-0 rounded-sm px-2 py-0.5 font-rc-mono text-[11px] font-semibold ${
                        TIER_PILL[tierFor(leader.bestScore)]
                      }`}
                    >
                      {leader.bestScore}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 shrink-0 text-rc-ink-mute" />
                </button>
              </div>
            )}

            <div className="space-y-1">
              <div className="rc-label mb-1.5">Only show</div>
              {/* The cuts are tierFor's, so "75+" means the green the angler is
                  already reading off the pins. */}
              <Segmented<ScoreFloor>
                label="Minimum score"
                value={scoreFloor}
                onChange={onScoreFloorChange}
                options={[
                  { value: 0, label: "Any score" },
                  { value: 55, label: "55+" },
                  { value: 75, label: "75+" },
                ]}
              />
              <SwitchRow
                label="Reported in last 14 days"
                count={reportsCount}
                checked={reportsOnly}
                onChange={onToggleReports}
              />
              {savedAvailable && (
                <SwitchRow
                  label="Saved spots only"
                  count={savedCount}
                  checked={savedOnly}
                  onChange={onToggleSaved}
                />
              )}
            </div>

            <div className="space-y-1">
              <div className="rc-label mb-1.5">Map</div>
              {/* One control because it is one choice: the flow layer is
                  exclusive in useFlowLayer, and two chips said otherwise. */}
              <Segmented<"off" | "currents" | "wind">
                label="Water overlay"
                value={flow}
                onChange={(next) => {
                  if (next === flow) return;
                  if (next === "currents") onToggleCurrents();
                  else if (next === "wind") onToggleWind();
                  else if (flow === "currents") onToggleCurrents();
                  else onToggleWind();
                }}
                options={[
                  { value: "off", label: "No flow" },
                  { value: "currents", label: "Currents" },
                  { value: "wind", label: "Wind" },
                ]}
              />
              {/* Locked: a row, not a switch. A switch that flips back on its
                  own would read as a bug, and a missing row would leave the
                  phone with no way back at all — the desktop chip is the only
                  other one. */}
              {depthLocked ? (
                <button
                  type="button"
                  onClick={onUnlockDepth}
                  data-testid="depth-unlock-mobile"
                  className="flex min-h-12 w-full items-center justify-between gap-3 text-left text-base font-semibold text-rc-brand"
                >
                  Bathymetry
                  <span className="text-sm font-medium">Member</span>
                </button>
              ) : (
                <SwitchRow
                  label="Bathymetry"
                  checked={relief}
                  onChange={onToggleRelief}
                />
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={matchCount === 0}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-sm bg-rc-brand px-6 text-base font-bold uppercase tracking-wide text-white transition-colors hover:bg-rc-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-2 disabled:opacity-60"
            >
              {matchCount === 0
                ? "No spots match"
                : `Show ${matchCount} spot${matchCount === 1 ? "" : "s"}`}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

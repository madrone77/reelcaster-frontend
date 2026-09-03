"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Layers, Mountain, Waves, Wind } from "lucide-react";
import type { FlowKind } from "../lib/use-flow";

/**
 * The phone's layers button, bottom-left of the map above the spot sheet.
 *
 * It is always the plain layers glyph. A tap opens a short menu above it with
 * the three things the map can draw over the chart, Bathymetry, Currents and
 * Wind, each a checkbox row that turns its layer on or off. A pick closes the
 * menu: choosing Currents is answered by the field starting and the hour bar
 * arriving, and a menu still standing over both was in the way of the thing
 * just asked for. Nothing about the button itself changes with the layers:
 * the map shows what is running, and the hour bar names the flow field when
 * one is.
 *
 * Bathymetry is independent of the flow pair. Currents and Wind are one
 * choice (see `useFlowLayer`), which the menu shows by unchecking one as the
 * other comes on. Turning everything off leaves a bare chart, which is a
 * state worth being able to reach in three taps.
 *
 * These used to live in the filter sheet under "Map". A layer is not a
 * filter: it changes what the map draws, not which spots are on it, and it
 * belongs on the map.
 */
export default function MobileLayersControl({
  flow,
  onFlowChange,
  relief,
  onToggleRelief,
  depthLocked = false,
  onUnlockDepth,
}: {
  flow: FlowKind | null;
  onFlowChange: (next: FlowKind | null) => void;
  relief: boolean;
  onToggleRelief: () => void;
  /** The depth gate applies to this viewer: the Bathymetry row becomes the
   *  way back rather than a switch. See @/lib/preview-gate. */
  depthLocked?: boolean;
  onUnlockDepth?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Tap anywhere else to close, the way a menu behaves.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const rows: {
    key: string;
    label: string;
    Icon: typeof Waves;
    on: boolean;
    onClick: () => void;
    locked?: boolean;
    testId?: string;
  }[] = [
    {
      key: "relief",
      label: "Bathymetry",
      Icon: Mountain,
      on: relief && !depthLocked,
      locked: depthLocked,
      onClick: depthLocked ? () => onUnlockDepth?.() : onToggleRelief,
      testId: depthLocked ? "depth-unlock-mobile" : undefined,
    },
    {
      key: "currents",
      label: "Currents",
      Icon: Waves,
      on: flow === "currents",
      onClick: () => onFlowChange(flow === "currents" ? null : "currents"),
    },
    {
      key: "wind",
      label: "Wind",
      Icon: Wind,
      on: flow === "wind",
      onClick: () => onFlowChange(flow === "wind" ? null : "wind"),
    },
  ];

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Map layers"
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-rc-rule bg-rc-panel/95 text-rc-ink shadow-rc-panel backdrop-blur transition-colors ${
          open ? "bg-rc-surface" : ""
        }`}
      >
        <Layers className="h-5 w-5" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Map layers"
          className="absolute bottom-full left-0 mb-2 w-48 overflow-hidden rounded-xl border border-rc-rule bg-rc-panel/95 shadow-rc-panel backdrop-blur"
        >
          {rows.map(({ key, label, Icon, on, onClick, locked, testId }) => (
            <button
              key={key}
              type="button"
              role="menuitemcheckbox"
              aria-checked={on}
              data-testid={testId}
              onClick={() => {
                onClick();
                setOpen(false);
              }}
              className={`flex h-11 w-full items-center gap-2.5 border-b border-rc-rule px-3 text-left text-[14px] font-semibold transition-colors last:border-0 active:bg-rc-surface ${
                on ? "text-rc-brand" : "text-rc-ink"
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${on ? "text-rc-brand" : "text-rc-ink-mute"}`} />
              <span className="min-w-0 flex-1 truncate">{label}</span>
              {/* Locked: a word, not a check. The row opens the offer that
                  brings depth back, and a switch that flipped itself off
                  again would read as a bug. */}
              {locked ? (
                <span className="text-xs font-medium text-rc-brand">Member</span>
              ) : (
                on && <Check className="h-4 w-4 shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

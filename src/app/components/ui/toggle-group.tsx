"use client";

import { cn } from "@/lib/utils";

export type ToggleOption = { value: string; label: string };

/**
 * A lightweight segmented control — one row of mutually-exclusive options with
 * the active one filled in brand. Used by the units settings page (one group
 * per variable). No radix dependency; the buttons are a real radiogroup.
 */
export function ToggleGroup({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: ToggleOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex rounded border border-rc-rule bg-rc-surface p-0.5"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "min-h-11 px-4 rounded-[3px] font-rc-mono text-xs uppercase tracking-wide transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-1 focus-visible:ring-offset-rc-surface",
              active
                ? "bg-rc-brand text-white"
                : "text-rc-ink-mute hover:text-rc-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

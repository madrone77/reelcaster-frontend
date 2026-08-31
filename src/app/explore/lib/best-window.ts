// Best fishing window for a day's 24 hourly scores.
//
// Extracted from hourly-bars.tsx so the SERVER can use it too: the share card
// bakes a window into a frozen snapshot, and a second implementation would let
// a card say "7 to 9 AM" while the spot page behind it said "7 AM-11 AM". It
// did, before this move.
//
// hourly-bars.tsx re-exports it, so every existing import keeps working.

import { formatHour12 } from "@/lib/time-format";

/** Longest contiguous run of hours ≥75 (fallback: ≥ max−10). */
export function bestWindow(hours: (number | null)[]): {
  window: [number, number] | null;
  label: string | null;
} {
  const max = Math.max(...hours.map((h) => h ?? 0));
  if (max <= 0) return { window: null, label: null };
  const threshold = max >= 75 ? 75 : max - 10;

  let best: [number, number] | null = null;
  let start: number | null = null;
  for (let i = 0; i <= hours.length; i++) {
    const qualifies = i < hours.length && (hours[i] ?? 0) >= threshold;
    if (qualifies && start === null) start = i;
    if (!qualifies && start !== null) {
      const run: [number, number] = [start, i - 1];
      if (!best || run[1] - run[0] > best[1] - best[0]) best = run;
      start = null;
    }
  }
  if (!best) return { window: null, label: null };
  const fmt = (h: number) => formatHour12(h);
  return { window: best, label: `${fmt(best[0])}-${fmt(best[1] + 1)}` };
}

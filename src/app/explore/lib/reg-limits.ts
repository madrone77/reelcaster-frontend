import type { LiveRegulation } from "@/lib/bluecaster/live-spot-types";
import { lengthLabel, lengthRangeLabel, type Regulator } from "@/lib/regions";

/**
 * Shared formatting for the regulation figures — the limits, the length rule,
 * and the gear clause. Both the summary strip in the score card and the full
 * Current Regulations panel read from here, so the two never disagree about
 * what a null limit or a one-sided size bound means.
 *
 * Lengths arrive as centimetres whoever set them, because that is the one unit
 * BlueCaster stores, and they go out in the unit the REGULATOR writes — WDFW's
 * tables are inches. So the size functions take the regulator the caller
 * already resolved rather than reading the raw figure out.
 */

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "2026-08-01" | "08-01" → "Aug 1". Null-safe. Year (when present) is a
 *  convention on annual MM-DD windows, so only month/day are shown. */
export function fmtMD(iso: string | null): string | null {
  if (!iso) return null;
  const m = /(?:\d{4}-)?(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const mon = MONTHS[Number(m[1]) - 1];
  if (!mon) return null;
  return `${mon} ${Number(m[2])}`;
}

/** The size/length rule spelled out — min, max, or a slot. */
export function sizeText(r: LiveRegulation, regulator: Regulator): string | null {
  const { min, max } = sizeBounds(r);
  if (min != null && max != null)
    return `${lengthRangeLabel(min, max, regulator)} slot`;
  if (min != null) return `Minimum ${lengthLabel(min, regulator)}`;
  if (max != null) return `Maximum ${lengthLabel(max, regulator)}`;
  return null;
}

/** The same rule abbreviated, for the middot-joined summary strip. */
export function sizeTextShort(
  r: LiveRegulation,
  regulator: Regulator,
): string | null {
  const { min, max } = sizeBounds(r);
  if (min != null && max != null)
    return `${lengthRangeLabel(min, max, regulator)} slot`;
  if (min != null) return `min ${lengthLabel(min, regulator)}`;
  if (max != null) return `max ${lengthLabel(max, regulator)}`;
  return null;
}

/** The published bounds, with a zero read as an absence — no fishery has a
 *  zero-length minimum, and "min 0" beside a real daily limit reads as a rule. */
function sizeBounds(r: LiveRegulation): {
  min: number | null;
  max: number | null;
} {
  return {
    min: r.sizeLimitCm != null && r.sizeLimitCm > 0 ? r.sizeLimitCm : null,
    max: r.sizeLimitMaxCm != null && r.sizeLimitMaxCm > 0 ? r.sizeLimitMaxCm : null,
  };
}

/** Gear clause with any trailing period trimmed, so it sits in a joined line
 *  without punctuation stranded mid-sentence. Null when nothing is published. */
function gearPhrase(gear: string | null): string | null {
  const trimmed = gear?.trim().replace(/\.$/, "") ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * The rules an angler needs before leaving the dock — how many they may keep,
 * what length, and how they're allowed to fish it (barbless hook and line, and
 * the like). Everything else stays in the Current Regulations panel below.
 *
 * Under a closure the size and gear rules are withheld. They describe a fishery
 * that isn't open, and "min 45 cm" sitting beside the word "closed" reads as
 * permission. The reopening date takes their place when the calendar has one.
 * Release-only drops the size rule for the same reason: nothing is being kept,
 * so a minimum length is not a rule you can act on.
 */
export function regHighlights(
  r: LiveRegulation,
  regulator: Regulator,
): string[] {
  if (r.status === "Closed") {
    const reopen = fmtMD(r.nextOpenDate);
    return ["No retention", ...(reopen ? [`reopens ${reopen}`] : [])];
  }

  const releaseOnly = r.status === "Release" || r.dailyLimit === 0;
  const quantity = releaseOnly
    ? "Catch and release"
    : r.dailyLimit != null && r.dailyLimit > 0
      ? `${r.dailyLimit} per day`
      : null;

  return [
    quantity,
    releaseOnly ? null : sizeTextShort(r, regulator),
    gearPhrase(r.gearRestrictions),
  ].filter((part): part is string => part != null);
}

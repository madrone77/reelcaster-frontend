// Client-facing shape for scraped catch reports, as served by the gated proxy
// at /api/bluecaster/map/fresh-catches.
//
// Two shapes over one field set. A LOCKED spot carries nothing but the fact
// that reports exist: whether they skew good or bad is itself the paid
// information, so `verdict` — and the colour derived from it — is stripped
// server-side alongside the counts. Free users learn a spot is tracked, not
// how it's fishing.
//
// No report text appears anywhere in this shape by design. The underlying
// `catch_signals.excerpt` is verbatim prose scraped from third-party forums;
// counts, ratios and dates are ours to publish, the words are not.

import type { FreshCatchSpecies, FreshCatchVerdict } from "@/lib/bluecaster";

export type { FreshCatchVerdict, FreshCatchSpecies };

export interface RailFreshCatch {
  locked: boolean;
  verdict?: FreshCatchVerdict;
  count?: number;
  positive?: number;
  latestDate?: string | null;
  species?: Record<string, FreshCatchSpecies>;
}

export interface FreshCatchesResponse {
  since: string;
  days: number;
  unlocked: boolean;
  spots: Record<string, RailFreshCatch>; // keyed by spot UUID
}

/** Badge/label styling, reusing the verdict palette the neighbour-spot cards
 *  already use so the same words look the same everywhere. */
export const FRESH_VERDICT: Record<
  FreshCatchVerdict,
  { label: string; cls: string }
> = {
  strong: { label: "STRONG BITE", cls: "bg-rc-good text-white" },
  mixed: { label: "MIXED", cls: "bg-rc-fair text-white" },
  slow: { label: "SLOW", cls: "bg-rc-ink-mute text-white" },
};

/** Look up a verdict's styling, tolerating anything unexpected on the wire.
 *  The value crosses a service boundary, and an unrecognised string must not be
 *  able to take the rail down — it degrades to the neutral treatment. */
export function freshVerdictStyle(v: string | undefined) {
  return FRESH_VERDICT[v as FreshCatchVerdict] ?? FRESH_VERDICT.slow;
}

/** "yesterday" / "3 weeks ago". Deliberately relative: `catch_signals` has no
 *  exactly-dated rows (date_confidence is explicit/estimated/publish_date), so
 *  printing a calendar date would claim precision the data doesn't have. */
export function reportAge(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  const then = Date.UTC(y, m - 1, d);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.max(0, Math.round((today - then) / 86_400_000));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  const weeks = Math.round(days / 7);
  return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
}

/** Does this spot have any scraped report inside the window?
 *
 *  Deliberately a boolean and nothing more — it is the one fact about catch
 *  reports a free viewer is allowed. Mirrors the map endpoint's window exactly
 *  (Pacific-day `report_date`, no future dates) so the spot page and the rail
 *  never disagree about whether a spot is tracked. Rows carrying the
 *  2026-12-31 placeholder `report_date` are excluded by the upper bound. */
export function spotHasFreshReports(
  signals: Array<{ reportDate: string | null }> | undefined,
  days: number,
): boolean {
  if (!signals?.length) return false;
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Vancouver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [y, m, d] = today.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, d, 12));
  from.setUTCDate(from.getUTCDate() - days);
  const since = from.toISOString().slice(0, 10);
  return signals.some(
    (s) => s.reportDate != null && s.reportDate >= since && s.reportDate <= today,
  );
}

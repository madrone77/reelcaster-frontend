// What a spot page is allowed to hand its client component.
//
// Shared by the prerendered page and the owner-only fallback, because both
// mount the same shell and both would otherwise serialize paid content into the
// browser. Kept in its own module so a client component can import it without
// dragging in the server page.

import type { SpotPageInitial } from "@/lib/bluecaster/live-spot-types";
import type { SpotPageForClient } from "./spot-detail-shell";

/**
 * The hook a free reader sees: which fish the report is about, and nothing
 * else.
 *
 * It used to be the first 38 characters of the report's own headline, cut at
 * a word: "Salmon and halibut both going at…". That is the fish AND the
 * verdict, which is most of what Pro sells for this spot. Now it is the
 * report's own `teaser`, which BlueCaster writes and scans for exactly that
 * (no verdict, no method, no other water), and where a report has none, a
 * line built from the species names alone. The spot is named by the page
 * itself, so naming it here gives nothing away.
 *
 * Returns null when there is no report, which is what keeps the block absent
 * rather than teasing something that does not exist.
 */
export function teaserLine(reports: unknown): string | null {
  const r = reports as { headline?: unknown; teaser?: unknown; species?: Array<{ name?: unknown }> } | null;
  if (!r || typeof r.headline !== "string" || !r.headline.trim()) return null;
  if (typeof r.teaser === "string" && r.teaser.trim()) return r.teaser.trim();
  const fish = speciesList((r.species ?? []).map((s) => s?.name));
  return fish ? `${fish} in the latest reports from this spot` : "The latest reports from this spot";
}

/** "Chinook", "Chinook and Coho". Two at most: a longer list starts to read
 *  as a ranking of what is going. */
function speciesList(names: unknown[]): string | null {
  const clean = names
    .filter((n): n is string => typeof n === "string" && !!n.trim())
    .map((n) => n.trim())
    .filter((n, i, all) => all.indexOf(n) === i)
    .slice(0, 2);
  return clean.length ? clean.join(" and ") : null;
}

/**
 * Drop the fields that must never cross into the client bundle.
 *
 * `catchSignals` carries verbatim third-party forum text and per-report detail;
 * `intelVerdict` is paid information; `recentReports` is the whole written
 * report, which is Pro. Everything handed to a client component is serialized
 * into the page for anyone to read, so the strip happens here and only the
 * teaser line survives. A paying angler refetches the rest at request time
 * from the gated route.
 */
export function stripPaidIntel(raw: SpotPageInitial): SpotPageForClient {
  const { catchSignals, intelVerdict, recentReports, creelReport, ...rest } = raw;
  void catchSignals;
  void intelVerdict;
  void creelReport;
  // The area-wide catch checks take the same gate, so they are stripped here
  // too. They no longer earn a teaser of their own: they are the marine
  // area's numbers, not reports from this spot, so a spot with nothing but
  // them has no teaser and the shell shows the city report instead (which on
  // Washington water is written from those same checks). A Pro reader on a
  // spot that does have a written report still gets the checks with it.
  const teaser = teaserLine(recentReports);
  return {
    ...rest,
    recentReportsTeaser: teaser,
    // The date of the newest report travels with the teaser. It is not paid
    // information (how fresh the news is, not what the news says) and the
    // gated block needs it to say "Updated 2 days ago" before a free reader
    // has anything else.
    recentReportsUpdatedAt: latestReportDate(recentReports),
  };
}

function latestReportDate(reports: unknown): string | null {
  const d = (reports as { latestDate?: unknown } | null)?.latestDate;
  return typeof d === "string" && d ? d : null;
}

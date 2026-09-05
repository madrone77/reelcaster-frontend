// What a spot page is allowed to hand its client component.
//
// Shared by the prerendered page and the owner-only fallback, because both
// mount the same shell and both would otherwise serialize paid content into the
// browser. Kept in its own module so a client component can import it without
// dragging in the server page.

import type { SpotPageInitial } from "@/lib/bluecaster/live-spot-types";
import type { SpotPageForClient } from "./spot-detail-shell";
import { creelHeadline } from "@/lib/bluecaster/creel-types";

/** How much of the headline a free reader sees before the cut. Enough to name
 *  the spot and start the verdict, not enough to answer "is it worth going". */
const TEASER_BUDGET = 38;

/**
 * The hook. Trims the generated headline at a word boundary and appends an
 * ellipsis, so "Salmon and halibut both going at Constance Bank, coho picking
 * up lately" reads as "Salmon and halibut both going at…".
 *
 * Returns null when there is no report, which is what keeps the block absent
 * rather than teasing something that does not exist.
 */
export function teaserHeadline(reports: unknown): string | null {
  const headline = (reports as { headline?: unknown } | null)?.headline;
  if (typeof headline !== "string" || !headline.trim()) return null;
  const clean = headline.trim();
  if (clean.length <= TEASER_BUDGET) return `${clean}…`;
  const cut = clean.slice(0, TEASER_BUDGET);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 20 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.\s]+$/, "")}…`;
}

/**
 * Drop the fields that must never cross into the client bundle.
 *
 * `catchSignals` carries verbatim third-party forum text and per-report detail;
 * `intelVerdict` is paid information; `recentReports` is the whole written
 * report, which is Pro. Everything handed to a client component is serialized
 * into the page for anyone to read, so the strip happens here and only the
 * teaser headline survives. A paying angler refetches the rest at request time
 * from the gated route.
 */
export function stripPaidIntel(raw: SpotPageInitial): SpotPageForClient {
  const { catchSignals, intelVerdict, recentReports, creelReport, ...rest } = raw;
  void catchSignals;
  void intelVerdict;
  // The area-wide catch checks are the same product as the written report:
  // what is being kept nearby, this fortnight. They take the same gate, so
  // they are stripped here too and only a teaser survives. On most Washington
  // water there is no written report at all and this teaser is the band.
  const teaser = teaserHeadline(recentReports) ?? (creelReport ? teaserHeadline({ headline: creelHeadline(creelReport) }) : null);
  return {
    ...rest,
    recentReportsTeaser: teaser,
    // The date of the newest report travels with the teaser. It is not paid
    // information (how fresh the news is, not what the news says) and the
    // gated block needs it to say "Updated 2 days ago" before a free reader
    // has anything else.
    recentReportsUpdatedAt: latestReportDate(recentReports) ?? creelReport?.latestSurveyDate ?? null,
  };
}

function latestReportDate(reports: unknown): string | null {
  const d = (reports as { latestDate?: unknown } | null)?.latestDate;
  return typeof d === "string" && d ? d : null;
}

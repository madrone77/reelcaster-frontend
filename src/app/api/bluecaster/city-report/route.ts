import { NextRequest, NextResponse } from "next/server";
import { fetchCityDailyReport, fetchHierarchy } from "@/lib/bluecaster";
import { isProViewer } from "@/lib/public-entitlement";
import { COVERED_PROVINCES } from "@/lib/regions";
import { getFishingProvinceByCode } from "@/app/fishing/lib/fishing-data";

/**
 * Same-origin proxy → BlueCaster GET /api/v1/cities/[slug]/daily-report, for
 * the report band on a public city page.
 *
 * This is a SECOND route rather than a parameter on the dashboard one, and the
 * difference is the whole point of the file.
 *
 * `/api/bluecaster/city-daily-report` deliberately refuses to take a city:
 * it resolves the caller's own home city server-side, so a Pro dashboard card
 * cannot be turned into a way to read every city's report by iterating slugs.
 * That rule is right for a card that exists to serve one reader.
 *
 * On a public city page the slug IS the URL, so the same rule would be
 * meaningless. What replaces it:
 *
 *   1. The slug is checked against the published hierarchy before it reaches
 *      BlueCaster, so this cannot be used to enumerate unpublished cities.
 *   2. The GATE MOVES FROM THE CITY TO THE BODY. Everyone gets the headline,
 *      because that is the line the page is indexed on and the hook that sells
 *      the rest. Only a Pro reader gets `reports_md`, `outlook_md` and `tips`.
 *
 * So a free caller here gets strictly less than a Pro caller on the same city,
 * and the dashboard route's stronger rule is untouched.
 */

/** Is this a city we actually publish a page for? */
async function isPublishedCity(slug: string): Promise<boolean> {
  try {
    const hierarchy = await fetchHierarchy();
    return COVERED_PROVINCES.some((code) =>
      (getFishingProvinceByCode(hierarchy, code)?.cities ?? []).some(
        (c) => c.slug === slug,
      ),
    );
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("city");
  if (!slug || !/^[a-z0-9-]{2,64}$/.test(slug)) {
    return NextResponse.json({ error: "city is required" }, { status: 400 });
  }

  if (!(await isPublishedCity(slug))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data = await fetchCityDailyReport(slug);
  if (!data) {
    return NextResponse.json({ error: "upstream unavailable" }, { status: 502 });
  }

  if (data.status !== "ready" || !data.report) {
    return NextResponse.json(
      { locked: false, status: data.status, report: null },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const report = data.report;

  // Hide the section entirely when nothing fed it.
  //
  // Gating on "is there a row" is not enough: a city whose forum chatter dries
  // up keeps its last briefing, and a month-old report presented as today's is
  // worse than no section at all. Prince Rupert has no signals right now.
  //
  // Both counts, not one. A Washington city has WDFW dockside creel checks in
  // the window and no forum posts at all (Tacoma: 0 posts, hundreds of anglers
  // checked), and its briefing is written from the checks. Gating on posts
  // alone hid every WA report while Victoria sailed through.
  if ((report.reports_signal_count ?? 0) === 0 && (report.creel_survey_count ?? 0) === 0) {
    return NextResponse.json(
      { locked: false, status: "no_signals", report: null },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const isPro = await isProViewer(request);

  if (!isPro) {
    // Headline only. The body is not sent at all rather than sent and hidden,
    // so a locked band has nothing to reveal in the network tab.
    return NextResponse.json(
      {
        locked: true,
        status: "ready",
        report: {
          headline: report.headline,
          report_date: report.report_date,
          generated_at: report.generated_at,
        },
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  return NextResponse.json(
    { locked: false, status: "ready", report },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

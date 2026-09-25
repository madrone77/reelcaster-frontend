/**
 * GET /api/lp/quiz-spot?spot=<slug>&species=<id>&region=<WA|BC>
 *
 * The live screen on the quiz result page: one real day at the spot the
 * quiz picked, scored for the reader's fish, plus the rules in force there.
 *
 * Fetched from the browser after the result renders rather than baked into
 * the page. The quiz builds every possible result on the server (up to ten
 * species, two spots each), and a day of hourly conditions for each of those
 * spots would put a hundred kilobytes of JSON in front of the first tap for
 * a screen only one of them will ever show. So the page carries the picks
 * and the browser asks for the one day it needs, once the reader can see
 * where it is going.
 *
 * Day 0 only, which is what an anonymous reader is entitled to. Nothing
 * here is behind the app's own gate: it is the same payload the public spot
 * page renders for a signed-out visitor.
 *
 * Cached at the edge for five minutes. The score changes on the hour, and a
 * result page is read for about a minute.
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchSpotLivePage } from "@/lib/bluecaster";
import { tideRangeFrom } from "@/app/explore/lib/terminal-hours";
import { timezoneFor } from "@/lib/regions";
import type { LiveRegulation } from "@/lib/bluecaster/live-spot-types";
import type { ConditionsFeed } from "@/app/lp/_city1/load-conditions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SLUG_SHAPE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ID_SHAPE = /^[a-z0-9-]{1,80}$/i;
const REGION_SHAPE = /^[A-Z]{2}$/;

/** Seconds in the Data Cache for the spot payload. */
const REVALIDATE = 300;

export interface QuizSpotRegs {
  rows: LiveRegulation[];
  areaCode: string | null;
  agency: string | null;
  syncedAt: string | null;
}

export interface QuizSpotLive {
  feed: ConditionsFeed;
  regs: QuizSpotRegs;
}

const scored = (day: (number | null)[] | undefined) =>
  !!day?.some((v) => typeof v === "number" && Number.isFinite(v));

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const slug = (q.get("spot") ?? "").trim().toLowerCase();
  const speciesId = (q.get("species") ?? "").trim();
  const region = (q.get("region") ?? "").trim().toUpperCase();
  if (!SLUG_SHAPE.test(slug) || !ID_SHAPE.test(speciesId) || !REGION_SHAPE.test(region)) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  }

  const page = await fetchSpotLivePage(slug, undefined, REVALIDATE).catch(() => null);
  if (!page) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // The reader's fish when it is scored here today, otherwise whatever is:
  // a screen with a chart and no numbers is worse than a screen about the
  // spot's other fish, and the caption reads the species back off the feed.
  const wanted = scored(page.hourlyScoreGrid[speciesId]?.[0]) ? speciesId : null;
  const usedId =
    wanted ?? Object.keys(page.hourlyScoreGrid).find((id) => scored(page.hourlyScoreGrid[id]?.[0])) ?? null;
  const scores = usedId ? page.hourlyScoreGrid[usedId]?.[0] : undefined;
  const conditions = page.hourlyConditionsGrid?.[0];
  if (!scores?.length || !conditions?.length) {
    return NextResponse.json({ error: "no_day" }, { status: 404 });
  }

  const feed: ConditionsFeed = {
    spotName: page.spot.name,
    speciesName: page.species.find((s) => s.id === usedId)?.name ?? null,
    lat: page.spot.lat,
    lng: page.spot.lng,
    tz: timezoneFor(region),
    iso: page.daily14?.[0]?.iso ?? null,
    scores,
    conditions,
    tideRange: tideRangeFrom(page.hourlyConditionsGrid),
    sun: page.sun,
    rightNow: page.rightNow,
  };

  // The reader's fish first, then the rest, so the panel opens on the row
  // they came for.
  const rows = [...(page.regulations ?? [])].sort((a, b) =>
    a.speciesId === speciesId ? -1 : b.speciesId === speciesId ? 1 : 0,
  );
  const body: QuizSpotLive = {
    feed,
    regs: {
      rows,
      areaCode: page.regAreaCode ?? null,
      agency: page.regAgency ?? null,
      syncedAt: page.regSyncedAt ?? null,
    },
  };

  return NextResponse.json(body, {
    headers: { "Cache-Control": `public, s-maxage=${REVALIDATE}, stale-while-revalidate=${REVALIDATE}` },
  });
}

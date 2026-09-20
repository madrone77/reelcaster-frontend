/**
 * Midnight Pacific: throw away every cached city page so the first reader of
 * the new day gets the new day.
 *
 * The city page and the /lp/7 ad frame are ISR with `revalidate = 900`, which
 * means stale-while-revalidate: a request after the window serves the OLD
 * HTML and regenerates in the background. For a page that changes every 15
 * minutes that is the right trade. For the day boundary it is not. At 4 AM
 * on 2026-09-20 the Victoria and Neah Bay pages, which nobody had opened
 * since before midnight, drew Sat Sep 19 as the only open tile in the 14-day
 * strip with Sep 20 padlocked "Unlock with Pro", said "8 days out" for a day
 * that was 7 out, and led with yesterday's best window. A second load was
 * right. Every low-traffic city does this to its first visitor of the day,
 * and on the ad frame that visitor is a paid click.
 *
 * `revalidatePath` on the dynamic segment purges all of a route's pages in one
 * call, so the next request of each renders fresh (blocking, one time) rather
 * than serving stale. Nothing is rendered here; a city nobody opens costs
 * nothing.
 *
 * Runs at 07:10 and 08:10 UTC: 00:10 Pacific under daylight time and under
 * standard time respectively. The off-season firing is 1:10 AM and harmless.
 * Ten past, not on the hour, so the per-fetch Data Cache entries the page
 * reads (spot page 60 s, city today 300 s) have expired by the time the
 * fresh render asks for them.
 */

import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Every route that draws the day strip through `loadCity`. */
const CITY_ROUTES = ['/fishing/[country]/[state]/[city]', '/lp/7/[city]'] as const;

export async function GET(request: Request) {
  // Vercel signs its cron calls with CRON_SECRET as a bearer token. Closed
  // rather than open when the secret is unset: an open purge is a cheap way
  // to make every city page render cold on demand.
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  for (const route of CITY_ROUTES) revalidatePath(route, 'page');

  console.log(`[revalidate-city-pages] purged ${CITY_ROUTES.join(', ')}`);
  return NextResponse.json({ ok: true, routes: CITY_ROUTES, at: new Date().toISOString() });
}

// Vercel Cron fires GET; POST is for a hand trigger from a shell.
export const POST = GET;

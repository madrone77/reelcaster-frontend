/**
 * Ten minutes after the midnight purge: render every city page once, so no
 * reader has to.
 *
 * revalidate-city-pages throws the cached city pages away at 00:10 Pacific,
 * and a purged page does not serve stale: the next request renders it while
 * the reader waits. Measured on prod the morning of 2026-09-23, that first
 * request took 2.4 to 7.2 s (Everett 7.2 s, Nanaimo 3.7 s, Victoria 4.4 s)
 * against 0.1 to 0.3 s for a cached one. Every low-traffic city handed that to
 * its first visitor of the day, and on an ad that visitor is a paid click.
 *
 * So this is the first visitor instead. Cities, then their /lp/7 frames, four
 * at a time: about 130 renders, each one reading the same BlueCaster payloads
 * the page already caches, which is the load the build's prerender puts on it
 * anyway, spread over a minute.
 *
 * The request carries a `monitor` user agent, which isBotUserAgent drops, so
 * none of this reaches the page-view counts.
 *
 * Spot pages are not purged at midnight and are not warmed here. A deploy
 * empties them; the purge-data-cache workflow warms them after one.
 */

import { NextResponse } from 'next/server';
import { fetchHierarchy } from '@/lib/bluecaster';
import { COVERED_PROVINCES } from '@/lib/regions';
import { getFishingProvinceByCode } from '@/app/fishing/lib/fishing-data';
import { SITE_URL } from '@/lib/site';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const CONCURRENCY = 4;
const PER_PAGE_TIMEOUT_MS = 60_000;

async function warm(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { 'user-agent': 'ReelCaster-Warm/1.0 (monitor)' },
      signal: AbortSignal.timeout(PER_PAGE_TIMEOUT_MS),
    });
    // Drain the body: a streamed render is only cached once it has finished.
    await res.arrayBuffer();
    return `${res.status} ${res.headers.get('x-vercel-cache') ?? '-'}`;
  } catch (err) {
    return `error ${(err as Error).name}`;
  }
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const hierarchy = await fetchHierarchy();
  const cities = COVERED_PROVINCES.flatMap(
    (code) => getFishingProvinceByCode(hierarchy, code)?.cities ?? [],
  );
  const urls = [
    ...cities.map((c) => `${SITE_URL}${c.path}`),
    ...cities.map((c) => `${SITE_URL}/lp/7/${c.slug}`),
  ];

  const started = Date.now();
  const tally: Record<string, number> = {};
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < urls.length) {
        const outcome = await warm(urls[next++]);
        tally[outcome] = (tally[outcome] ?? 0) + 1;
      }
    }),
  );

  const ms = Date.now() - started;
  console.log(`[warm-city-pages] ${urls.length} pages in ${ms}ms`, tally);
  return NextResponse.json({ ok: true, pages: urls.length, ms, tally });
}

// Vercel Cron fires GET; POST is for a hand trigger from a shell.
export const POST = GET;

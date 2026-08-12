/**
 * GET /api/search?q=<query>&near=<lat,lng>&limit=<n>
 *
 * Same-origin proxy to BlueCaster's `/api/v1/search`, so the API key stays
 * server-side. Returns the BlueCaster shape unchanged.
 *
 * Auth is optional. With a valid session the results also carry that angler's
 * OWN custom spots (`owned: true`), ranked with the published set. That
 * response is per-user and must not be shared: it goes out `no-store`, while
 * the anonymous one stays cacheable.
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchBlueCaster } from '@/lib/bluecaster';
import { getUserIdFromRequest } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const EMPTY = (q: string) => ({
  query: q,
  results: [],
  meta: { count: 0, truncated: false, near: null, viewer: false },
});

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const q = sp.get('q')?.trim() ?? '';

  let near: { lat: number; lng: number } | undefined;
  const nearRaw = sp.get('near');
  if (nearRaw) {
    const [lat, lng] = nearRaw.split(',').map(Number);
    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    ) {
      near = { lat, lng };
    }
    // A malformed `near` is dropped rather than rejected — it only affects tie
    // ordering, and failing the whole search over it would be worse than
    // returning unbiased results.
  }

  const limitRaw = Number(sp.get('limit'));
  const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? limitRaw : undefined;

  const viewerId = await getUserIdFromRequest(request);

  // Short queries never reach BlueCaster. The client debounces, but the first
  // one or two characters of any word would still round-trip for nothing.
  if (q.length < 2) {
    return NextResponse.json(EMPTY(q), {
      headers: { 'Cache-Control': viewerId ? 'private, no-store' : 'public, max-age=300' },
    });
  }

  const data = await searchBlueCaster(q, {
    near,
    limit,
    viewerId: viewerId ?? undefined,
  });

  // A search that can't reach the API degrades to "no matches" rather than an
  // error banner — the user is mid-keystroke and a transient blip shouldn't
  // replace the dropdown with a failure state.
  return NextResponse.json(data ?? EMPTY(q), {
    headers: {
      'Cache-Control': viewerId
        ? 'private, no-store'
        : 'public, max-age=300, stale-while-revalidate=3600',
    },
  });
}

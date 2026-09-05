import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchSpotLivePage } from "@/lib/bluecaster";
import { getUserIdFromRequest } from "@/lib/server-auth";
import { resolveEntitlement } from "@/lib/entitlement";

/**
 * The Pro gate for the written report on a spot page.
 *
 * The spot page is prerendered for search, so its static HTML can only carry
 * what is safe for everyone: the teaser headline and nothing else. A paying
 * angler fetches the rest here, at request time, after their entitlement has
 * been checked server-side.
 *
 * Gated at the route rather than in the component, for the same reason as
 * `map/fresh-catches`: the client's `useSubscription().isPaid` does not
 * implement the grace window, so a user in grace reads as free on the client.
 * `resolveEntitlement` is the load-bearing check.
 *
 * A free caller gets `{ locked: true }` and no prose. Hiding the block in the
 * component would have been theatre — the summary would still be sitting in the
 * page payload, readable from the network tab.
 */

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const userId = await getUserIdFromRequest(request);
  const isPro = userId ? (await resolveEntitlement(supabaseAdmin, userId)).isPro : false;

  // Per-viewer response. It must never be shared between a Pro and a free
  // reader, so it is explicitly uncacheable rather than relying on defaults.
  const headers = { "Cache-Control": "no-store, max-age=0" };

  if (!isPro) {
    return NextResponse.json({ locked: true }, { headers });
  }

  try {
    const page = await fetchSpotLivePage(slug);
    // The area-wide catch checks ride with the report: same product, same
    // gate. On most Washington water they are the whole band.
    return NextResponse.json(
      { locked: false, reports: page?.recentReports ?? null, creel: page?.creelReport ?? null },
      { headers },
    );
  } catch {
    return NextResponse.json({ locked: false, reports: null, creel: null }, { headers });
  }
}

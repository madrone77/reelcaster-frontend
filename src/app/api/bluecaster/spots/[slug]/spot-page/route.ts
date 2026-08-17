import { NextRequest, NextResponse } from "next/server";
import { fetchSpotLivePageWithCacheControl } from "@/lib/bluecaster";
import { getUserIdFromRequest } from "@/lib/server-auth";

/**
 * GET /api/bluecaster/spots/[slug]/spot-page
 *
 * Same-origin proxy to BlueCaster's `/api/v1/spots/[slug]/spot-page` (the
 * today-only live payload). Lets the Explore spot drawer lazy-fetch the rich
 * intel (catch signals, score drivers, regulations, season, water temp)
 * client-side without exposing the BlueCaster API key.
 *
 * Auth is OPTIONAL and only ever widens what you can see. Anonymous callers
 * get curated + public spots; BlueCaster 404s private custom spots to them.
 * A caller who sends a valid Supabase access token additionally gets their
 * OWN private spots — we verify the token here and vouch for that user id
 * downstream. The id is never taken from client-supplied headers, so this
 * cannot be used to read someone else's private spot.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  // Optional: absent/!invalid token simply means "anonymous", not an error.
  const userId = await getUserIdFromRequest(request);
  try {
    const { data, cacheControl } = await fetchSpotLivePageWithCacheControl(
      slug,
      userId ?? undefined,
    );
    if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });

    // Take BlueCaster's VERDICT on whether this spot is shareable, then set our
    // own header, rather than hardcoding `no-store` or mirroring verbatim.
    //
    // This payload costs ~2 s upstream (roughly 39 mostly-serial reads) and the
    // dashboard fetches it for the home spot on every load. It does not vary by
    // caller: the upstream builder takes a spot id and nothing else. So for a
    // spot everyone may see it is safe to share, and hardcoding `no-store` here
    // meant every signed-in angler rebuilt an identical body from scratch.
    //
    // Only BlueCaster can decide shareable, because only it holds the
    // visibility row, and it answers `private, no-store` for a PRIVATE custom
    // spot. Edge caches key on the URL and ignore identity, so a wrong call
    // here publishes someone's private mark to whoever asks next.
    //
    // Mirroring the header verbatim does NOT work: Vercel consumes `s-maxage`
    // and `stale-while-revalidate` at its edge and strips them before the
    // response reaches us, so what arrives for a public spot is a bare
    // `public, max-age=0`. Copying that would cache nothing and quietly leave
    // the 2 s in place. What survives the trip is the part we actually need,
    // `public` versus `private, no-store`.
    //
    // Fails closed: anything that is not unambiguously public, including a
    // missing header, stays `no-store`.
    const cc = (cacheControl ?? "").toLowerCase();
    const shareable = cc.includes("public") && !cc.includes("no-store");
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": shareable
          ? "public, max-age=0, s-maxage=300, stale-while-revalidate=60"
          : "private, no-store, max-age=0",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

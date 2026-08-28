import { NextRequest, NextResponse } from "next/server";
import { getScorableSpecies } from "@/lib/bluecaster";

/**
 * GET /api/bluecaster/species/scorable?lat=&lng=
 *
 * Same-origin proxy for the create-spot species picker. Reads only, and the
 * answer is the same for everyone standing on the same water, so it needs no
 * session: it is a city's species list, not anyone's private data. The Pro
 * gate stays where it belongs, on the create itself.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json(
      { error: "lat and lng are required" },
      { status: 400 },
    );
  }

  try {
    const result = await getScorableSpecies(lat, lng);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, message: result.message },
        { status: result.status },
      );
    }
    return NextResponse.json(result.data, {
      // The list moves with the seasons and with each fleet run. Short cache:
      // enough to survive a pin being nudged around, not enough to show an
      // angler a species that closed this morning.
      headers: { "Cache-Control": "private, max-age=300" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

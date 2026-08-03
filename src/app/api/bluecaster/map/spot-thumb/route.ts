import { NextRequest, NextResponse } from "next/server";
import { fetchSpotThumb } from "@/lib/bluecaster";

/**
 * GET /api/bluecaster/map/spot-thumb
 *
 * Same-origin proxy to BlueCaster's `/api/v1/map/spot-thumb`. Returns a
 * satellite still of the spot as an image, so an `<img>` can sit in client
 * markup while BLUECASTER_API_KEY (and the Google key behind it) stay
 * server-side.
 *
 * Query params: spot=<uuid>, z=<8..16>, size=card|panel
 *
 * Coordinates don't move, so the render is immutable — cached hard at the edge.
 */
export async function GET(request: NextRequest) {
  const spot = request.nextUrl.searchParams.get("spot") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(spot)) {
    return NextResponse.json({ error: "spot required" }, { status: 400 });
  }

  const z = Number(request.nextUrl.searchParams.get("z"));
  const size = request.nextUrl.searchParams.get("size") === "panel" ? "panel" : "card";

  const image = await fetchSpotThumb(spot, {
    zoom: Number.isFinite(z) && z > 0 ? z : undefined,
    size,
  });

  // 404, not 502: "no imagery for this spot" is a legitimate answer (private
  // custom spot, no coordinates, imagery unavailable) and the <img> simply
  // doesn't paint, leaving the card's own backdrop.
  if (!image) {
    return NextResponse.json({ error: "unavailable" }, { status: 404 });
  }

  return new NextResponse(image.body, {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control":
        "public, max-age=86400, s-maxage=31536000, stale-while-revalidate=86400",
    },
  });
}

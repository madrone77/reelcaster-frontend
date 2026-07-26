import { NextRequest, NextResponse } from "next/server";
import { fetchMyCustomSpots } from "@/lib/bluecaster";
import { getUserIdFromRequest } from "@/lib/server-auth";

/**
 * GET /api/bluecaster/anglers/[id]/spots
 *
 * Authenticated same-origin proxy to BlueCaster's owner-scoped custom-spot
 * list. Returns the caller's own custom spots (private + public) — the "your
 * spots" pins on the map / dashboard. A user may only read their OWN spots:
 * the verified session must match the [id] in the path.
 */
export async function POST() {
  return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (id !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const accessToken =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";

  try {
    const spots = await fetchMyCustomSpots(userId, accessToken);
    return NextResponse.json(
      { spots },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

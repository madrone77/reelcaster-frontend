import { NextRequest, NextResponse } from "next/server";
import { fetchSpotSnapshot } from "@/lib/bluecaster";
import { getUserIdFromRequest } from "@/lib/server-auth";

export const maxDuration = 30;

/**
 * GET /api/bluecaster/fishing-spots/[id]/snapshot?datetime=<utc-iso>
 *
 * Same-origin proxy to BlueCaster's historical-capable conditions snapshot.
 * The review screen calls this when the user changes the spot or the catch
 * time (the initial snapshot arrives inside the preview response).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const datetime = request.nextUrl.searchParams.get("datetime");
  if (!datetime || isNaN(Date.parse(datetime))) {
    return NextResponse.json(
      { error: "valid datetime query parameter is required" },
      { status: 400 },
    );
  }
  try {
    // Logging a catch AT a private custom spot needs the owner forwarded, or
    // BlueCaster's visibility gate 404s the snapshot.
    const viewerId = await getUserIdFromRequest(request);
    const data = await fetchSpotSnapshot(id, datetime, viewerId ?? undefined);
    if (!data) return NextResponse.json({ error: "snapshot_failed" }, { status: 502 });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

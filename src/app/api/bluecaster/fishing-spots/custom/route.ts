import { NextRequest, NextResponse } from "next/server";
import { createCustomSpot } from "@/lib/bluecaster";
import { getUserIdFromRequest } from "@/lib/server-auth";

export const maxDuration = 60;

/**
 * POST /api/bluecaster/fishing-spots/custom
 *
 * Authenticated same-origin proxy to BlueCaster's custom-spot creation.
 * Requires a Supabase session (Bearer token) — this MUTATES shared
 * BlueCaster data (creates a global spot), so anonymous calls are refused.
 * Body: { name, lat, lng }.
 */
export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  if (!name || name.length > 80 || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json(
      { error: "name (≤80 chars), lat, and lng are required" },
      { status: 400 },
    );
  }

  try {
    const data = await createCustomSpot({ name, lat, lng });
    if (!data) return NextResponse.json({ error: "create_failed" }, { status: 502 });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

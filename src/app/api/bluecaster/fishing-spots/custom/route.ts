import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createCustomSpot } from "@/lib/bluecaster";
import { getUserIdFromRequest } from "@/lib/server-auth";

export const maxDuration = 60;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

/**
 * POST /api/bluecaster/fishing-spots/custom
 *
 * Authenticated same-origin proxy to BlueCaster's custom-spot creation.
 * Requires a Supabase session (Bearer token) — this MUTATES shared
 * BlueCaster data (creates a global spot), so anonymous calls are refused.
 * Custom spots are a Pro feature: free accounts get 403 `pro_required`.
 * BlueCaster additionally fences coordinates to covered waters and
 * answers 422 `outside_coverage`, which is passed through.
 * Body: { name, lat, lng, visibility?, species_ids? }. The owner (user_id)
 * comes from the verified session, never the body.
 */
export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Forward the caller's own token to BlueCaster so its user-scope binding can
  // verify ownership. getUserIdFromRequest already validated it above.
  const accessToken =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? undefined;

  const { data: settings } = await supabaseAdmin
    .from("user_settings")
    .select("subscription_tier, subscription_status")
    .eq("user_id", userId)
    .maybeSingle();
  const tier: string = settings?.subscription_tier ?? "free";
  const status: string = settings?.subscription_status ?? "none";
  const isPaid =
    tier.startsWith("pro") && (status === "active" || status === "trialing");
  if (!isPaid) {
    return NextResponse.json(
      {
        error: "pro_required",
        message: "Custom spots are a Pro feature. Upgrade to add your own.",
      },
      { status: 403 },
    );
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
  const visibility: "private" | "public" =
    body?.visibility === "public" ? "public" : "private";
  const species_ids: string[] = Array.isArray(body?.species_ids)
    ? body.species_ids.filter((s: unknown): s is string => typeof s === "string")
    : [];

  try {
    const result = await createCustomSpot(
      { name, lat, lng, user_id: userId, visibility, species_ids },
      accessToken,
    );
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, message: result.message },
        { status: result.status },
      );
    }
    return NextResponse.json(result.data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

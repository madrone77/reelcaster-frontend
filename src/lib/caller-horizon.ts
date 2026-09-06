import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserIdFromRequest } from "@/lib/server-auth";
import { resolveEntitlement } from "@/lib/entitlement";
import { visibleForecastDays } from "@/lib/forecast-horizon";

/**
 * How many forecast days the caller behind a request may see: anon 2, free
 * account 7, Pro 14.
 *
 * Three proxies answer this for the same Bearer token — the viewport strip,
 * the per-spot strip and the map's per-day spots — and two of them had their
 * own copy of it. One copy, so the horizon cannot be one number on the strip
 * and another on the pins under it.
 */

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export async function callerVisibleDays(request: NextRequest): Promise<number> {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return visibleForecastDays(false, false);

  const { isPro } = await resolveEntitlement(supabaseAdmin, userId);
  return visibleForecastDays(true, isPro);
}

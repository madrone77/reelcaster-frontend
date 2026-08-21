import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { getUserIdFromRequest } from "@/lib/server-auth";
import { resolveEntitlement } from "@/lib/entitlement";

/**
 * Is the caller Pro, on a route that must answer whether or not it can find out?
 *
 * The routes behind signed-in surfaces build their admin client at module
 * scope, which throws on import if Supabase is unconfigured and takes the
 * whole endpoint down with it. On a dashboard card that is survivable: the
 * reader is signed in by definition, so a broken Supabase means nothing works
 * anyway.
 *
 * On a PUBLIC city page it is not. Most readers are signed out and need no
 * Supabase at all, and the free half of the page has no business 500ing
 * because an auth dependency is unavailable. So the client is built lazily,
 * only when there is actually a session to resolve, and any failure resolves
 * to "not Pro" rather than to an error.
 *
 * Failing closed on entitlement and open on the page is the right way round:
 * the worst case is a paying reader briefly seeing the upsell, not every
 * anonymous reader seeing a broken section.
 */
let cached: SupabaseClient | null = null;

function adminClient(): SupabaseClient | null {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  cached = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}

export async function isProViewer(request: NextRequest): Promise<boolean> {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) return false;
    const supabase = adminClient();
    if (!supabase) return false;
    const { isPro } = await resolveEntitlement(supabase, userId);
    return isPro;
  } catch {
    return false;
  }
}

/** Whether the caller is signed in at all, for the forecast horizon. */
export async function isSignedIn(request: NextRequest): Promise<boolean> {
  try {
    return !!(await getUserIdFromRequest(request));
  } catch {
    return false;
  }
}

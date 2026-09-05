/**
 * GET /api/home-city/effective
 *
 * The city this angler's dashboard is about, whether or not they ever chose
 * one. Same three tiers, same order, same code as the report routes read, so
 * the page and the report it leads with can never name two different cities.
 *
 * The client cannot do this itself. Two of the three tiers need the place
 * hierarchy, which is 58 KB nobody should ship to a phone to answer one
 * question, and the third needs edge headers that only reach the server.
 *
 * `source` is the load-bearing half of the response. A city nobody chose still
 * has to say so on screen, or an angler in Everett wonders why their dashboard
 * is about Seattle and has nowhere to go with the question.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getUserIdFromRequest } from "@/lib/server-auth";
import {
  readHomeCityPrefs,
  resolveEffectiveHomeCity,
  type EffectiveHomeCity,
} from "@/lib/home-city-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Built on first use, not at module load.
 *
 * A signed-out caller needs no identity, and the IP tier alone is a complete
 * answer for them. Constructing the admin client up top would make this route
 * depend on the service-role key to answer a question that never touches it,
 * which is also what stops it working in `next dev`, where the local env holds
 * the BlueCaster keys and no Supabase ones.
 */
let admin: SupabaseClient | null = null;

function adminClient(): SupabaseClient {
  admin ??= createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  return admin;
}

export interface EffectiveHomeCityResponse {
  city: EffectiveHomeCity | null;
}

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);

  // Signed out is not an error here. There are no preferences to read, so the
  // answer is whatever the IP tier says, which is what a signed-out surface
  // wants anyway.
  const prefs = userId
    ? readHomeCityPrefs(
        (await adminClient().auth.admin.getUserById(userId)).data?.user?.user_metadata,
      )
    : {};

  const city = await resolveEffectiveHomeCity(request, prefs);

  const body: EffectiveHomeCityResponse = { city };
  return NextResponse.json(body, {
    // Keyed on an identity and an IP fix. Never shared-cached.
    headers: { "Cache-Control": "private, no-store" },
  });
}

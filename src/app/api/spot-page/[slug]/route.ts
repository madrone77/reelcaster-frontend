import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchSpotPage, type BlueCasterSpotPage } from "@/lib/bluecaster";
import { resolveEntitlement } from "@/lib/entitlement";
import {
  horizonEndUtcMs,
  PRO_FORECAST_DAYS,
  visibleForecastDays,
} from "@/lib/forecast-horizon";

export const dynamic = "force-dynamic";


const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface ResolvedTier {
  authed: boolean;
  isPaid: boolean;
  horizonDays: number;
}

async function resolveTier(request: Request): Promise<ResolvedTier> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { authed: false, isPaid: false, horizonDays: visibleForecastDays(false, false) };
  }
  const token = authHeader.substring(7);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) return { authed: false, isPaid: false, horizonDays: visibleForecastDays(false, false) };

  const { isPro: isPaid } = await resolveEntitlement(supabaseAdmin, user.id);

  return {
    authed: true,
    isPaid,
    // Same horizon as every other forecast route: signed out today, member
    // 7 days, Pro 14. This used to give signed out 0 and a member 1.
    horizonDays: visibleForecastDays(true, isPaid),
  };
}

function clipForecastByDays(
  forecast: BlueCasterSpotPage["forecast"],
  days: number,
): BlueCasterSpotPage["forecast"] {
  if (days <= 0) return { ...forecast, rows: [], horizon_hours: 0 };
  // Pacific midnight at the end of the last visible day, like the strips.
  // Compared as instants: the rows' "+00:00" and toISOString's "Z" do not
  // sort together as strings.
  const cutoff = horizonEndUtcMs(days);
  return {
    ...forecast,
    rows: forecast.rows.filter((r) => Date.parse(r.hour_utc) < cutoff),
    horizon_hours: Math.min(forecast.horizon_hours, days * 24),
  };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!slug) {
    return NextResponse.json({ error: "missing slug" }, { status: 400 });
  }

  try {
    const data = await fetchSpotPage(slug);
    if (!data || data.page.status !== "published") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const tier = await resolveTier(req);
    const clippedForecast = clipForecastByDays(data.forecast, tier.horizonDays);

    return NextResponse.json({
      ...data,
      forecast: clippedForecast,
      tier_meta: {
        authed: tier.authed,
        is_paid: tier.isPaid,
        available_horizon_days: tier.horizonDays,
        max_horizon_days: PRO_FORECAST_DAYS,
      },
    });
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
  }
}

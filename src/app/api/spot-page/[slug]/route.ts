import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchSpotPage, type BlueCasterSpotPage } from "@/lib/bluecaster";
import { resolveEntitlement } from "@/lib/entitlement";

export const dynamic = "force-dynamic";

const FREE_HORIZON_DAYS = 1;
const PRO_HORIZON_DAYS = 14;

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
    return { authed: false, isPaid: false, horizonDays: 0 };
  }
  const token = authHeader.substring(7);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) return { authed: false, isPaid: false, horizonDays: 0 };

  const { isPro: isPaid } = await resolveEntitlement(supabaseAdmin, user.id);

  return {
    authed: true,
    isPaid,
    horizonDays: isPaid ? PRO_HORIZON_DAYS : FREE_HORIZON_DAYS,
  };
}

function clipForecastByDays(
  forecast: BlueCasterSpotPage["forecast"],
  days: number,
): BlueCasterSpotPage["forecast"] {
  if (days <= 0) return { ...forecast, rows: [], horizon_hours: 0 };
  const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  return {
    ...forecast,
    rows: forecast.rows.filter((r) => r.hour_utc <= cutoff),
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
        max_horizon_days: PRO_HORIZON_DAYS,
      },
    });
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
  }
}

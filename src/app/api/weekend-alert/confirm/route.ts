/**
 * GET /api/weekend-alert/confirm?token=...
 *
 * The link in the confirmation email. Stamps `confirmed_at` and redirects to
 * a page that says so — a bare JSON 200 in a browser address bar reads as an
 * error to the person who just clicked it.
 *
 * Idempotent: a link clicked twice, or prefetched by a mail client scanner
 * and then clicked, confirms once and redirects the same way both times.
 */

import { NextRequest, NextResponse } from "next/server";
import { alertAdmin, WEEKEND_ALERT_TABLE } from "@/lib/weekend-alert";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const done = new URL("/weekend-alert/confirmed", request.nextUrl.origin);

  if (!token) {
    done.searchParams.set("status", "invalid");
    return NextResponse.redirect(done);
  }

  const admin = alertAdmin();
  const { data } = await admin
    .from(WEEKEND_ALERT_TABLE)
    .select("id, city_slug, confirmed_at")
    .eq("confirm_token", token)
    .maybeSingle();

  if (!data) {
    done.searchParams.set("status", "invalid");
    return NextResponse.redirect(done);
  }

  if (!data.confirmed_at) {
    await admin
      .from(WEEKEND_ALERT_TABLE)
      .update({
        confirmed_at: new Date().toISOString(),
        unsubscribed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
  }

  done.searchParams.set("status", "confirmed");
  done.searchParams.set("city", data.city_slug);
  return NextResponse.redirect(done);
}

/**
 * GET /api/weekend-alert/unsubscribe?token=...
 *
 * One click, no confirmation step and no sign-in. Anything that stands
 * between somebody and the exit is a complaint waiting to be filed with the
 * mailbox provider rather than with us.
 *
 * The row is kept and stamped rather than deleted, so a later signup from the
 * same address does not silently resurrect an old opt-in it never gave.
 */

import { NextRequest, NextResponse } from "next/server";
import { alertAdmin, WEEKEND_ALERT_TABLE } from "@/lib/weekend-alert";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const done = new URL("/weekend-alert/unsubscribed", request.nextUrl.origin);

  if (token) {
    const admin = alertAdmin();
    await admin
      .from(WEEKEND_ALERT_TABLE)
      .update({
        unsubscribed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("unsubscribe_token", token);
  }

  return NextResponse.redirect(done);
}

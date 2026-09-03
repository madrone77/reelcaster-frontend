import { NextRequest, NextResponse } from "next/server";
import { submitSpotIssueReport } from "@/lib/bluecaster";

/**
 * POST /api/bluecaster/spots/[slug]/issue-report
 *
 * Same-origin proxy for the "Something look wrong?" dialog on spot pages and
 * spot cards. Keeps the BlueCaster API key on the server, same as its GET
 * siblings.
 *
 * DELIBERATELY OPEN. No session is required and none is asked for. The people
 * best placed to tell us a pin is on the wrong side of the point are the ones
 * who arrived from a search result ten minutes ago and have no account, and a
 * sign-in wall in front of a favour is a wall nobody climbs.
 *
 * Auth is OPTIONAL and only ever adds information: a valid token is forwarded
 * so BlueCaster can stamp the row with who filed it. It is never required and
 * never changes what the caller may do.
 *
 * The client IP goes with the request because BlueCaster does the throttling
 * and this proxy is the last hop that can still see it. It is hashed on
 * arrival and never stored.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const body = (await request.json().catch(() => null)) as {
    reason?: unknown;
    note?: unknown;
    surface?: unknown;
    contactEmail?: unknown;
    context?: unknown;
    website?: unknown;
    verdictId?: unknown;
  } | null;

  if (!body || typeof body.reason !== "string") {
    return NextResponse.json({ error: "reason required" }, { status: 400 });
  }

  // Forwarded when present. getUserIdFromRequest is not used here because this
  // route never decides anything from the answer: BlueCaster verifies the token
  // itself and simply records nobody when it is absent or bad.
  const accessToken =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || undefined;

  // The leftmost entry is the client; the rest are proxies that appended
  // themselves. On Vercel this header is set at the edge.
  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;

  try {
    const result = await submitSpotIssueReport(
      slug,
      {
        reason: body.reason,
        note: typeof body.note === "string" ? body.note : null,
        surface: body.surface === "spot_card" ? "spot_card" : "spot_page",
        // The thumbs-down this report came out of. Null from a card's flag,
        // and null when that vote was throttled. BlueCaster validates it as a
        // uuid and drops anything else.
        verdictId: typeof body.verdictId === "string" ? body.verdictId : null,
        contactEmail:
          typeof body.contactEmail === "string" ? body.contactEmail : null,
        context:
          body.context && typeof body.context === "object" && !Array.isArray(body.context)
            ? (body.context as Record<string, unknown>)
            : {},
        website: typeof body.website === "string" ? body.website : undefined,
      },
      { accessToken, clientIp },
    );

    if (!result.ok) {
      // 404 is a slug we do not serve, or a private spot the caller may not
      // see. 400 is a body BlueCaster refused, which the dialog cannot
      // produce but a hand-rolled caller can. Anything else is the upstream
      // failing, and only that is a 502: reporting a bad body as a gateway
      // error sends whoever is debugging it to the wrong side of the wire.
      const passthrough = result.status === 404 || result.status === 400;
      return NextResponse.json(
        {
          error:
            result.status === 404
              ? "not_found"
              : result.status === 400
                ? "invalid_report"
                : "submit_failed",
        },
        { status: passthrough ? result.status : 502 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "submit_failed" }, { status: 502 });
  }
}

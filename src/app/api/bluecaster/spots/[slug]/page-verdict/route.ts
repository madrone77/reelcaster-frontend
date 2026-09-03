import { NextRequest, NextResponse } from "next/server";
import { recordSpotPageVerdict } from "@/lib/bluecaster";

/**
 * POST /api/bluecaster/spots/[slug]/page-verdict
 *
 * The thumb from "Does this look right to you?" at the foot of a spot page.
 * Same-origin proxy, so the BlueCaster key stays on the server.
 *
 * Open to anyone, for the same reason its `issue-report` sibling is: the value
 * of this control is the count of ordinary readers who looked, and gating it
 * behind a session would leave us counting only subscribers. A session token is
 * forwarded when there is one and is never required.
 *
 * Returns `verdictId`, which a thumbs down carries into the report dialog so
 * the two can be joined. ⚠️ It is null for a throttled vote and the client must
 * cope with that; see the note in `page-verdict.tsx`.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const body = (await request.json().catch(() => null)) as {
    verdict?: unknown;
    surface?: unknown;
    context?: unknown;
  } | null;

  if (body?.verdict !== "up" && body?.verdict !== "down") {
    return NextResponse.json({ error: "verdict required" }, { status: 400 });
  }

  const accessToken =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || undefined;
  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;

  try {
    const result = await recordSpotPageVerdict(
      slug,
      {
        verdict: body.verdict,
        surface: typeof body.surface === "string" ? body.surface : "spot_page",
        context:
          body.context && typeof body.context === "object" && !Array.isArray(body.context)
            ? (body.context as Record<string, unknown>)
            : {},
      },
      { accessToken, clientIp },
    );

    if (!result.ok) {
      // Same split as the report proxy: a 404 or a refused body is the caller's
      // to see, and only an upstream failure is a 502.
      const passthrough = result.status === 404 || result.status === 400;
      return NextResponse.json(
        {
          error:
            result.status === 404
              ? "not_found"
              : result.status === 400
                ? "invalid_verdict"
                : "vote_failed",
        },
        { status: passthrough ? result.status : 502 },
      );
    }
    return NextResponse.json({ ok: true, verdictId: result.verdictId });
  } catch {
    return NextResponse.json({ error: "vote_failed" }, { status: 502 });
  }
}

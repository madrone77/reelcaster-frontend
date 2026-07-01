import { NextRequest, NextResponse } from "next/server";
import { resolveSecret, vaultConfigured } from "@/lib/secrets";

/**
 * Single-secret integration probe for the Vault runtime loader.
 *
 * GET /api/secrets/health?name=BLUECASTER_API_KEY
 * Auth: Authorization: Bearer <CRON_SECRET>
 *
 * Reports whether the named secret resolves and from WHERE (vault|env) plus its
 * length — never the value itself. Gated behind CRON_SECRET so it can't be used
 * to probe which secrets exist. Remove once the migration is verified.
 */
export const dynamic = "force-dynamic"; // OIDC token is only available per-request

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected || req.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const name = req.nextUrl.searchParams.get("name") ?? "BLUECASTER_API_KEY";
  try {
    const { value, source } = await resolveSecret(name);
    return NextResponse.json({
      name,
      loaded: true,
      vaultConfigured: vaultConfigured(),
      resolvedFrom: source,
      length: value.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json(
      { name, loaded: false, vaultConfigured: vaultConfigured(), error: message },
      { status: 500 },
    );
  }
}

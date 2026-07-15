import { NextRequest, NextResponse } from "next/server";
import { commitCatchToPool } from "@/lib/bluecaster";
import { getUserIdFromRequest } from "@/lib/server-auth";
import type { PoolCommitPayload } from "@/lib/bluecaster/catch-ingest-types";

export const maxDuration = 60;

/**
 * POST /api/bluecaster/ingest/catch
 *
 * Authenticated same-origin proxy to BlueCaster's intelligence-pool commit.
 * Called fire-and-forget after a catch is saved (never blocks the save).
 * Multipart body: `payload` (JSON string, PoolCommitPayload minus
 * angler_user_id — the verified user id is stamped server-side) and an
 * optional `photo` File. Header `idempotency-key` (the catch row id) makes
 * retries replay instead of duplicating.
 */
export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  const payloadRaw = form?.get("payload");
  if (typeof payloadRaw !== "string") {
    return NextResponse.json({ error: "payload is required" }, { status: 400 });
  }
  let payload: PoolCommitPayload;
  try {
    payload = JSON.parse(payloadRaw) as PoolCommitPayload;
  } catch {
    return NextResponse.json({ error: "payload is not valid JSON" }, { status: 400 });
  }
  // The angler identity is the VERIFIED session user — never trust the body.
  payload.angler_user_id = userId;
  payload.contributes_to_pool = payload.contributes_to_pool ?? true;
  payload.gps_stays_private = payload.gps_stays_private ?? true;

  const photoEntry = form?.get("photo");
  const photo =
    photoEntry && typeof photoEntry === "object" && "arrayBuffer" in photoEntry
      ? (photoEntry as File)
      : null;

  const idempotencyKey =
    request.headers.get("idempotency-key") ?? crypto.randomUUID();

  try {
    const data = await commitCatchToPool(payload, photo, idempotencyKey);
    if (!data) return NextResponse.json({ error: "commit_failed" }, { status: 502 });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

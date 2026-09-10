import { NextRequest, NextResponse } from "next/server";
import { previewCatchPhoto } from "@/lib/bluecaster";
import { getUserIdFromRequest } from "@/lib/server-auth";

export const maxDuration = 60;

/**
 * Ceiling on the photo this route will forward to the vision pass.
 *
 * `preparePhotoForAnalysis` downscales the analysis copy to ≤2048px and
 * targets ≤3 MB before it ever gets here, so a real wizard upload lands far
 * under this. The headroom is for the passthrough case and for compression
 * overshoot; anything above it is not the wizard talking.
 */
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

/**
 * POST /api/bluecaster/ingest/catch/preview
 *
 * Same-origin multipart proxy to BlueCaster's `/api/v1/ingest/catch/preview`
 * (the BlueCaster API key stays server-only). Body: multipart form-data with a
 * `photo` File. Returns the vision/EXIF/spot/snapshot preview used to pre-fill
 * the Log-a-catch form. Non-destructive — nothing is persisted here.
 *
 * Signed-in only. Nothing is written, but every call spends vision tokens on
 * whatever image it is handed, so an open route is a metered bill anyone can
 * run up. The wizard already renders `<SignedOut />` instead of the upload
 * step for a signed-out visitor, and `POST /api/bluecaster/ingest/catch` — the
 * save this preview leads to — has always required a session, so no reachable
 * path loses anything by asking for the token here too.
 */
export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  const photo = form?.get("photo");
  if (!photo || typeof photo !== "object" || !("arrayBuffer" in photo)) {
    return NextResponse.json({ error: "photo is required" }, { status: 400 });
  }
  if ((photo as File).size > MAX_PHOTO_BYTES) {
    return NextResponse.json({ error: "photo is too large" }, { status: 413 });
  }
  try {
    const data = await previewCatchPhoto(photo as File);
    if (!data) {
      return NextResponse.json({ error: "preview_failed" }, { status: 502 });
    }
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

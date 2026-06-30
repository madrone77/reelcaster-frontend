import { NextRequest, NextResponse } from "next/server";
import { previewCatchPhoto } from "@/lib/bluecaster";

export const maxDuration = 60;

/**
 * POST /api/bluecaster/ingest/catch/preview
 *
 * Same-origin multipart proxy to BlueCaster's `/api/v1/ingest/catch/preview`
 * (the BlueCaster API key stays server-only). Body: multipart form-data with a
 * `photo` File. Returns the vision/EXIF/spot/snapshot preview used to pre-fill
 * the Log-a-catch form. Non-destructive — nothing is persisted here.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const photo = form?.get("photo");
  if (!photo || typeof photo !== "object" || !("arrayBuffer" in photo)) {
    return NextResponse.json({ error: "photo is required" }, { status: 400 });
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

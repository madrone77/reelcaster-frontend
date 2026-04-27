import { NextResponse } from "next/server";
import { fetchSpotPage } from "@/lib/bluecaster";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
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
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
  }
}

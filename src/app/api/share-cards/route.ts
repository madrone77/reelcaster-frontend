import { NextResponse, type NextRequest } from "next/server";
import { getUserIdFromRequest } from "@/lib/server-auth";
import { mintShareCard } from "@/lib/share-cards-server";
import { SITE_URL } from "@/lib/site";
import { shareMessage, shareTitle, shareUrl } from "@/lib/share-cards";

/**
 * POST /api/share-cards — mint the frozen snapshot behind a share link.
 *
 * WHY THIS IS CALLED WHEN THE MODAL OPENS, NOT WHEN SEND IS TAPPED.
 * `navigator.share()` needs transient activation, and iOS Safari rejects it
 * with NotAllowedError if the handler awaits anything first. Minting inside the
 * tap would therefore work everywhere except the platform this feature is
 * mostly for. Opening the modal is the first gesture and sending is the second,
 * so the token is already in hand by the time the sheet is asked for.
 *
 * Open to signed-out callers on purpose — a growth loop gated behind a login is
 * an own goal. `mintShareCard` keeps the public write idempotent rather than
 * rate limited, which is the same answer the weekend-alert capture route gives.
 */
export async function POST(request: NextRequest) {
  let body: { slug?: unknown; speciesId?: unknown; targetDate?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  if (!slug || slug.length > 120) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }

  const speciesId =
    typeof body.speciesId === "string" && body.speciesId ? body.speciesId : null;
  // Only ever a plain calendar date. Anything else is ignored rather than
  // rejected, and the snapshot falls back to the best day it can see.
  const targetDate =
    typeof body.targetDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(body.targetDate)
      ? body.targetDate
      : null;

  const userId = await getUserIdFromRequest(request);

  const card = await mintShareCard({
    source: "spot",
    slug,
    speciesId,
    targetDate,
    userId,
  });

  // No scored day to talk about is a normal outcome for an unscored spot, not
  // a server fault. The caller hides the share affordance rather than showing
  // an error for something nobody did wrong.
  if (!card) {
    return NextResponse.json(
      { error: "Nothing to share for this spot yet" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    token: card.token,
    url: shareUrl(SITE_URL, card.token),
    title: shareTitle(card),
    message: shareMessage(card),
    card,
  });
}

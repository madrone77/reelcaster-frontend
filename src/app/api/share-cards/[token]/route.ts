import { NextResponse } from "next/server";
import { readShareCard } from "@/lib/share-cards-server";
import { SITE_URL } from "@/lib/site";
import { shareMessage, shareTitle, shareUrl } from "@/lib/share-cards";

/**
 * GET /api/share-cards/<token> — read a card the caller already has a link to.
 *
 * Exists for the alert path. There the token is minted when the alert fires, so
 * the sharer's modal arrives holding a token but none of the copy that goes
 * with it, and re-minting would create a second card for a day that already has
 * one.
 *
 * Unauthenticated because the token IS the credential: anyone holding the link
 * can already see all of this at /s/<token>. The table is service-role only so
 * that tokens cannot be enumerated instead of guessed.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const card = await readShareCard(token).catch(() => null);
  if (!card) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    token: card.token,
    url: shareUrl(SITE_URL, card.token),
    title: shareTitle(card),
    message: shareMessage(card),
    card,
  });
}

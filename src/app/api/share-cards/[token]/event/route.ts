import { NextResponse, type NextRequest } from "next/server";
import { markShareSent, recordShareOpen } from "@/lib/share-cards-server";

/**
 * POST /api/share-cards/<token>/event — the two counters in the share funnel.
 *
 * `opened` is fired by the recipient's modal on mount rather than from the page
 * render: RSC prefetches and repeated server renders would inflate a count
 * taken server-side, and an open is the one number here that has to mean a
 * person.
 *
 * `sent` is fired after the share sheet resolves. Cards minted and cards
 * actually sent are very different numbers, and the gap between them is what
 * says whether the modal is persuading anyone.
 *
 * Unauthenticated on purpose: the token is the credential, both writes are
 * idempotent-ish counters, and neither reveals anything about the card.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!/^[0-9a-f]{16}$/.test(token)) {
    return NextResponse.json({ error: "Bad token" }, { status: 400 });
  }

  let event: unknown;
  try {
    event = (await request.json())?.event;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  if (event === "opened") {
    await recordShareOpen(token);
  } else if (event === "sent") {
    await markShareSent(token);
  } else {
    return NextResponse.json({ error: "Unknown event" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

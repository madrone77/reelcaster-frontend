import { NextResponse } from 'next/server';
import { ADSENSE_CLIENT, AD_SLOTS } from '@/lib/adsense';

/**
 * The ad placement inventory, as this deployment actually has it configured.
 *
 * Exists for bluecaster's admin Ads panel. That panel needs to answer "which
 * placements are live right now", and the only honest source for that is the
 * running deployment — a copy of the table kept in bluecaster would keep
 * claiming a placement was live for however long it took someone to notice the
 * two repos had drifted, which is worse than having no panel at all.
 *
 * Nothing here is secret. Slot IDs are `data-ad-slot` attributes that ship in
 * the HTML of every page carrying a unit, so this endpoint publishes nothing a
 * reader could not already see, and it is deliberately not authenticated.
 */

export const dynamic = 'force-dynamic';

export function GET() {
  const placements = Object.entries(AD_SLOTS).map(([id, unit]) => ({
    id,
    slot: unit.slot,
    format: unit.format,
    layoutKey: unit.layoutKey ?? null,
    house: unit.house === true,
    /** An empty slot disables the placement — it renders nothing at all. */
    enabled: unit.slot !== '',
  }));

  return NextResponse.json(
    {
      client: ADSENSE_CLIENT,
      placements,
      // Lets the panel say which build it is describing, so a stale CDN copy
      // is visible as a stale copy rather than read as current truth.
      build:
        process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
        process.env.BUILD_TIMESTAMP ||
        'local',
    },
    // The panel is asking "what is true this second". A cached answer would
    // reintroduce exactly the staleness this endpoint exists to remove.
    { headers: { 'cache-control': 'no-store' } },
  );
}

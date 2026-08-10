/**
 * ── AdSense configuration ──────────────────────────────────────────────────
 *
 * One publisher, a handful of named placements. Slot IDs are created in the
 * AdSense console (Ads → By ad unit → Display ads) and pasted here; they are
 * public values that ship in the page HTML, so there is nothing to protect and
 * no reason to route them through env vars — a constant is reviewable in the
 * diff and moves with the code that renders it.
 *
 * ── Where ads may appear ───────────────────────────────────────────────────
 *
 * Only /explore and /explore/spot/[slug], and only for anonymous and free
 * viewers. Anyone with a paid entitlement — including trialists, who are paying
 * for the Pro experience even before the first charge — sees nothing. That rule
 * is enforced in <AdSlot>, not here, and not in the AdSense console: the console
 * has no concept of our tiers, which is the whole reason these are manual ad
 * units rather than Auto ads.
 *
 * ⚠ Auto ads MUST stay OFF in the console. Auto ads work off the loader script
 * alone, which the root layout ships site-wide so Google can verify ownership
 * on any page it crawls. Switching them on would paste ads across the marketing
 * pages, the billing pages, and every Pro account, with no way to gate them.
 */

export const ADSENSE_CLIENT = 'ca-pub-8843447703932843';

/**
 * Slot IDs per placement. An empty string disables that placement outright —
 * <AdSlot> renders nothing at all rather than an <ins> AdSense can never fill.
 *
 * That is the deliberate pre-approval state: the placements can ship, be
 * reviewed, and be verified as invisible before the account is live, and light
 * up on the deploy that fills these in.
 */
export type AdPlacement = 'exploreList' | 'spotMid' | 'spotFoot';

// Typed as plain strings rather than `as const`: under `as const` each value
// narrows to its own literal, and <AdSlot>'s `slot !== ''` guard becomes a
// comparison TypeScript rejects as impossible the moment a real ID is pasted
// in — turning "fill in the slot IDs" into a build failure.
export const AD_SLOTS: Record<AdPlacement, string> = {
  /** In the desktop rail's spot list, and the mobile pull-up sheet's list. */
  exploreList: '',
  /** Spot page, between "Score Explained" and "Seasonality". */
  spotMid: '',
  /** Spot page, below the description and hierarchy trail. */
  spotFoot: '',
};

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

export type AdPlacement = 'exploreList' | 'spotMid' | 'spotFoot';

export interface AdUnit {
  /** `data-ad-slot`. Empty disables the placement — nothing renders at all. */
  slot: string;
  /**
   * `data-ad-format`. `fluid` is an in-feed unit: it takes its shape from the
   * list it sits in and is styled by `layoutKey`, which is how it reads as one
   * more card rather than a rectangle dropped between two. `auto` is an
   * ordinary responsive display unit.
   */
  format: 'auto' | 'fluid';
  /**
   * `data-ad-layout-key`. In-feed units only, and not optional for them — the
   * console generates it alongside the unit and it encodes the layout chosen
   * there. Without it a fluid unit has no shape to render into.
   */
  layoutKey?: string;
}

/**
 * The ad unit behind each placement, as configured in the AdSense console.
 *
 * A placement with an empty `slot` is off: <AdSlot> renders nothing rather than
 * an <ins> AdSense can never fill. That is the deliberate state for a placement
 * whose unit has not been created yet — it can ship, be reviewed, and be
 * verified invisible, then light up on the deploy that fills the slot in.
 *
 * Deliberately not `as const`: literal narrowing turns <AdSlot>'s `slot !== ''`
 * guard into a comparison TypeScript rejects as impossible the moment a real ID
 * is pasted in, which would make "fill in the slot ID" a build failure.
 */
export const AD_SLOTS: Record<AdPlacement, AdUnit> = {
  /** In the desktop rail's spot list, and the mobile pull-up sheet's list. */
  exploreList: {
    slot: '1234112037',
    format: 'fluid',
    layoutKey: '-fb+5w+4e-db+86',
  },
  /** Spot page, between "Score Explained" and "Seasonality". */
  spotMid: { slot: '', format: 'auto' },
  /** Spot page, below the description and hierarchy trail. */
  spotFoot: { slot: '', format: 'auto' },
};

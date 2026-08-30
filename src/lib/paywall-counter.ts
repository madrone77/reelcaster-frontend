/**
 * The paywall counter, in one place.
 *
 * Every upgrade wall we show should answer two questions: how often was it
 * seen, and how often did somebody act on it. The answer lands in
 * `paywall_impressions` through POST /api/attribution/paywall, and it is read
 * back on the bluecaster admin at /admin/reelcaster/paywalls.
 *
 * This lived inside `<ProTrialModal>` as a private callback, which is why the
 * two walls that do not route through that modal, the `<UpgradeRequiredModal>`
 * on /alerts and the `<UnlockWithProCard>` on /support, were counted nowhere.
 * They fired Mixpanel events and stopped there, so on the admin they read as
 * walls nobody had ever seen rather than as walls with no data. A shared
 * function is the fix: a new wall has one obvious thing to call.
 *
 * WHAT THE SERVER WILL ACCEPT. `feature` is validated against the live
 * `NAG_FEATURES` enum and rejected with a 400 if it is not a member, so a wall
 * with a made-up feature id counts nothing, quietly. That is why the argument
 * is typed as `NagFeatureId` here rather than as a string: the enum is the
 * contract, and a new wall belongs in plan-features.ts first.
 *
 * FIRE AND FORGET, ALWAYS. A counter must never block a paywall or fail one.
 * Nothing here throws, nothing is awaited, and the response is ignored.
 * `keepalive` is the one detail that matters: a CTA click navigates away, to
 * /signup, to /plans, or out to Stripe, and an in-flight fetch on a tearing
 * down document is dropped without it. That would lose exactly the clicks that
 * went on to convert.
 */

import type { NagFeatureId, PlanTierId } from './plan-features';

export type PaywallCountKind = 'impression' | 'cta_click';

export interface PaywallCountTarget {
  /** What the visitor was denied. Must be a live NAG_FEATURES key. */
  feature: NagFeatureId;
  /**
   * Where the wall was met: "explore-topbar", "alerts-page", "support-portal".
   * Free text, capped at 200 characters by the route. Name the place, not the
   * component, because this is read as a list of surfaces on the admin.
   */
  surface: string;
  /** Who was looking. Decides nothing here; it is a column on the report. */
  viewerTier: PlanTierId;
}

export function reportPaywall(
  kind: PaywallCountKind,
  { feature, surface, viewerTier }: PaywallCountTarget
): void {
  if (typeof window === 'undefined') return;
  void fetch('/api/attribution/paywall', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind,
      feature,
      surface,
      viewer_tier: viewerTier,
    }),
    keepalive: true,
  }).catch(() => {});
}

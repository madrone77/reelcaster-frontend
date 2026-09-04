/**
 * The one expression for "what kind of viewer is this", shared by analytics
 * and the paywall surfaces. It used to be written inline in three places
 * (pro-trial-modal, billing/cancel, spot-detail-shell) and drifted between
 * them; the analytics super property needs the same answer everywhere.
 */
import type { PlanTierId } from '@/lib/plan-features';

export function viewerTierOf(signedIn: boolean, isPaid: boolean): PlanTierId {
  if (isPaid) return 'pro';
  return signedIn ? 'free' : 'anon';
}

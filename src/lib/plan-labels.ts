/**
 * What each tier is CALLED. Not what it is worth, not what it unlocks.
 *
 *   Free    no account at all. Browsing. 2 forecast days.
 *   Member  signed in, paying nothing. 7 forecast days.
 *   Pro     paying. 14 forecast days.
 *
 * Naming decided 2026-09-01. Before it, the signed-in unpaid tier was the one
 * called "Free" and the signed-out state had no name, which made "sign up
 * free" read as a toll on something the reader already had. Naming the
 * browsing state Free and promoting the account to Member turns the same click
 * into a step up.
 *
 * ⚠️ These are LABELS. The identifiers `anon` / `free` / `pro` stay exactly as
 * they are, everywhere they already appear:
 *
 *   user_settings.subscription_tier      written by the Stripe webhook
 *   resolveEntitlement()                 the tier gate all six routes call
 *   /api/attribution/paywall events      tier is a stored analytics dimension
 *   the welcome email variant            'free' | 'checkout'
 *
 * Renaming a value in any of those buys a migration and a month of analytics
 * that no longer compares to the month before it, for something no customer
 * ever sees. The word changed. The data did not.
 *
 * Use PLAN_LABELS where the tier is a LABEL: a column heading, a badge, a
 * status line. In running prose just write the word, the way this file's own
 * comment does. A sentence that reads `{PLAN_LABELS.free} accounts get 1
 * alert` is harder to search and no easier to change than the sentence itself.
 */

import type { PlanTierId } from "./plan-features";

export const PLAN_LABELS: Record<PlanTierId, string> = {
  anon: "Free",
  free: "Member",
  pro: "Pro",
};

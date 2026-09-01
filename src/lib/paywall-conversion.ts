/**
 * A bought click reaching the paywall, reported back to the network that sold
 * it. This file is the contract that says what that event is called and when
 * one visitor counts once.
 *
 * WHY REPORT SOMETHING THIS FAR FROM MONEY. The same argument as
 * src/lib/signup-conversion.ts, one rung lower down the funnel, and for the
 * same reason: Meta needs roughly thirty conversions a month before its bidding
 * leaves the learning phase, and every event already reported is below that.
 * Trials are a handful. Signups were twenty in thirty days. Paywall opens are
 * the first event in this funnel that clears the threshold — 127 of them across
 * 48 sessions on the first day the log existed.
 *
 * The cost is stated plainly: this teaches the optimiser to find people who
 * open a modal, which is a weaker thing to want than people who pay. That trade
 * is worth taking only while the events closer to money are too rare to learn
 * from. When trials clear thirty a month, bid on trials and stop sending this.
 *
 * WHAT IT IS NOT. Not a count of interest, and not comparable to the `views`
 * column on /admin/reelcaster/paywalls/attribution. That column counts every
 * wall open from everybody; this counts once per session, and only for a
 * visitor carrying a paid touch. The two answer different questions and the
 * smaller number is not a broken version of the larger one.
 */

/**
 * The Meta event name.
 *
 * Custom, unlike StartTrial and CompleteRegistration, and that is a real cost:
 * Meta's models are pre-trained on the standard events and a custom one starts
 * cold. It is named anyway because there is no standard event that means this.
 * ViewContent would be a lie about what was viewed, and InitiateCheckout is
 * already what a CTA press leads to — reusing either would put two different
 * behaviours under one name and make both unreadable.
 */
export const PAYWALL_VIEW_META_EVENT = 'PaywallView' as const;

/**
 * The Google conversion action for the same event, which unlike Meta's is an
 * account-specific resource name rather than a string we choose. Read from the
 * environment so a conversion action can be created, renamed or swapped in the
 * Ads UI without a deploy.
 *
 * NOTE: the Google upload path has been dead for this account since June 2026 —
 * the Ads API refuses UploadClickConversions from a developer token that had
 * not already uploaded offline conversions in a window that has closed. Setting
 * this variable will not by itself make Google receive anything. It is wired up
 * so that the day the account is unblocked, or the Data Manager migration
 * lands, this event goes with the others rather than needing to be added then.
 */
export const GOOGLE_PAYWALL_VIEW_ACTION_ENV = 'GOOGLE_ADS_CONVERSION_ACTION_PAYWALL_VIEW';

/**
 * The key that makes one visit count once, and the Meta `event_id`.
 *
 * ONE PER SESSION, which is what `rc_sess` already means: thirty minutes idle
 * or six hours absolute, whichever comes first (src/lib/paywall-session.ts).
 * Without this, an undecided reader who opens the same wall three times is
 * three conversions, and what the optimiser learns to find is people who bounce
 * off a paywall repeatedly. Today's real ratio is 127 opens to 48 sessions, so
 * the unguarded number would be about two and a half times the people count.
 *
 * THE FALLBACK EXISTS BECAUSE THE GUARD MUST NOT BE THE MEASUREMENT. A browser
 * blocking cookies has no session id, and dropping those visits would quietly
 * bias the count toward people who accept cookies — the opposite of the segment
 * an ad campaign most wants to see. The click id is stable for that visitor and
 * the Pacific day gives it roughly the same grain as a session.
 *
 * Returns null when there is neither, which is the one case that is skipped:
 * with nothing stable to key on, "once" cannot be enforced at all, and an
 * unbounded stream of duplicates is worse than a small undercount.
 */
export function paywallViewDedupeKey(input: {
  sessionId: string | null;
  clickId: string | null;
  day: string;
}): string | null {
  if (input.sessionId) return `pv:s:${input.sessionId}`;
  if (input.clickId) return `pv:c:${input.clickId}:${input.day}`;
  return null;
}

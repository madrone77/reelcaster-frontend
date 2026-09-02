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
 * `InitiateCheckout`, and it started life as a custom `PaywallView`. The
 * argument for the custom name was that InitiateCheckout was "already what a
 * CTA press leads to", so reusing it would put two behaviours under one name.
 * That was a reservation, not a fact: nothing in this codebase has ever fired
 * InitiateCheckout, and the CTA press it was being held for was never built.
 *
 * A reservation is not worth what a custom event costs. Meta's optimisation
 * models are pre-trained on the standard names and a custom one starts cold,
 * which is the exact problem this event exists to solve — see the volume
 * argument above. A standard name is also selectable as a campaign objective
 * directly, where a custom one has to be wrapped in a custom conversion in
 * Events Manager first.
 *
 * WHAT IT COSTS, stated so nobody has to rediscover it. The name is now spent:
 * an event on the button INSIDE the modal, if one is ever wanted, needs a
 * different one, or has to accept that the modal opening is where this funnel
 * says checkout begins. And Events Manager will show a bad InitiateCheckout to
 * Purchase ratio, because the numerator is modal opens. Both are reporting
 * cosmetics. Neither changes what the optimiser is bidding on.
 *
 * It stays honest enough to defend: the modal carries the plan matrix and the
 * button that goes to Stripe, so opening it is entering the checkout flow. The
 * two names that would have been lies are still lies. ViewContent misdescribes
 * what was viewed, and Purchase misdescribes everything.
 *
 * TYPED AS A STANDARD EVENT ON PURPOSE. `metaTrack` in src/lib/meta-pixel.ts
 * accepts `MetaStandardEvent` and nothing else, so this constant is checked
 * against that list at build time. Changing it back to a custom string breaks
 * the compile rather than quietly landing an event in Events Manager that
 * nobody is looking for.
 */
export const PAYWALL_VIEW_META_EVENT = 'InitiateCheckout' as const;

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

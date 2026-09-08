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
 * THE OPEN NO LONGER REACHES META. Until 2026-09-08 it went up as
 * `InitiateCheckout` and was the event the campaign bid on, because nothing
 * closer to money was frequent enough to learn from. Casey moved that name
 * down one rung to the Begin checkout tap (CHECKOUT_TAP_META_EVENT, below)
 * rather than touch a running campaign's conversion action: the ad set keeps
 * optimising for "InitiateCheckout", and what that word means changed under
 * it. The open is still recorded in `marketing_conversions` for the admin's
 * Offer % and still tagged for Google, whose conversion action was always its
 * own; the Meta leg of the upload skips it (see uploadToMeta), and the browser
 * fires no Meta tag for it.
 *
 * The history, since the name will be read in Events Manager for years: the
 * open shipped as a custom `PaywallView`, became `InitiateCheckout` on
 * 2026-09-02 (standard names bid better; a custom one starts cold), was cut to
 * opens the reader asked for on 2026-09-07 (#624, #628), and handed the name to
 * the tap on 2026-09-08. The series in Events Manager is three things end to
 * end and should be read with those dates beside it.
 */


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

/**
 * Which opens count. ONLY THE ONES THE VISITOR ASKED FOR.
 *
 * The modal reaches a reader two ways and they are not the same event. One is
 * a tap on a button that says "Start free trial" or "Upgrade to Pro": the top
 * bar on Explore, the ad frame's one button, the Pro CTAs across the marketing
 * site. The other is a wall the product put in the way: a grey day tile, the
 * Add spot control, the day-two spot open, the catch reports band. Both open
 * the same component and both used to be reported under the same name.
 *
 * Measured 2026-09-07 over 30 days of Meta sessions in paywall_events, the two
 * do not behave alike. A reader who tapped the ad-frame trial button went on
 * to tap Begin checkout 30 times in 134 opens, about one in five. The locked
 * day tile managed 9 in 134, the map's custom-spot control 2 in 75, and the
 * day-two wall 0 in 38. About half of everything Meta was being told to find
 * was the second group, and the optimiser cannot tell them apart when they
 * share a name.
 *
 * So the conversion is now the ASK, not the wall. Volume drops by roughly half
 * to about fifty a week, which is where Meta says its bidding stops being
 * learning-limited, and the event it learns from is four times closer to a
 * checkout. When the Begin checkout tap itself clears that bar, move the
 * objective to it and retire this.
 *
 * AN ALLOWLIST, NOT A BLOCKLIST, on purpose. A new wall added to the product
 * starts out uncounted, and someone has to argue it in; a blocklist would let
 * every new interruption quietly join the conversion until somebody noticed
 * the ratio had moved.
 *
 * ONE BUTTON, TWO PLACES (Casey, 2026-09-08). The signed-out "Start free
 * trial" button in the Explore top bar and in the ad frame's bar, and nothing
 * else. The first cut of this list (FE #624) also took the signed-in "Upgrade
 * to Pro" buttons and every `marketing-*` CTA; the day it ran, 58 of 59 fires
 * were the ad-bar trial button anyway, and the one that was not was a
 * marketing header on a page no ad points at. Bidding on exactly the button
 * the ad lands people in front of keeps the event one thing.
 *
 * `null` (a wall reported without a surface) is not asked for either.
 */
const ASKED_FOR_SURFACES: ReadonlySet<string> = new Set(['explore-ad-topbar', 'explore-topbar']);

export function paywallViewIsAskedFor(surface: string | null | undefined): boolean {
  if (!surface) return false;
  return ASKED_FOR_SURFACES.has(surface);
}

/* -------------------------------------------------------------------------
 * The next rung: the tap on Begin checkout.
 * ---------------------------------------------------------------------- */

/**
 * The Meta event for a reader tapping Begin checkout inside the modal.
 * `InitiateCheckout`, the name the campaign bids on.
 *
 * WHAT COUNTS AS THE TAP. The "Start 7-day free trial" button at the bottom
 * of the modal, which for a signed-out reader sits under a required email
 * field, so it only fires once a well-formed address is in the box and the
 * form submits; the same button for a signed-in reader, who has no field; and
 * an Apple Pay or Google Pay button, which skips the email. The sign-up link
 * and the plans link inside the modal are not the tap.
 *
 * WHY THIS IS THE EVENT (Casey, 2026-09-08). The open was ~160 a week on Meta
 * and the tap ~30, but the open converted to a trial at about one in fourteen
 * and the tap at about one in three, and Meta was being told to find people
 * who open modals. Thirty a week is under the ~50 Meta wants to leave the
 * learning phase; that trade is taken knowingly. It briefly shipped as
 * `AddPaymentInfo` beside the open (#626, one day) so the campaign would not
 * need editing; the campaign is not being edited either way, so the name it
 * already bids on is the one the tap now carries.
 *
 * NO `marketing_conversions` ROW, unlike the open. That table's event_type is
 * a CHECK constraint, the admin analytics read it by name, and the offline
 * upload leg was made redundant for browser-fired events by the pixel's own
 * Conversions API Gateway (see META_GATEWAY_OWNED_EVENTS in
 * conversion-upload.ts): the browser fires the tag, the gateway relays it as
 * the server copy, and both carry the id below. The count lives in
 * `paywall_events` as `cta_click` rows with `context.checkout_tap = true`.
 *
 * ONCE PER SESSION is enforced by Meta rather than by us. With no row there is
 * no partial unique index to refuse a second tap, so the id is the same string
 * for every tap in a session and Meta's own event-id deduplication (48 hours,
 * same name) collapses them. A reader who taps, fixes a typo in the email and
 * taps again is one event. That is weaker than the open's guard by exactly the
 * width of a 48-hour window, which is narrower than a session anyway.
 */
export const CHECKOUT_TAP_META_EVENT = 'InitiateCheckout' as const;

/**
 * The Meta `event_id` for the tap. Same two branches and the same refusal as
 * `paywallViewDedupeKey`, under a different prefix so the open's row (which
 * Google still keys on) and the tap's tag never share an id.
 */
export function checkoutTapDedupeKey(input: {
  sessionId: string | null;
  clickId: string | null;
  day: string;
}): string | null {
  if (input.sessionId) return `ct:s:${input.sessionId}`;
  if (input.clickId) return `ct:c:${input.clickId}:${input.day}`;
  return null;
}

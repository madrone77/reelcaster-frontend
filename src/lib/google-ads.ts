/**
 * The browser half of Google Ads conversion tracking.
 *
 * Unlike Meta, this is the ONLY half. `src/lib/conversion-upload.ts` still has
 * a Google leg, and it no longer works: since 15 June 2026 the Ads API rejects
 * `UploadClickConversions` from any developer token that had not already
 * uploaded offline conversions between December 2025 and May 2026, with
 * CUSTOMER_NOT_ALLOWLISTED_FOR_THIS_FEATURE. This account never uploaded one,
 * so it cannot get on that allowlist. The replacement is the Data Manager API,
 * which is a rewrite rather than a config change.
 *
 * Until that rewrite lands, everything Google Ads knows about a conversion
 * arrives through the tag below. That makes this file load-bearing for bidding
 * in a way `meta-pixel.ts` is not: there is no server-side backstop behind it.
 *
 * The day-7 Purchase is the casualty. No browser is left by then, so a tag can
 * never report it, and Google cannot tell a trial that converts from one that
 * cancels on day 6 until Data Manager is wired up.
 *
 * It is also why the paywall-view conversion has a tag here at all. That event
 * was built for the offline upload, `GOOGLE_ADS_CONVERSION_ACTION_PAYWALL_VIEW`
 * is read by conversion-upload.ts, and on this account it will never send
 * anything. A browser is present when a modal opens, so this is the one event
 * below the trial that Google can actually be told about.
 *
 * Both ids are public values that ship in the page HTML, so they are constants
 * here rather than env vars, matching `src/lib/adsense.ts` and the hardcoded
 * `gaId` in the root layout. A constant is reviewable in the diff and moves
 * with the code that renders it.
 */

/** Google Ads account tag. Goals → Conversions → the "AW-" id on any action. */
export const GOOGLE_ADS_ID = 'AW-18039085285'

/**
 * The "Trial Start" conversion action's label, the half after the slash in
 * `send_to`. A different action (Purchase, when Data Manager lands) gets its
 * own label; the account id above is shared.
 */
export const GOOGLE_ADS_TRIAL_LABEL = 'L-xTCNSK2eUcEOWx2plD'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

/**
 * Call the gtag stub.
 *
 * The stub is what pushes an `arguments` object onto dataLayer, which is the
 * shape gtag.js actually reads; pushing a plain array from here would be
 * skipped in silence. `<GoogleAdsTag>` installs the stub, so by the time any
 * event fires (post-hydration, after an async round trip) it exists.
 *
 * Renders the call a no-op rather than throwing when it does not, because a
 * missing tag must never break the page a customer just paid on.
 */
function gtag(...args: unknown[]): void {
  if (typeof window === 'undefined') return
  window.gtag?.(...args)
}

/**
 * Report the trial-start conversion.
 *
 * `transaction_id` is the same `event_id` the Meta leg uses
 * (`<stripe_subscription_id>:<event_type>`), which is what lets Google discard
 * a repeat when someone refreshes the success page.
 *
 * No `value` or `currency`. The conversion action is configured with a fixed
 * value in the Google Ads UI ("Use the same value for each conversion"), and a
 * value sent here would override it. One place to change the number beats two
 * that can disagree.
 *
 * `email` powers enhanced conversions. Passed unhashed on purpose: gtag hashes
 * it with SHA-256 in the browser, so the raw address never leaves the device.
 * Omitted when we do not have one, which costs match quality and nothing else.
 */
export function googleTrackTrialStart(eventId: string, email?: string | null): void {
  if (email) gtag('set', 'user_data', { email })
  gtag('event', 'conversion', {
    send_to: `${GOOGLE_ADS_ID}/${GOOGLE_ADS_TRIAL_LABEL}`,
    transaction_id: eventId,
  })
}

/**
 * The "Initiate Checkout" conversion action's label.
 *
 * Minted by hand in the Ads UI on 2026-09-01, because the offline upload path
 * this event was originally built for is dead on this account and there is no
 * API here that can create an action. Settings that matter to the tag: no
 * value, count One per click, 30-day click window. It is named to match Meta's
 * InitiateCheckout so one act carries one name on both dashboards; only the
 * Google category underneath it still says "Begin checkout", that being the
 * nearest thing Google offers.
 *
 * Not GOOGLE_ADS_TRIAL_LABEL, which would be the one genuinely damaging
 * shortcut available here: paywall opens outnumber trials by two orders of
 * magnitude, and filing them under Trial Start would not merely dilute that
 * action, it would teach Smart Bidding that a modal open is a trial and hand
 * it a conversion count nothing downstream could correct.
 *
 * The same damage has a second route, and creating the action opened it:
 * Google added the Begin checkout goal to all three campaigns on the spot. It
 * has to stay off their goal lists (campaign, Settings, Goals) or Smart
 * Bidding optimises for modal opens anyway, out of a setting no diff shows.
 *
 * A constant rather than an env var, for the same reason as the two above: it
 * is a public value that ships in the page HTML, and a constant is reviewable
 * in the diff.
 */
export const GOOGLE_ADS_PAYWALL_VIEW_LABEL = '6DbrCNTZq-wcEOWx2plD'

/**
 * Report a paid click reaching the offer.
 *
 * `eventId` is the conversion's dedupe key (`pv:s:<session>`), the same string
 * the Conversions API leg sends as its Meta `event_id` and the same one the
 * server has already used to enforce once-per-session. Passing it as
 * `transaction_id` means a browser that fires this twice — a second wall in
 * the same session, a refresh, a re-render — is discarded by Google rather
 * than counted, so the tag cannot be more generous than the row behind it.
 *
 * No `value` and no `currency`, matching the server: a modal open is worth
 * nothing until somebody pays, and the action's own fixed value in the Ads UI
 * is the one place that number should live.
 *
 * No email, so no enhanced conversions. Nearly everyone who sees this wall is
 * signed out, and the ones who are not are not linked to it on purpose — the
 * conversion row itself carries a null user_id, because an anonymous wall open
 * has no established relationship with an account.
 */
export function googleTrackPaywallView(eventId: string): void {
  if (!GOOGLE_ADS_PAYWALL_VIEW_LABEL) return
  gtag('event', 'conversion', {
    send_to: `${GOOGLE_ADS_ID}/${GOOGLE_ADS_PAYWALL_VIEW_LABEL}`,
    transaction_id: eventId,
  })
}

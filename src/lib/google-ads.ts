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
 * never report it, and Google will optimise on trial starts alone until Data
 * Manager is wired up.
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

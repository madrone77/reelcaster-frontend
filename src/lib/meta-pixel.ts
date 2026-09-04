/**
 * The browser half of Meta conversion tracking.
 *
 * The server half already exists and is the reliable one: the Stripe webhook
 * writes `marketing_conversions` rows and `src/lib/conversion-upload.ts` posts
 * them to the Conversions API. Since 2026-09-03 that leg sends Meta only the
 * day-7 `Purchase`, the one event no browser can report: the pixel is wired to
 * a Meta Conversions API Gateway that already relays every browser event as a
 * server copy, so a third copy from our queue was what Ads Manager flagged as
 * "Event not deduplicated". `StartTrial` and `InitiateCheckout` now reach Meta
 * from the browser and the gateway alone (see META_GATEWAY_OWNED_EVENTS).
 *
 * So why a pixel at all? Two things the server leg cannot do:
 *
 *   1. `uploadToMeta` skips every row whose click_type is not `fbclid`. That is
 *      correct for ad attribution and useless for optimisation — Meta only ever
 *      learns from trials it already knew it sold. The pixel reports all of
 *      them.
 *   2. The browser carries `_fbp`, `_fbc`, a real user agent and IP. The CAPI
 *      payload carries `fbc` alone. Match quality is not close.
 *
 * The two streams describe the same conversions, so every event fired here MUST
 * carry an `eventID` that matches the server's `event_id`
 * (`<stripe_subscription_id>:<event_type>`, see conversion-upload.ts). Without
 * it Meta counts one trial twice and bids on a number that is double the truth.
 */

export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? ''

/**
 * Standard events only. Meta's optimisation models are pre-trained on these
 * names; a custom event starts cold and needs volume we do not have. Custom
 * CONVERSIONS are a different thing and need no code — they are built in Events
 * Manager on top of these same events.
 *
 * The list is closed so that a typo cannot become an event. `fbq('track')`
 * accepts any string: "StartTrail" is reported happily, lands in Events Manager
 * as a custom event, and is invisible until somebody wonders why the trial
 * action stopped counting.
 *
 * `InitiateCheckout` is the paywall opening, which is the one entry here that
 * is not fired from a page a customer has already arrived at. The reasoning for
 * putting a modal open under a standard checkout name, and what that costs, is
 * in src/lib/paywall-conversion.ts.
 */
export type MetaStandardEvent =
  | 'PageView'
  | 'StartTrial'
  | 'Purchase'
  | 'CompleteRegistration'
  | 'InitiateCheckout'

type Fbq = ((...args: unknown[]) => void) & { queue?: unknown[] }

declare global {
  interface Window {
    fbq?: Fbq
  }
}

/**
 * The base snippet, verbatim from Events Manager apart from the id.
 *
 * It defines `fbq` as a queueing stub BEFORE fbevents.js arrives, which is why
 * callers never have to wait for the script: a `metaTrack` that runs early is
 * queued and flushed on load rather than dropped.
 */
export function metaPixelSnippet(pixelId: string): string {
  return `!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', ${JSON.stringify(pixelId)});
fbq('track', 'PageView');`
}

/**
 * Fire a standard event. No-ops when the pixel is not configured or the stub
 * has not been defined yet, so nothing here can throw into a render.
 *
 * `customData` is deliberately optional and deliberately unused for
 * `StartTrial`: the server sends that event with no value, and two deduplicated
 * halves of one conversion must not disagree about what it was worth. If a
 * value is ever added, add it on BOTH sides in the same change, and read
 * `subscription.currency` for the currency, because the one multi-currency
 * Price always reports `cad`, including for American buyers.
 *
 * `CompleteRegistration` is the exception that proves the rule. It DOES carry a
 * value, and both halves read it from the same constant in
 * src/lib/signup-conversion.ts precisely so they cannot disagree. That value is
 * modeled rather than charged, which is safe here only because it rides on its
 * own event name and can never be added into Purchase revenue.
 */
export function metaTrack(
  event: MetaStandardEvent,
  options?: { eventId?: string; customData?: Record<string, unknown> },
): void {
  if (!META_PIXEL_ID) return
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return

  window.fbq(
    'track',
    event,
    options?.customData ?? {},
    options?.eventId ? { eventID: options.eventId } : {},
  )
}

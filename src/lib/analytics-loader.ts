/**
 * When to fetch a third-party analytics SDK.
 *
 * Extracted from `lib/mixpanel.ts` when PostHog was added alongside it. The
 * timing below is the expensive part of that file — it was arrived at by
 * measuring, and it is wrong in a way that looks right, so the two SDKs share
 * one copy rather than drifting apart.
 *
 * Load the SDK once the page has finished the work the reader is waiting on.
 *
 * This used to be `requestIdleCallback` alone, and that is the wrong signal —
 * subtly, because it looks like exactly the right one. rIC measures MAIN
 * THREAD idleness, and during a data-bound page load the main thread is idle
 * *precisely because* it is waiting on the network. So it fired almost
 * immediately and put 312 kB of analytics on the wire in the middle of the
 * dashboard's own requests: measured at 1141ms, against a data window running
 * roughly 900ms to 3300ms. "Wait for idle" delivered the opposite of what it
 * promised.
 *
 * There is no browser API for "the network has gone quiet", so this waits for
 * `load` (the document's own subresources are done) and then a settle delay,
 * because the app's data fetches only START after hydration and are therefore
 * still in flight when `load` fires. rIC still gets the last word, bounded by
 * a timeout, so a genuinely busy main thread is not interrupted.
 *
 * Nothing is lost by waiting, as long as the caller queues and replays what
 * happened in the meantime. The one real cost is session recording, which
 * starts later and so misses the opening seconds of a visit.
 */

/**
 * How long after `load` to let the app's own data finish before fetching the
 * SDK. Measured on the dashboard (production build, 4 Mbps): `load` lands
 * ~1.1s in and the page's last data response ~3.3s, so this clears it.
 */
const SETTLE_AFTER_LOAD_MS = 2500

/** Upper bound on waiting for an idle frame once the settle delay is up. */
const IDLE_TIMEOUT_MS = 3000

export function schedulePostSettleLoad(run: () => void): void {
  if (typeof window === 'undefined') return

  const onIdle = () => {
    const ric = window.requestIdleCallback
    if (typeof ric === 'function') ric(run, { timeout: IDLE_TIMEOUT_MS })
    else run()
  }
  const afterLoad = () => window.setTimeout(onIdle, SETTLE_AFTER_LOAD_MS)

  // `load` has already fired on a client-side route change, and the listener
  // would then never run — analytics would be dead for the rest of the session.
  if (document.readyState === 'complete') afterLoad()
  else window.addEventListener('load', afterLoad, { once: true })
}

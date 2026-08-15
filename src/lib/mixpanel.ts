/**
 * Mixpanel Client Initialization
 * Handles Mixpanel SDK setup with production-only tracking
 */

// Type-only: `import type` is erased at build, so pulling the SDK's types here
// does not evaluate its module. The runtime import is deliberately deferred —
// see `loadMixpanel()` below.
import { type Mixpanel } from 'mixpanel-browser'
import { ensureSafeStorage } from '@/lib/safe-storage'

let mixpanelInstance: Mixpanel | null = null
let isInitialized = false
/** No token, or the SDK failed to load — nothing will ever arrive. */
let isDisabled = false

/**
 * Calls made before the SDK finished loading, replayed once it has.
 *
 * Without this every event fired during the load window was dropped on the
 * floor: `isMixpanelEnabled()` reports the *instance*, and `analytics.ts`
 * returns early when there isn't one. That window used to be one dynamic
 * import; deferring the load to idle (see `initMixpanel`) makes it seconds,
 * and the events most worth having — the ones describing what someone did
 * when they first landed — are exactly the ones in it.
 *
 * Bounded, because a queue that only grows is a leak wearing an analytics
 * costume: if the SDK never arrives (blocked by an extension, offline) the
 * oldest calls are dropped rather than held forever.
 */
type PendingCall = (mixpanel: Mixpanel) => void
const pending: PendingCall[] = []
const MAX_PENDING = 50

/**
 * Initialize Mixpanel client
 * Only initializes in production environment
 *
 * `mixpanel-browser` reads `localStorage` while its module is evaluating, and
 * on iOS Safari with "Block All Cookies" that read throws SecurityError rather
 * than returning empty. As a static top-level import the throw happened during
 * hydration and escaped the try/catch below (which only ever covered `init()`),
 * so React tore down the tree and Next's root error boundary replaced the whole
 * page with "Application error: a client-side exception has occurred" — the
 * page painted, then blanked. Deferring the import until after
 * `ensureSafeStorage()` has run means the SDK only ever sees storage it can
 * use. It also moves ~320 kB of analytics out of the initial bundle.
 */
export function initMixpanel(): Mixpanel | null {
  // Prevent multiple initializations
  if (isInitialized) {
    return mixpanelInstance
  }

  // Only initialize in production
  // const isProduction = process.env.NODE_ENV === 'production'
  const token = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN

  // if (!isProduction) {
  //   console.log('[Mixpanel] Not initializing - not in production environment');
  //   isInitialized = true;
  //   return null;
  // }

  if (!token) {
    // A missing token is expected in local dev (no analytics key) — it's not
    // an error. console.error would trip Next.js's dev error overlay on every
    // page load; warn logs it without the intrusive panel.
    console.warn('[Mixpanel] Token not found - analytics disabled')
    isInitialized = true
    isDisabled = true
    return null
  }

  // Guarantee usable storage *before* the SDK is evaluated, not just before
  // init() is called: the module reads localStorage on the way in.
  ensureSafeStorage()

  isInitialized = true
  scheduleLoad(token)
  return mixpanelInstance
}

/**
 * How long after `load` to let the app's own data finish before fetching the
 * SDK. Measured on the dashboard (production build, 4 Mbps): `load` lands
 * ~1.1s in and the page's last data response ~3.3s, so this clears it.
 */
const SETTLE_AFTER_LOAD_MS = 2500

/** Upper bound on waiting for an idle frame once the settle delay is up. */
const IDLE_TIMEOUT_MS = 3000

/**
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
 * Nothing is lost by waiting: `withMixpanel` queues calls and `loadMixpanel`
 * replays them in order. The one real cost is session recording, which starts
 * later and so misses the opening seconds of a visit.
 */
function scheduleLoad(token: string): void {
  if (typeof window === 'undefined') return
  const run = () => void loadMixpanel(token)

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

/**
 * Import and start the SDK, then replay anything that happened while waiting.
 *
 * Kept async so the storage guard above is unconditionally in place first.
 */
async function loadMixpanel(token: string): Promise<void> {
  try {
    const mixpanel = (await import('mixpanel-browser')).default

    mixpanel.init(token, {
      debug: false,
      track_pageview: false, // We'll handle page views manually
      persistence: 'localStorage',
      ignore_dnt: false, // Respect Do Not Track
      api_host: 'https://api.mixpanel.com',
      record_sessions_percent: 100,
      loaded: () => {
        console.log('[Mixpanel] Initialized successfully')
      },
    })

    mixpanelInstance = mixpanel

    // Replay in the order they were made — `alias` before `identify` before
    // the events that depend on them, exactly as the callers wrote them.
    const queued = pending.splice(0, pending.length)
    for (const call of queued) {
      try {
        call(mixpanel)
      } catch (error) {
        console.error('[Mixpanel] Replay error:', error)
      }
    }
  } catch (error) {
    console.error('[Mixpanel] Initialization error:', error)
    mixpanelInstance = null
    isDisabled = true
    pending.length = 0
  }
}

/**
 * Run `fn` against the SDK — now if it is here, on arrival if it is not.
 *
 * The one entry point `analytics.ts` should use. Reaching for `getMixpanel()`
 * and bailing on null is what silently lost the early events.
 */
export function withMixpanel(fn: PendingCall): void {
  if (mixpanelInstance) {
    fn(mixpanelInstance)
    return
  }
  if (isDisabled) return
  // First caller starts the load; the rest queue behind it.
  if (!isInitialized) initMixpanel()
  if (isDisabled) return
  if (pending.length >= MAX_PENDING) pending.shift()
  pending.push(fn)
}

/**
 * Get the initialized Mixpanel instance
 */
export function getMixpanel(): Mixpanel | null {
  if (!isInitialized) {
    return initMixpanel()
  }
  return mixpanelInstance
}

/**
 * Is analytics on at all? Note this is NOT "has the SDK loaded" — it answers
 * whether events are worth making, and a call made before the SDK lands is
 * queued rather than lost. Basing it on the instance is what made the load
 * window a dead zone.
 */
export function isMixpanelEnabled(): boolean {
  if (!isInitialized) initMixpanel()
  return !isDisabled
}

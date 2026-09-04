/**
 * Mixpanel Client Initialization
 * Handles Mixpanel SDK setup with production-only tracking
 */

// Type-only: `import type` is erased at build, so pulling the SDK's types here
// does not evaluate its module. The runtime import is deliberately deferred —
// see `loadMixpanel()` below.
import { type Mixpanel } from 'mixpanel-browser'
import { ensureSafeStorage } from '@/lib/safe-storage'
import { schedulePostSettleLoad } from '@/lib/analytics-loader'

/**
 * Own-origin path that next.config.ts forwards to api.mixpanel.com (and
 * `/libs/` beneath it to cdn.mxpnl.com). Relative on purpose: the SDK resolves
 * it against the page, so preview deploys proxy through themselves.
 */
const INGEST_PATH = '/mp'

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
  // Deferred, not immediate. See `schedulePostSettleLoad` for why `load` plus a
  // settle delay is the signal here and `requestIdleCallback` alone is not.
  schedulePostSettleLoad(() => void loadMixpanel(token))
  return mixpanelInstance
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
      // Page views on every history change, as `$mp_web_page_view` with the
      // path and query string. This was `false` with a note that page views
      // would be handled by hand, and nothing ever did: for the life of the
      // project Mixpanel had every wall and sign-in but no record of anyone
      // arriving anywhere, so no funnel could start at a page. The query
      // string is kept on purpose. `?loc=`, `?ad=`, `?via=` and the LP
      // parameters are how a visit says where it came from.
      track_pageview: 'url-with-path-and-query-string',
      persistence: 'localStorage',
      ignore_dnt: false, // Respect Do Not Track
      // Same reverse proxy as PostHog's /ingest (see next.config.ts). Posting
      // straight to api.mixpanel.com is blocked by the common filter lists,
      // and the loss lands on the ad-blocking end of the audience, so the rows
      // that went missing were systematically the wrong rows to lose.
      api_host: INGEST_PATH,
      // The session-replay recorder is a second script the SDK fetches lazily
      // from cdn.mxpnl.com, and it is on the same lists. Served through the
      // proxy too, or replay works exactly where events already did. The
      // option is real in 2.71 (its default is the cdn.mxpnl.com URL) but
      // missing from the SDK's own typings, hence the cast.
      ...({ recorder_src: `${INGEST_PATH}/libs/mixpanel-recorder.min.js` } as object),
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

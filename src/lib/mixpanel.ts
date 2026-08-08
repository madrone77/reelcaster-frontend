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
    return null
  }

  // Guarantee usable storage *before* the SDK is evaluated, not just before
  // init() is called: the module reads localStorage on the way in.
  ensureSafeStorage()

  isInitialized = true
  void loadMixpanel(token)
  return mixpanelInstance
}

/**
 * Import and start the SDK.
 *
 * Kept async so the storage guard above is unconditionally in place first. The
 * gap is one already-bundled dynamic chunk, during which `getMixpanel()`
 * returns null and `analytics.ts` no-ops — the same thing it does when the
 * token is missing.
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
  } catch (error) {
    console.error('[Mixpanel] Initialization error:', error)
    mixpanelInstance = null
  }
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
 * Check if Mixpanel is enabled (production + token exists)
 */
export function isMixpanelEnabled(): boolean {
  return mixpanelInstance !== null
}

/**
 * Mixpanel Client Initialization
 * Handles Mixpanel SDK setup with production-only tracking
 */

import mixpanel, { type Mixpanel } from 'mixpanel-browser'

let mixpanelInstance: Mixpanel | null = null
let isInitialized = false

/**
 * Initialize Mixpanel client
 * Only initializes in production environment
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

  try {
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
    isInitialized = true

    return mixpanelInstance
  } catch (error) {
    console.error('[Mixpanel] Initialization error:', error)
    isInitialized = true
    return null
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

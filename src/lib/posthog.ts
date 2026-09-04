/**
 * PostHog Client Initialization
 *
 * Deliberately a structural twin of `lib/mixpanel.ts`: same deferred import,
 * same bounded replay queue, same load scheduling. Both SDKs hit the same two
 * hazards, so both are held at arm's length the same way.
 *
 * PostHog runs *alongside* Mixpanel rather than replacing it. Historical data
 * does not migrate between the two, so the only way to end up with usable
 * PostHog history is to start writing it now and leave Mixpanel alone until
 * that history is long enough to answer a question.
 */

// Type-only: `import type` is erased at build, so pulling the SDK's types here
// does not evaluate its module. The runtime import is deferred, exactly as in
// lib/mixpanel.ts and for the same two reasons.
import type { PostHog } from 'posthog-js'
import { ensureSafeStorage } from '@/lib/safe-storage'
import { schedulePostSettleLoad } from '@/lib/analytics-loader'

let posthogInstance: PostHog | null = null
let isInitialized = false
/** No key, or the SDK failed to load. Nothing will ever arrive. */
let isDisabled = false

/**
 * Calls made before the SDK finished loading, replayed once it has.
 *
 * Same contract as the Mixpanel queue: without it, every event fired during
 * the load window is dropped, and the load window is seconds long by design.
 * The events most worth having are the ones describing what someone did when
 * they first landed, which is exactly the window this covers.
 *
 * Bounded, so a blocked or offline SDK cannot turn the queue into a leak.
 */
type PendingCall = (posthog: PostHog) => void
const pending: PendingCall[] = []
const MAX_PENDING = 50

/**
 * Where the browser sends events.
 *
 * This is a same-origin path, not PostHog's host, and that is the point. Any
 * request to a known analytics domain is blocked outright by the common filter
 * lists, and that loss is not random: it skews toward exactly the technical,
 * ad-blocking audience whose behaviour you most want to read. Routing through
 * our own origin means the history being accumulated here does not have that
 * hole punched in it from day one.
 *
 * The rewrite that terminates this path lives in next.config.ts, and
 * /ingest is excluded from the middleware matcher so these requests do not pay
 * for an edge invocation on the way through.
 */
const INGEST_PATH = '/ingest'

/**
 * The real PostHog app origin.
 *
 * Required whenever api_host is a proxy: the SDK uses it to build links back
 * into PostHog (toolbar, replay deep links). Without it those links point at
 * reelcaster.com/ingest, which serves no UI.
 */
const UI_HOST = 'https://us.posthog.com'

/**
 * Initialize the PostHog client.
 *
 * Mirrors initMixpanel: a missing key is the expected state in local dev, not
 * an error, and it disables the sink rather than throwing.
 */
export function initPostHog(): PostHog | null {
  if (isInitialized) {
    return posthogInstance
  }

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY

  if (!key) {
    // warn, not error: console.error trips Next's dev error overlay on every
    // page load, and "no analytics key locally" is the normal case.
    console.warn('[PostHog] Key not found - analytics disabled')
    isInitialized = true
    isDisabled = true
    return null
  }

  // Before the SDK is evaluated, not merely before init() is called. posthog-js
  // reads web storage on the way in, and on iOS Safari with "Block All Cookies"
  // that read throws SecurityError rather than returning empty. As a static
  // top-level import the throw lands during hydration, escapes any try/catch
  // around init(), and Next's root error boundary replaces the painted page
  // with "Application error: a client-side exception has occurred". That is a
  // bug this codebase has already shipped once, via mixpanel-browser.
  ensureSafeStorage()

  isInitialized = true
  schedulePostSettleLoad(() => void loadPostHog(key))
  return posthogInstance
}

/**
 * Import and start the SDK, then replay anything that happened while waiting.
 *
 * Kept async so the storage guard above is unconditionally in place first.
 */
async function loadPostHog(key: string): Promise<void> {
  try {
    const posthog = (await import('posthog-js')).default

    posthog.init(key, {
      // Pin the behaviour snapshot. Left unset, the SDK warns and silently
      // takes whatever the defaults happen to be at the version installed,
      // which makes an npm bump a behaviour change.
      defaults: '2026-08-30',

      api_host: INGEST_PATH,
      ui_host: UI_HOST,

      // Mixpanel now tracks history-change page views too (see mixpanel.ts),
      // but no autocapture. PostHog gets the fuller treatment on purpose:
      // history_change pageviews and autocapture are the reason to run it at
      // all. They are what makes paths, retention and funnels answerable
      // without going back and instrumenting a call site for every question,
      // which is the specific failure mode this stack already has.
      capture_pageview: 'history_change',
      capture_pageleave: true,
      autocapture: true,

      // The default, set explicitly so it survives a defaults bump. Anonymous
      // visitors still emit events and still flow through funnels; they just do
      // not each mint a person profile. identify() at sign-in backfills the
      // link from the anonymous id.
      person_profiles: 'identified_only',

      persistence: 'localStorage',
      respect_dnt: true,

      // Session recording is the one thing Mixpanel is actually being used for
      // today, so PostHog's has to be on for the two to be comparable. Note
      // that this means two DOM recorders are running: see the note in the PR.
      disable_session_recording: false,

      loaded: () => {
        console.log('[PostHog] Initialized successfully')
      },
    })

    posthogInstance = posthog

    // Replay in the order they were made, so identify lands before the events
    // that depend on it, exactly as the callers wrote them.
    const queued = pending.splice(0, pending.length)
    for (const call of queued) {
      try {
        call(posthog)
      } catch (error) {
        console.error('[PostHog] Replay error:', error)
      }
    }
  } catch (error) {
    console.error('[PostHog] Initialization error:', error)
    posthogInstance = null
    isDisabled = true
    pending.length = 0
  }
}

/**
 * Run `fn` against the SDK: now if it is here, on arrival if it is not.
 *
 * The one entry point `analytics.ts` should use.
 */
export function withPostHog(fn: PendingCall): void {
  if (posthogInstance) {
    fn(posthogInstance)
    return
  }
  if (isDisabled) return
  // First caller starts the load; the rest queue behind it.
  if (!isInitialized) initPostHog()
  if (isDisabled) return
  if (pending.length >= MAX_PENDING) pending.shift()
  pending.push(fn)
}

/** The initialized PostHog instance, or null if it has not arrived yet. */
export function getPostHog(): PostHog | null {
  if (!isInitialized) {
    return initPostHog()
  }
  return posthogInstance
}

/**
 * Is this sink on at all? NOT "has the SDK loaded": a call made before the SDK
 * lands is queued rather than lost, so this answers whether events are worth
 * making.
 */
export function isPostHogEnabled(): boolean {
  if (!isInitialized) initPostHog()
  return !isDisabled
}

/**
 * Analytics Helper Functions
 *
 * The single fan-out point for tracking. Every call site in the app goes
 * through these wrappers, which is why adding a second analytics vendor is a
 * change to this file and its two sinks rather than to 14 components.
 *
 * Two sinks run at once, deliberately:
 *
 *   Mixpanel  the incumbent, and the only place the last year of history
 *             lives. Nothing about it changes here.
 *   PostHog   new, and empty. It only ever becomes useful by accumulating,
 *             so it starts accumulating now.
 *
 * Both are sent the same event names and the same properties, so the two are
 * directly comparable while the second one fills up. Neither is authoritative
 * yet; that is a decision to make once PostHog has history to judge.
 *
 * Where the two SDKs disagree on semantics, the difference is handled here and
 * commented at the call. Nothing is invented to paper over a gap: a concept one
 * vendor does not have is simply not sent to it.
 */

import { isMixpanelEnabled, withMixpanel } from './mixpanel';
import { isPostHogEnabled, withPostHog } from './posthog';
import { readEntry, readPaid } from './attribution';
import type { AnalyticsEventName, UserProperties } from '@/types/analytics';

/**
 * Is any sink live?
 *
 * This used to be `isMixpanelEnabled()` at the top of every export, which was
 * correct while Mixpanel was the only vendor and became a trap the moment it
 * was not: an environment with a PostHog key and no Mixpanel token would have
 * short-circuited every function below and sent nothing anywhere, silently.
 * The individual `withX` helpers already no-op when their own sink is off, so
 * this only has to answer whether the event is worth building at all.
 */
function isAnalyticsEnabled(): boolean {
  return isMixpanelEnabled() || isPostHogEnabled();
}

/**
 * Mixpanel's reserved person properties, renamed to PostHog's.
 *
 * `$email` and `$created` are special to Mixpanel and meaningless to PostHog,
 * which would file them as two ordinary properties with confusing names and
 * then show a person with no email on their profile. Everything else is
 * vendor-neutral and passes through untouched.
 */
function toPersonProperties(properties: UserProperties): Record<string, unknown> {
  const { $email, $created, ...rest } = properties;
  return {
    ...rest,
    ...($email ? { email: $email } : {}),
    ...($created ? { created_at: $created } : {}),
  };
}

/**
 * Track an analytics event
 * @param eventName - The name of the event
 * @param properties - Event properties (optional)
 */
export function trackEvent<T extends Record<string, unknown>>(
  eventName: AnalyticsEventName,
  properties?: T
): void {
  if (!isAnalyticsEnabled()) {
    // In development, log to console for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics]', eventName, properties);
    }
    return;
  }

  // Add timestamp at CALL time, not at send time: a queued event describes
  // the moment it happened, not the moment the SDK finished loading.
  const eventProperties = {
    ...properties,
    timestamp: new Date().toISOString(),
  };

  withMixpanel((mixpanel) => {
    try {
      mixpanel.track(eventName, eventProperties);
    } catch (error) {
      console.error('[Analytics] Track error:', error);
    }
  });

  withPostHog((posthog) => {
    try {
      posthog.capture(eventName, eventProperties);
    } catch (error) {
      console.error('[Analytics] PostHog capture error:', error);
    }
  });
}

/**
 * Identify a user
 * @param userId - The unique user ID
 * @param properties - User properties (optional)
 */
export function identifyUser(
  userId: string,
  properties?: UserProperties
): void {
  if (!isAnalyticsEnabled()) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics] Identify:', userId, properties);
    }
    return;
  }

  withMixpanel((mixpanel) => {
    try {
      mixpanel.identify(userId);
    } catch (error) {
      console.error('[Analytics] Identify error:', error);
    }
  });

  // PostHog takes the person properties on identify itself. It is also the
  // call that stitches this user to everything they did anonymously before
  // signing in, which is what makes an anonymous-to-paid funnel answerable.
  withPostHog((posthog) => {
    try {
      posthog.identify(userId, properties ? toPersonProperties(properties) : undefined);
    } catch (error) {
      console.error('[Analytics] PostHog identify error:', error);
    }
  });

  if (properties) setUserProperties(properties);
}

/**
 * Alias a user (used when converting anonymous user to authenticated)
 * @param userId - The authenticated user ID
 *
 * Mixpanel only, on purpose. Mixpanel needs an explicit alias to merge the
 * anonymous profile into the authenticated one. PostHog does that merge inside
 * identify(), and its own alias() is for a different job: giving one already
 * identified person a second id. Calling it here would create a second
 * identity for a user who already has one, so the correct PostHog behaviour is
 * to do nothing and let the identify() that follows this call do the work.
 */
export function aliasUser(userId: string): void {
  if (!isMixpanelEnabled()) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics] Alias:', userId);
    }
    return;
  }

  withMixpanel((mixpanel) => {
    try {
      mixpanel.alias(userId);
    } catch (error) {
      console.error('[Analytics] Alias error:', error);
    }
  });
}

/**
 * Set user properties
 * @param properties - User properties to set
 */
export function setUserProperties(properties: UserProperties): void {
  if (!isAnalyticsEnabled()) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics] Set user properties:', properties);
    }
    return;
  }

  withMixpanel((mixpanel) => {
    try {
      mixpanel.people.set(properties);
    } catch (error) {
      console.error('[Analytics] Set user properties error:', error);
    }
  });

  withPostHog((posthog) => {
    try {
      posthog.setPersonProperties(toPersonProperties(properties));
    } catch (error) {
      console.error('[Analytics] PostHog person properties error:', error);
    }
  });
}

/**
 * Increment a user property
 * @param property - The property to increment
 * @param by - The amount to increment by (default: 1)
 *
 * Mixpanel only. PostHog has no server-side increment: person properties are
 * set, not accumulated, so the equivalent is a counted event and a query over
 * it rather than a running total on the profile. Nothing calls this today, so
 * there is no gap to fill; if something starts to, capture an event instead of
 * reaching for a PostHog increment that does not exist.
 */
export function incrementUserProperty(property: string, by: number = 1): void {
  if (!isMixpanelEnabled()) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics] Increment:', property, 'by', by);
    }
    return;
  }

  withMixpanel((mixpanel) => {
    try {
      mixpanel.people.increment(property, by);
    } catch (error) {
      console.error('[Analytics] Increment error:', error);
    }
  });
}

/**
 * Reset analytics (used on logout)
 */
export function resetAnalytics(): void {
  if (!isAnalyticsEnabled()) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics] Reset');
    }
    return;
  }

  withMixpanel((mixpanel) => {
    try {
      mixpanel.reset();
    } catch (error) {
      console.error('[Analytics] Reset error:', error);
    }
  });

  // Sign-out has to clear both, or the next person on this browser inherits
  // the previous one's distinct id in whichever sink was missed.
  withPostHog((posthog) => {
    try {
      posthog.reset();
    } catch (error) {
      console.error('[Analytics] PostHog reset error:', error);
    }
  });
}

/**
 * Track page load time
 * @param page - The page name
 * @param loadTime - Load time in milliseconds
 */
export function trackPageLoadTime(page: string, loadTime: number): void {
  trackEvent('Page Load Time', {
    page,
    loadTime,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Track API call performance
 * @param endpoint - API endpoint name
 * @param duration - Call duration in milliseconds
 * @param success - Whether the call succeeded
 * @param error - Error message if failed
 */
export function trackApiCall(
  endpoint: string,
  duration: number,
  success: boolean,
  error?: string
): void {
  trackEvent('API Call', {
    endpoint,
    duration,
    success,
    error,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Track an error
 * @param errorType - Type of error
 * @param errorMessage - Error message
 * @param component - Component where error occurred
 */
export function trackError(
  errorType: string,
  errorMessage: string,
  component?: string
): void {
  trackEvent('Error', {
    errorType,
    errorMessage,
    component,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Stamp acquisition context onto every event this session will ever send.
 *
 * Super properties are the cheap half of campaign reporting: the app already
 * emits a good event stream, and registering these makes every one of those
 * events answerable by campaign without touching a single call site.
 *
 * Two registration modes, matching the two attribution models in
 * src/lib/attribution.ts:
 *
 *   first_*  register_once — first touch, never overwritten, same contract as
 *            the write-once rc_entry cookie it is read from.
 *   paid_*   register — last paid touch wins, because the point of that record
 *            is that the newest bought click is the one that closed the sale.
 *
 * What is deliberately NOT registered: the click id itself. gclid and fbclid
 * are network-issued identifiers for a person, and the only thing that needs
 * them is the server-side conversion upload. `*_click_type` says which network
 * sold us the click, which is all the segmentation here needs and carries no
 * identifier. Sending the id to a third-party analytics vendor would widen the
 * blast radius of this data for no reporting gain.
 *
 * Safe to call on every navigation: it reads cookies and re-registers the same
 * values, and `register_once` ignores the repeats.
 */
export function registerAcquisition(): void {
  if (!isAnalyticsEnabled()) return;

  const entry = readEntry();
  const paid = readPaid();
  if (!entry && !paid) return;

  const first: Record<string, string> = {};
  if (entry) {
    put(first, 'first_utm_source', entry.utm_source);
    put(first, 'first_utm_medium', entry.utm_medium);
    put(first, 'first_utm_campaign', entry.utm_campaign);
    put(first, 'first_utm_content', entry.utm_content);
    put(first, 'first_utm_term', entry.utm_term);
    put(first, 'first_click_type', entry.click_type);
    put(first, 'first_entry_path', entry.entry_path);
    put(first, 'first_referrer', entry.referrer);
    for (const [key, value] of Object.entries(entry.params ?? {})) {
      put(first, `first_${key}`, value);
    }
  }

  const last: Record<string, string> = {};
  if (paid) {
    put(last, 'paid_utm_source', paid.utm_source);
    put(last, 'paid_utm_medium', paid.utm_medium);
    put(last, 'paid_utm_campaign', paid.utm_campaign);
    put(last, 'paid_utm_content', paid.utm_content);
    put(last, 'paid_utm_term', paid.utm_term);
    put(last, 'paid_click_type', paid.click_type);
    put(last, 'paid_landing_path', paid.landing_path);
    put(last, 'paid_at', paid.ts);
    for (const [key, value] of Object.entries(paid.params ?? {})) {
      put(last, `paid_${key}`, value);
    }
  }

  withMixpanel((mixpanel) => {
    try {
      if (Object.keys(first).length > 0) mixpanel.register_once(first);
      if (Object.keys(last).length > 0) mixpanel.register(last);
    } catch (error) {
      console.error('[Analytics] Acquisition register error:', error);
    }
  });

  // Same two modes in PostHog, same names. Super properties are what make every
  // event answerable by campaign without touching a call site, and that is the
  // half of campaign reporting worth having in both tools from the start.
  withPostHog((posthog) => {
    try {
      if (Object.keys(first).length > 0) posthog.register_once(first);
      if (Object.keys(last).length > 0) posthog.register(last);
    } catch (error) {
      console.error('[Analytics] PostHog acquisition register error:', error);
    }
  });
}

/** Skip empties, so an untagged visit does not fill either tool with blank rows. */
function put(target: Record<string, string>, key: string, value: string): void {
  if (value) target[key] = value;
}

/**
 * Stamp the viewer's plan on every event from now on, and on the profile.
 *
 * `viewer_tier` is a super property because the question it answers ("do
 * free accounts do this?") is asked of every event, not of a few. It is
 * `register`, not `register_once`: a trial that lapses changes the answer and
 * the next event must say so. The person properties carry the finer grain the
 * profile page wants and a cohort can filter on.
 *
 * Call it only once auth and the subscription row have BOTH settled; before
 * that the hook reports the free default and would label a Pro member wrong.
 */
export function registerViewerContext(properties: UserProperties & { viewer_tier: 'anon' | 'free' | 'pro' }): void {
  if (!isAnalyticsEnabled()) return;

  withMixpanel((mixpanel) => {
    try {
      mixpanel.register({ viewer_tier: properties.viewer_tier });
    } catch (error) {
      console.error('[Analytics] Viewer register error:', error);
    }
  });
  withPostHog((posthog) => {
    try {
      posthog.register({ viewer_tier: properties.viewer_tier });
    } catch (error) {
      console.error('[Analytics] PostHog viewer register error:', error);
    }
  });

  // Anonymous visitors have no profile to write to; the super property is
  // the whole record for them.
  if (properties.viewer_tier !== 'anon') setUserProperties(properties);
}

/**
 * Switch tracking off (or back on) for a browser that belongs to the team.
 *
 * Both SDKs persist the choice themselves, so it holds across page loads
 * without this being called again. Opting back in matters for the shared
 * laptop case: a customer signing in where a team member had been must not
 * inherit the silence.
 */
export function setInternalTraffic(internal: boolean): void {
  withMixpanel((mixpanel) => {
    try {
      const out = mixpanel.has_opted_out_tracking();
      if (internal && !out) mixpanel.opt_out_tracking();
      else if (!internal && out) mixpanel.opt_in_tracking();
    } catch (error) {
      console.error('[Analytics] Opt-out error:', error);
    }
  });
  withPostHog((posthog) => {
    try {
      const out = posthog.has_opted_out_capturing();
      if (internal && !out) posthog.opt_out_capturing();
      else if (!internal && out) posthog.opt_in_capturing();
    } catch (error) {
      console.error('[Analytics] PostHog opt-out error:', error);
    }
  });
}

/**
 * Analytics Helper Functions
 * Wrapper functions for type-safe Mixpanel tracking
 */

import { isMixpanelEnabled, withMixpanel } from './mixpanel';
import { readEntry, readPaid } from './attribution';
import type { AnalyticsEventName, UserProperties } from '@/types/analytics';

/**
 * Track an analytics event
 * @param eventName - The name of the event
 * @param properties - Event properties (optional)
 */
export function trackEvent<T extends Record<string, unknown>>(
  eventName: AnalyticsEventName,
  properties?: T
): void {
  if (!isMixpanelEnabled()) {
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
}

/**
 * Identify a user with Mixpanel
 * @param userId - The unique user ID
 * @param properties - User properties (optional)
 */
export function identifyUser(
  userId: string,
  properties?: UserProperties
): void {
  if (!isMixpanelEnabled()) {
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

  if (properties) setUserProperties(properties);
}

/**
 * Alias a user (used when converting anonymous user to authenticated)
 * @param userId - The authenticated user ID
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
  if (!isMixpanelEnabled()) {
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
}

/**
 * Increment a user property
 * @param property - The property to increment
 * @param by - The amount to increment by (default: 1)
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
  if (!isMixpanelEnabled()) {
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
  if (!isMixpanelEnabled()) return;

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
}

/** Skip empties, so an untagged visit does not fill Mixpanel with blank rows. */
function put(target: Record<string, string>, key: string, value: string): void {
  if (value) target[key] = value;
}

/**
 * Mixpanel from the server, for the events no browser is present for.
 *
 * The client facade (src/lib/analytics.ts) covers everything a person does
 * on a page. A referral pays the SPONSOR a month while the sponsor is asleep
 * and the friend is the one in a browser, so "Referral Month Earned" has
 * nowhere to fire but here. Same project token, same event vocabulary, and
 * `distinct_id` is the Supabase user id the browser SDK identifies with, so
 * the server event lands on the same person as everything they clicked.
 *
 * Fire and forget. A lost event is a lost event; a slow Mixpanel must never
 * hold a signup route, so the request has a short deadline and every failure
 * ends in a console line. Without a token (local dev) it logs and returns.
 *
 * Mixpanel only: PostHog's server ingest is a different key and a different
 * question, and the events this sends are the ones Casey reads in Mixpanel.
 */

import { randomUUID } from 'node:crypto';
import type { AnalyticsEventName } from '@/types/analytics';

const TRACK_URL = 'https://api.mixpanel.com/track';
const DEADLINE_MS = 3000;

export async function trackServerEvent(
  eventName: AnalyticsEventName,
  distinctId: string,
  properties: Record<string, unknown> = {},
): Promise<void> {
  const token = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;
  if (!token) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics/server]', eventName, distinctId, properties);
    }
    return;
  }

  const payload = [
    {
      event: eventName,
      properties: {
        ...properties,
        token,
        distinct_id: distinctId,
        time: Date.now(),
        // Lets Mixpanel drop a retry rather than count it twice.
        $insert_id: randomUUID(),
        source: 'server',
        timestamp: new Date().toISOString(),
      },
    },
  ];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEADLINE_MS);
  try {
    const res = await fetch(TRACK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/plain' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn('[Analytics/server] track rejected', eventName, res.status);
    }
  } catch (err) {
    console.warn('[Analytics/server] track failed', eventName, err);
  } finally {
    clearTimeout(timer);
  }
}

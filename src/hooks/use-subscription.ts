'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { writeAuthCookie } from '@/lib/auth-cookie';
import { entitlementFromSettings } from '@/lib/entitlement';

export type SubscriptionTier = 'free' | 'pro_monthly' | 'pro_annual';
export type SubscriptionStatus =
  | 'none'
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'unpaid';

export interface SubscriptionState {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  isPaid: boolean;
  loading: boolean;
  periodEnd: string | null;
  stripeCustomerId: string | null;
  phoneE164: string | null;
  phoneVerified: boolean;
  /** In-app asks this account has said no to, keyed by surface. See src/lib/referral-nag.ts. */
  dismissedNags: Record<string, string>;
  refresh: () => void;
}

/** The settings themselves, without the hook-shaped fields. */
type Settings = Omit<SubscriptionState, 'loading' | 'refresh'>;

const FREE: Settings = {
  tier: 'free',
  status: 'none',
  isPaid: false,
  periodEnd: null,
  stripeCustomerId: null,
  phoneE164: null,
  phoneVerified: false,
  dismissedNags: {},
};

// grace_until and trial_ends_at feed entitlementFromSettings, so the client
// and the server gates agree on who is Pro (a payment in its grace week is).
const COLUMNS =
  'subscription_tier,subscription_status,subscription_period_end,grace_until,trial_ends_at,stripe_customer_id,phone_e164,phone_verified,dismissed_nags';

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pehcvwiwtubzfgahuzuz.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * ── One fetch per user, shared by every consumer ──────────────────────────
 *
 * This hook is called from list-item components — `SpotCard` renders once per
 * spot, in both the desktop rail and the mobile list. On /explore that is ~140
 * instances, and an unshared per-instance fetch meant ~140 identical
 * `user_settings` requests in a single commit. Browsers cap concurrent
 * connections per origin at 6, so they queued: the last one landed ~9s after
 * page load.
 *
 * That queue was also ordered against us. React runs child effects before
 * parent effects, so the *shell's* instance — the one that decides `accessTier`
 * for the 14-day forecast strip — was fired last and resolved last. Until it
 * did, `isPaid` was still its initial `false`, and a paying Pro account was
 * rendered as a free one: days 8–14 locked behind an upgrade CTA for the better
 * part of ten seconds.
 *
 * So this store is not a nice-to-have. Deduping to one in-flight request per
 * user is what makes the tier correct, not just cheap. It's an external store
 * read through `useSyncExternalStore` rather than mirrored into each caller's
 * local state, so all ~140 consumers resolve to the same answer in the same
 * commit — no torn reads, which is the failure mode we're here to remove.
 */

/** Replaced wholesale on every change, so identity doubles as the version. */
type Snapshot = { userId: string | null; settings: Settings | null };

const SIGNED_OUT: Snapshot = { userId: null, settings: FREE };

let snapshot: Snapshot = SIGNED_OUT;
let inFlight = false;

const listeners = new Set<() => void>();

function emit(next: Snapshot): void {
  snapshot = next;
  for (const cb of listeners) cb();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

const getSnapshot = (): Snapshot => snapshot;
/** SSR has no session; the client corrects this on hydration. */
const getServerSnapshot = (): Snapshot => SIGNED_OUT;

/**
 * How long one settings read may take before it counts as failed. The read
 * is a plain fetch carrying the session's access token, NOT a call through
 * the auth client: that client takes the auth Web Lock for its token, and on
 * Chrome Android the lock can sit with a frozen tab (supabase/supabase-js#2013).
 */
const ATTEMPT_DEADLINE_MS = 6000;

/** Waits between attempts. The tier stays loading through all of them. */
const RETRY_DELAYS_MS = [1000, 3000, 8000];

/**
 * The newest access token the auth context has handed us. Read at the moment
 * of each attempt, so a retry after a TOKEN_REFRESHED uses the fresh one.
 */
let accessToken: string | null = null;

/**
 * The user whose last load ran out of retries and settled on free. A later
 * mount, focus or reconnect tries again for them, so one bad read no longer
 * paints a paying reader as free for the rest of the visit.
 */
let failedFor: string | null = null;

type Row = {
  subscription_tier: string | null;
  subscription_status: string | null;
  subscription_period_end: string | null;
  grace_until: string | null;
  trial_ends_at: string | null;
  stripe_customer_id: string | null;
  phone_e164: string | null;
  phone_verified: boolean | null;
  dismissed_nags: unknown;
};

/** One read. Resolves to the row, null for "no row", or throws. */
async function readRow(userId: string): Promise<Row | null> {
  if (!accessToken) throw new Error('no access token yet');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ATTEMPT_DEADLINE_MS);
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/user_settings?select=${COLUMNS}&user_id=eq.${encodeURIComponent(userId)}`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
        cache: 'no-store',
        signal: controller.signal,
      },
    );
    if (!res.ok) throw new Error(`user_settings read ${res.status}`);
    const rows = (await res.json()) as Row[];
    return rows[0] ?? null;
  } finally {
    clearTimeout(timer);
  }
}

function settingsFromRow(row: Row | null): Settings {
  // No row is a real answer: an account that has never paid.
  if (!row) return FREE;
  const tier = (row.subscription_tier ?? 'free') as SubscriptionTier;
  const status = (row.subscription_status ?? 'none') as SubscriptionStatus;
  return {
    tier,
    status,
    // The same rule every server gate uses, so the page never draws a lock
    // over data the server has already handed this reader.
    isPaid: entitlementFromSettings(row).isPro,
    periodEnd: row.subscription_period_end ?? null,
    stripeCustomerId: row.stripe_customer_id ?? null,
    phoneE164: row.phone_e164 ?? null,
    phoneVerified: !!row.phone_verified,
    dismissedNags:
      row.dismissed_nags && typeof row.dismissed_nags === 'object'
        ? (row.dismissed_nags as Record<string, string>)
        : {},
  };
}

async function load(userId: string): Promise<void> {
  inFlight = true;
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        const row = await readRow(userId);
        // Someone switched accounts mid-flight: this answer is for a stale user.
        if (snapshot.userId !== userId) return;
        const settings = settingsFromRow(row);
        failedFor = null;
        // The page-view counter at the edge reads the tier off a cookie, and
        // this is the one place the tier is known. See src/lib/auth-cookie.ts.
        writeAuthCookie(settings.isPaid ? 'pro' : 'free');
        emit({ userId, settings });
        return;
      } catch {
        if (snapshot.userId !== userId) return;
        const delay = RETRY_DELAYS_MS[attempt];
        if (delay === undefined) break;
        await new Promise((r) => setTimeout(r, delay));
        if (snapshot.userId !== userId) return;
      }
    }
    // Out of retries. Settle on free so nothing waits forever, and remember
    // it so the next mount, focus or reconnect asks again.
    failedFor = userId;
    emit({ userId, settings: FREE });
  } finally {
    inFlight = false;
  }
}

/** Fetch once for `userId`; every other consumer rides that one request. */
function ensureLoaded(userId: string): void {
  if (inFlight && snapshot.userId === userId) return;
  if (snapshot.userId === userId && snapshot.settings !== null && failedFor !== userId) {
    return;
  }
  // A retry after a failed load keeps showing free rather than flipping every
  // consumer back to loading; a first load starts from loading.
  if (snapshot.userId !== userId || snapshot.settings === null) {
    emit({ userId, settings: null }); // loading
  }
  void load(userId);
}

if (typeof window !== 'undefined') {
  const retryFailed = () => {
    if (failedFor && failedFor === snapshot.userId) ensureLoaded(failedFor);
  };
  window.addEventListener('focus', retryFailed);
  window.addEventListener('online', retryFailed);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') retryFailed();
  });
}

/** Signed out (or never signed in) resolves to free without a request. */
function setSignedOut(): void {
  failedFor = null;
  if (snapshot.userId === null && snapshot.settings !== null) return;
  emit(SIGNED_OUT);
}

/**
 * Drop the cache and refetch for every mounted consumer. Called after checkout,
 * phone verification, and anything else that rewrites the row underneath us.
 */
export function refreshSubscription(): void {
  const { userId } = snapshot;
  if (!userId) return;
  emit({ userId, settings: null });
  void load(userId);
}

export function useSubscription(): SubscriptionState {
  const { user, session, loading: authLoading } = useAuth();
  const store = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    // Kept current on every session change so a retry reads the newest token.
    accessToken = session?.access_token ?? null;
    if (authLoading) return;
    if (user && session) ensureLoaded(user.id);
    else if (!user) setSignedOut();
  }, [user, session, authLoading]);

  // Loading until auth has resolved AND this user's row has landed. Comparing
  // against `user.id` matters on account switch: the previous user's settings
  // are still in the store for a tick, and reporting them would hand one
  // account another's tier.
  const settled =
    !authLoading &&
    (user
      ? store.userId === user.id && store.settings !== null
      : store.settings !== null);

  return {
    ...(settled ? (store.settings as Settings) : FREE),
    loading: !settled,
    refresh: refreshSubscription,
  };
}

'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';

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
};

const COLUMNS =
  'subscription_tier, subscription_status, subscription_period_end, stripe_customer_id, phone_e164, phone_verified';

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

async function load(userId: string): Promise<void> {
  inFlight = true;
  try {
    const { data, error } = await supabase
      .from('user_settings')
      .select(COLUMNS)
      .eq('user_id', userId)
      .maybeSingle();

    // Someone switched accounts mid-flight — this answer is for a stale user.
    if (snapshot.userId !== userId) return;

    if (error || !data) {
      emit({ userId, settings: FREE });
      return;
    }

    const tier = (data.subscription_tier ?? 'free') as SubscriptionTier;
    const status = (data.subscription_status ?? 'none') as SubscriptionStatus;

    emit({
      userId,
      settings: {
        tier,
        status,
        isPaid:
          (tier === 'pro_monthly' || tier === 'pro_annual') &&
          (status === 'active' || status === 'trialing'),
        periodEnd: data.subscription_period_end ?? null,
        stripeCustomerId: data.stripe_customer_id ?? null,
        phoneE164: data.phone_e164 ?? null,
        phoneVerified: !!data.phone_verified,
      },
    });
  } catch {
    if (snapshot.userId === userId) emit({ userId, settings: FREE });
  } finally {
    inFlight = false;
  }
}

/** Fetch once for `userId`; every other consumer rides that one request. */
function ensureLoaded(userId: string): void {
  if (snapshot.userId === userId && (snapshot.settings !== null || inFlight)) {
    return;
  }
  emit({ userId, settings: null }); // loading
  void load(userId);
}

/** Signed out (or never signed in) resolves to free without a request. */
function setSignedOut(): void {
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
  const { user, loading: authLoading } = useAuth();
  const store = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (authLoading) return;
    if (user) ensureLoaded(user.id);
    else setSignedOut();
  }, [user, authLoading]);

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

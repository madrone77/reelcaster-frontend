'use client';

import { useEffect, useState } from 'react';
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
}

const DEFAULT: SubscriptionState = {
  tier: 'free',
  status: 'none',
  isPaid: false,
  loading: true,
};

export function useSubscription(): SubscriptionState {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<SubscriptionState>(DEFAULT);

  useEffect(() => {
    let cancelled = false;

    if (authLoading) return;

    if (!user) {
      setState({ tier: 'free', status: 'none', isPaid: false, loading: false });
      return;
    }

    (async () => {
      const { data, error } = await supabase
        .from('user_settings')
        .select('subscription_tier, subscription_status')
        .eq('user_id', user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error || !data) {
        setState({ tier: 'free', status: 'none', isPaid: false, loading: false });
        return;
      }

      const tier = (data.subscription_tier ?? 'free') as SubscriptionTier;
      const status = (data.subscription_status ?? 'none') as SubscriptionStatus;
      const isPaid =
        (tier === 'pro_monthly' || tier === 'pro_annual') &&
        (status === 'active' || status === 'trialing');

      setState({ tier, status, isPaid, loading: false });
    })();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  return state;
}

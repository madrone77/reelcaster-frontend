'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';

/** What GET /api/referrals answers. Mirrors ReferralSummary in referrals-server.ts. */
export interface ReferralSummary {
  code: string;
  url: string;
  friends: number;
  monthsThisYear: number;
  cap: number;
  days: number;
}

/**
 * The signed-in account's share link and what it has earned.
 *
 * One fetch per account per mount, keyed on the user id rather than the user
 * object: the auth context hands out a fresh object on every token refresh
 * and each one re-minted the same summary. `enabled` lets a modal wait until
 * it is actually open, so a nag line that is never tapped costs no request.
 */
export function useReferralSummary(enabled = true): {
  summary: ReferralSummary | null;
  failed: boolean;
} {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [summary, setSummary] = useState<ReferralSummary | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!userId || !enabled || summary) return;
    let cancelled = false;
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) throw new Error('no session');
        const res = await fetch('/api/referrals', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as ReferralSummary;
        if (!cancelled) setSummary(body);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, enabled, summary]);

  return { summary, failed };
}

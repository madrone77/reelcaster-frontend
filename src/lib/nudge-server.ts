/**
 * Server side of the nudges: the caller's account from a bearer token, and
 * the service-role client every nudge route writes with.
 */

import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { classifyUserAgent } from '@/lib/device';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const nudgeAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function nudgeUserId(request: NextRequest): Promise<string | null> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const sb = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const {
    data: { user },
    error,
  } = await sb.auth.getUser(token);
  return error || !user ? null : user.id;
}

export function requestDevice(request: NextRequest): string {
  return classifyUserAgent(request.headers.get('user-agent')).device;
}

/**
 * Stamp `key` on the account's `user_settings.dismissed_nags`. Merges, so a
 * second nudge's no never erases the first's. Returns false on a failed write.
 */
export async function stampDismissedNag(userId: string, key: string): Promise<boolean> {
  // The row may not exist yet for a young account. DO NOTHING on conflict so
  // this can never blank a column another writer already filled in.
  const { error: ensureError } = await nudgeAdmin
    .from('user_settings')
    .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });
  if (ensureError) {
    console.error('[nudges] could not ensure user_settings row', ensureError);
    return false;
  }
  const { data: current } = await nudgeAdmin
    .from('user_settings')
    .select('dismissed_nags')
    .eq('user_id', userId)
    .maybeSingle();
  const merged = {
    ...((current?.dismissed_nags as Record<string, string> | null) ?? {}),
    [key]: new Date().toISOString(),
  };
  const { error } = await nudgeAdmin
    .from('user_settings')
    .update({ dismissed_nags: merged })
    .eq('user_id', userId);
  if (error) {
    console.error('[nudges] dismissed_nags write failed', error);
    return false;
  }
  return true;
}

/**
 * GET /api/stripe/checkout/free-account?t=<token>
 *
 * The button in arm b of the abandoned-checkout email ("Your free ReelCaster
 * account is ready"). Opening it makes a free account for the address the
 * token was issued to, if it has none, and signs the reader in with a
 * one-time Supabase magic link minted right here. No form, no card.
 *
 * Opening the link from the inbox is the proof of owning the address, the same
 * proof a magic link is, so the account is created confirmed. It is created on
 * the click rather than when the email is sent, so a mistyped or made-up
 * address never becomes an account.
 *
 * The sign-in is limited so an old or forwarded email does not stay a key:
 *   - only within SIGN_IN_WINDOW_MS of the email going out;
 *   - only for an account this link created. An address that made its own
 *     account some other way is sent to /login, like the resume link does.
 * Anything else lands on /login or /plans, pages that still work.
 *
 * The arm goes into the rc_split cookie, so a Pro trial started later from
 * this browser is counted for abandon_email_v1 arm b.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { appOrigin } from '@/lib/stripe';
import { findUserIdByEmail } from '@/lib/checkout-account';
import {
  ABANDON_EMAIL_TEST,
  CHECKOUT_REMINDER_TABLE,
  countReminderEvent,
} from '@/lib/checkout-reminder';
import {
  SPLIT_COOKIE,
  SPLIT_COOKIE_MAX_AGE,
  armsFromCookieHeader,
  serializeSplitArms,
} from '@/lib/split-tests';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const SIGN_IN_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const go = (path: string) => NextResponse.redirect(new URL(path, origin), 303);

  const token = request.nextUrl.searchParams.get('t')?.trim();
  if (!token || !/^[0-9a-f]{32}$/.test(token)) return go('/plans');

  const { data: row, error } = await admin
    .from(CHECKOUT_REMINDER_TABLE)
    .select('email, sent_at, clicked_at, variant, free_account_user_id')
    .eq('token', token)
    .maybeSingle();
  if (error || !row) return go('/plans');

  if (!row.clicked_at) {
    const { data: first } = await admin
      .from(CHECKOUT_REMINDER_TABLE)
      .update({ clicked_at: new Date().toISOString() })
      .eq('token', token)
      .is('clicked_at', null)
      .select('token');
    if (first?.length) await countReminderEvent(admin, { token, variant: row.variant }, 'cta_click');
  }

  if (!row.sent_at || Date.now() - new Date(row.sent_at).getTime() > SIGN_IN_WINDOW_MS) {
    return go('/login');
  }

  let userId: string | null = row.free_account_user_id;
  if (!userId) {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: row.email,
      email_confirm: true,
      user_metadata: { created_via: 'abandon_email' },
    });
    if (createError || !created?.user) {
      // Almost always: the address already has an account, made some other
      // way since the email went out. Not ours to sign in to.
      if (await findUserIdByEmail(admin, row.email)) return go('/login');
      console.error('[free account] could not create user', createError);
      return go('/plans');
    }
    userId = created.user.id;
    await admin
      .from('user_settings')
      .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });
    await admin
      .from(CHECKOUT_REMINDER_TABLE)
      .update({
        free_account_user_id: userId,
        free_account_at: new Date().toISOString(),
        signed_up_user_id: userId,
        signed_up_at: new Date().toISOString(),
      })
      .eq('token', token)
      .is('free_account_user_id', null);
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: row.email,
    options: { redirectTo: `${appOrigin(request)}/auth/callback?next=/explore` },
  });
  if (linkError || !link?.properties?.action_link) {
    console.error('[free account] could not mint sign-in link', linkError);
    return go('/login');
  }

  const response = NextResponse.redirect(link.properties.action_link, 303);
  if (row.variant) {
    const arms = {
      ...armsFromCookieHeader(request.headers.get('cookie')),
      [ABANDON_EMAIL_TEST]: row.variant,
    };
    response.cookies.set(SPLIT_COOKIE, serializeSplitArms(arms), {
      maxAge: SPLIT_COOKIE_MAX_AGE,
      path: '/',
      sameSite: 'lax',
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
    });
  }
  return response;
}

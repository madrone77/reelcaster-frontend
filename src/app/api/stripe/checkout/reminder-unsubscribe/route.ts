/**
 * GET /api/stripe/checkout/reminder-unsubscribe?t=<token>
 *
 * The unsubscribe link in the "almost done signing up" email. One click, no
 * sign-in (there is no account to sign in to), and it answers with a page
 * rather than a redirect, since the product has nothing else to show somebody
 * who never made an account.
 *
 * The email only ever goes out once per address, so this records the request
 * rather than stopping a sequence. The row is what any future email to people
 * without an account must check first.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { CHECKOUT_REMINDER_TABLE } from '@/lib/checkout-reminder';
import { siteUrl } from '@/lib/site';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const PAGE = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Unsubscribed | ReelCaster</title></head>
<body style="margin:0;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0F172A;">
<main style="max-width:480px;margin:80px auto;padding:0 24px;">
<h1 style="font-size:22px;margin:0 0 12px;">You're unsubscribed</h1>
<p style="font-size:15px;line-height:24px;color:#334155;margin:0 0 16px;">We won't email this address about your ReelCaster signup again.</p>
<p style="font-size:15px;line-height:24px;margin:0;"><a href="${siteUrl('/')}" style="color:#1E40E0;">Back to ReelCaster</a></p>
</main></body></html>`;

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('t')?.trim();
  if (token && /^[0-9a-f]{32}$/.test(token)) {
    const { error } = await admin
      .from(CHECKOUT_REMINDER_TABLE)
      .update({ unsubscribed_at: new Date().toISOString() })
      .eq('token', token)
      .is('unsubscribed_at', null);
    if (error) console.error('[checkout reminder] unsubscribe failed', error);
  }

  return new NextResponse(PAGE, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}

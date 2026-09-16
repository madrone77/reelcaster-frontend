/**
 * POST /api/alert-leads/action  { token, action: 'confirm' | 'unsubscribe' }
 *
 * The buttons on /alert-confirm. A POST rather than the email link itself, so
 * a mail scanner that pre-fetches links cannot confirm (or unsubscribe) on the
 * reader's behalf.
 *
 * 200 { spot_name, spot_slug, status: 'active' | 'unsubscribed' | 'claimed' }
 * 404 { error: 'not_found' }
 */

import { NextRequest, NextResponse } from 'next/server';
import { leadsAdmin, type AlertLead } from '@/lib/alert-leads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  let body: { token?: unknown; action?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const token = typeof body.token === 'string' ? body.token : '';
  const action = body.action;
  if (!UUID_RE.test(token) || (action !== 'confirm' && action !== 'unsubscribe')) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const admin = leadsAdmin();
  const { data: lead } = await admin
    .from('alert_leads')
    .select('*')
    .eq('token', token)
    .maybeSingle<AlertLead>();
  if (!lead) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const out = { spot_name: lead.spot_name, spot_slug: lead.spot_slug };

  // Already on an account: the account's own alert settings govern now.
  if (lead.claimed_user_id) return NextResponse.json({ ...out, status: 'claimed' });

  const now = new Date().toISOString();
  if (action === 'unsubscribe') {
    if (!lead.unsubscribed_at) {
      await admin
        .from('alert_leads')
        .update({ unsubscribed_at: now, updated_at: now })
        .eq('id', lead.id);
    }
    return NextResponse.json({ ...out, status: 'unsubscribed' });
  }

  // Confirming an unsubscribed alert does not revive it; the visitor sets it
  // up again from the spot page, which sends a fresh confirm.
  if (lead.unsubscribed_at) return NextResponse.json({ ...out, status: 'unsubscribed' });

  if (!lead.confirmed_at) {
    await admin
      .from('alert_leads')
      .update({ confirmed_at: now, updated_at: now })
      .eq('id', lead.id);
  }
  return NextResponse.json({ ...out, status: 'active' });
}

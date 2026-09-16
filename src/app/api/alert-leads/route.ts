/**
 * POST /api/alert-leads
 *
 * Public, no auth. A signed-out visitor asks for an email score alert on one
 * spot with a name and an address. Nothing sends until they click the confirm
 * link we email them (see /alert-confirm and ./action).
 *
 * One alert per address. Responses the dialog acts on:
 *   201 { status: 'pending' }     confirm email sent (or re-sent)
 *   200 { status: 'active' }      this exact alert is already confirmed
 *   409 { error: 'lead_exists', spot_name }  a different spot or species is
 *                                 already on this address; make an account
 *   409 { error: 'account_exists' }          the address has an account; sign in
 */

import { NextRequest, NextResponse } from 'next/server';
import { findUserIdByEmail } from '@/lib/checkout-account';
import {
  leadsAdmin,
  normalizeEmail,
  sendLeadConfirmEmail,
  type AlertLead,
} from '@/lib/alert-leads';
import type { LeadTimeMode } from '@/lib/score-beats';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,150}$/;
/** A second confirm email for the same address waits at least this long. */
const RESEND_AFTER_MS = 10 * 60_000;

function isLeadTimeMode(v: unknown): v is LeadTimeMode {
  return v === 'asap' || v === 'short' || v === 'day_of';
}

function str(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 && t.length <= max ? t : null;
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Honeypot: a field no person sees. Pretend it worked.
  if (typeof body.website === 'string' && body.website.length > 0) {
    return NextResponse.json({ status: 'pending' }, { status: 201 });
  }

  const name = str(body.name, 80);
  const rawEmail = str(body.email, 320);
  const spotSlug = str(body.spot_slug, 151);
  const spotName = str(body.spot_name, 200);
  const species = body.target_species == null ? null : str(body.target_species, 100);
  const threshold = body.score_threshold;
  const leadMode = body.lead_time_mode ?? 'asap';
  const lat = typeof body.spot_lat === 'number' && Math.abs(body.spot_lat) <= 90 ? body.spot_lat : null;
  const lng = typeof body.spot_lng === 'number' && Math.abs(body.spot_lng) <= 180 ? body.spot_lng : null;
  const source = str(body.source, 60);

  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  if (!rawEmail || !EMAIL_RE.test(rawEmail)) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
  }
  if (!spotSlug || !SLUG_RE.test(spotSlug) || !spotName) {
    return NextResponse.json({ error: 'Spot is required' }, { status: 400 });
  }
  if (species !== null && !SLUG_RE.test(species)) {
    return NextResponse.json({ error: 'Invalid species' }, { status: 400 });
  }
  if (typeof threshold !== 'number' || !Number.isInteger(threshold) || threshold < 0 || threshold > 100) {
    return NextResponse.json({ error: 'Invalid threshold' }, { status: 400 });
  }
  if (!isLeadTimeMode(leadMode)) {
    return NextResponse.json({ error: 'Invalid lead_time_mode' }, { status: 400 });
  }

  const email = normalizeEmail(rawEmail);
  const admin = leadsAdmin();
  const now = new Date().toISOString();

  const { data: existing, error: readError } = await admin
    .from('alert_leads')
    .select('*')
    .eq('email', email)
    .maybeSingle<AlertLead>();
  if (readError) {
    console.error('[alert-leads] read failed:', readError);
    return NextResponse.json({ error: 'Could not save your alert' }, { status: 500 });
  }

  if (existing?.claimed_user_id) {
    return NextResponse.json({ error: 'account_exists' }, { status: 409 });
  }

  const alert = {
    name,
    spot_slug: spotSlug,
    spot_name: spotName,
    spot_lat: lat,
    spot_lng: lng,
    target_species: species,
    score_threshold: threshold,
    lead_time_mode: leadMode,
    updated_at: now,
  };

  if (existing) {
    const sameAlert =
      existing.spot_slug === spotSlug && (existing.target_species ?? null) === species;

    // A live alert on something else. This is the wall: more than one needs
    // an account.
    if (!sameAlert && !existing.unsubscribed_at) {
      return NextResponse.json(
        { error: 'lead_exists', spot_name: existing.spot_name },
        { status: 409 },
      );
    }

    // Same alert again (new threshold or notice), or a comeback after
    // unsubscribing. A comeback has to confirm again.
    const resubscribing = !!existing.unsubscribed_at;
    const confirmed = !!existing.confirmed_at && !resubscribing;
    const { data: updated, error } = await admin
      .from('alert_leads')
      .update({
        ...alert,
        ...(resubscribing ? { unsubscribed_at: null, confirmed_at: null } : {}),
      })
      .eq('id', existing.id)
      .select('*')
      .single<AlertLead>();
    if (error || !updated) {
      console.error('[alert-leads] update failed:', error);
      return NextResponse.json({ error: 'Could not save your alert' }, { status: 500 });
    }
    if (confirmed) return NextResponse.json({ status: 'active' });

    const lastSent = existing.confirm_sent_at ? Date.parse(existing.confirm_sent_at) : 0;
    if (resubscribing || Date.now() - lastSent > RESEND_AFTER_MS) {
      if (await sendLeadConfirmEmail(updated)) {
        await admin.from('alert_leads').update({ confirm_sent_at: now }).eq('id', updated.id);
      }
    }
    return NextResponse.json({ status: 'pending' }, { status: 201 });
  }

  // New address. Anyone who already has an account signs in instead, so the
  // alert lands on the account and the tier rules apply.
  if (await findUserIdByEmail(admin, email)) {
    return NextResponse.json({ error: 'account_exists' }, { status: 409 });
  }

  const { data: lead, error: insertError } = await admin
    .from('alert_leads')
    .insert({ ...alert, email, source })
    .select('*')
    .single<AlertLead>();
  if (insertError || !lead) {
    // 23505: a double-submit raced us. The first request sent the email.
    if (insertError?.code === '23505') {
      return NextResponse.json({ status: 'pending' }, { status: 201 });
    }
    console.error('[alert-leads] insert failed:', insertError);
    return NextResponse.json({ error: 'Could not save your alert' }, { status: 500 });
  }

  if (await sendLeadConfirmEmail(lead)) {
    await admin.from('alert_leads').update({ confirm_sent_at: now }).eq('id', lead.id);
  }
  return NextResponse.json({ status: 'pending' }, { status: 201 });
}

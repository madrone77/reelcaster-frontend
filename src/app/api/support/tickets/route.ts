/**
 * Support tickets — the backend for The Port (/theport).
 *
 *   GET  /api/support/tickets  → the caller's own tickets, newest first
 *   POST /api/support/tickets  → file a ticket
 *
 * Both require a Bearer token AND an active Pro subscription. The client
 * already gates the page, but the client gate is cosmetic: without the same
 * check here, `curl` with any signed-in free account's token would file into
 * the Pro queue.
 *
 * POST ordering is deliberate: persist the row, THEN attempt email. sendEmail()
 * silently returns success when RESEND_API_KEY is unset (see
 * src/lib/email-service.ts), so notification is the unreliable leg — the ticket
 * must not depend on it. The response carries `emailed` so the UI can say
 * "filed, but we couldn't send confirmation" instead of implying both worked.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUserIdFromRequest } from '@/lib/server-auth';
import { sendEmail } from '@/lib/email-service';
import { SUPPORT_EMAIL } from '@/lib/site';
import {
  buildSupportAckEmail,
  buildSupportTriageEmail,
} from '@/lib/email-templates/support-ticket';
import {
  BODY_MAX,
  BODY_MIN,
  SUBJECT_MAX,
  SUBJECT_MIN,
  TICKET_CATEGORY_LABELS,
  isTicketCategory,
  type TicketContext,
} from '@/lib/support-types';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Columns the member is allowed to see. `user_id` is theirs by definition. */
const TICKET_SELECT =
  'id, ticket_ref, category, subject, body, status, priority, context, resolution_note, resolved_at, created_at, updated_at';

/** Only these context keys are persisted — see sanitizeContext(). */
const ALLOWED_CONTEXT_KEYS = ['page', 'spotSlug', 'appBuild'] as const;

interface Entitlement {
  userId: string;
  email: string;
  tier: string;
  status: string;
  isPaid: boolean;
}

/**
 * Resolve caller identity + tier in one place.
 *
 * Mirrors the tier logic in /api/bluecaster/spots/[slug]/forecast-14d and
 * /api/alerts: pro tier AND (active | trialing). Trialing counts — a member on
 * day two of the free trial is a paying customer as far as support goes.
 */
async function resolveCaller(
  request: NextRequest,
): Promise<Entitlement | null> {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return null;

  const [{ data: settings }, { data: authUser }] = await Promise.all([
    supabaseAdmin
      .from('user_settings')
      .select('subscription_tier, subscription_status')
      .eq('user_id', userId)
      .maybeSingle(),
    supabaseAdmin.auth.admin.getUserById(userId),
  ]);

  const tier: string = settings?.subscription_tier ?? 'free';
  const status: string = settings?.subscription_status ?? 'none';
  const isPaid =
    tier.startsWith('pro') && (status === 'active' || status === 'trialing');

  return {
    userId,
    email: authUser?.user?.email ?? '',
    tier,
    status,
    isPaid,
  };
}

function unauthorized() {
  return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
}

function proRequired() {
  return NextResponse.json(
    {
      error:
        'The Port is a Pro feature. Free accounts can reach us at ' +
        `${SUPPORT_EMAIL}.`,
      upgrade_required: true,
    },
    { status: 403 },
  );
}

/**
 * Keep only known-safe context keys, each truncated.
 *
 * The client hands us this object, so it is untrusted input that ends up in an
 * email we read. An open-ended passthrough would let a caller stuff arbitrary
 * keys and megabytes into a jsonb column. userAgent is read from the request
 * header rather than the body for the same reason — the client shouldn't get
 * to author it.
 */
function sanitizeContext(raw: unknown): TicketContext {
  const out: TicketContext = {};
  if (!raw || typeof raw !== 'object') return out;
  const src = raw as Record<string, unknown>;
  for (const key of ALLOWED_CONTEXT_KEYS) {
    const v = src[key];
    if (typeof v === 'string' && v.trim()) out[key] = v.trim().slice(0, 500);
  }
  return out;
}

export async function GET(request: NextRequest) {
  const caller = await resolveCaller(request);
  if (!caller) return unauthorized();
  if (!caller.isPaid) return proRequired();

  const { data, error } = await supabaseAdmin
    .from('support_tickets')
    .select(TICKET_SELECT)
    .eq('user_id', caller.userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('support_tickets select failed:', error);
    return NextResponse.json(
      { error: 'Could not load your tickets' },
      { status: 500 },
    );
  }

  return NextResponse.json({ tickets: data ?? [] });
}

export async function POST(request: NextRequest) {
  const caller = await resolveCaller(request);
  if (!caller) return unauthorized();
  if (!caller.isPaid) return proRequired();

  let raw: Record<string, unknown>;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const category = raw.category;
  if (!isTicketCategory(category)) {
    return NextResponse.json(
      { error: 'Pick a category' },
      { status: 400 },
    );
  }

  const subject = typeof raw.subject === 'string' ? raw.subject.trim() : '';
  if (subject.length < SUBJECT_MIN || subject.length > SUBJECT_MAX) {
    return NextResponse.json(
      { error: `Subject must be ${SUBJECT_MIN}–${SUBJECT_MAX} characters` },
      { status: 400 },
    );
  }

  const body = typeof raw.body === 'string' ? raw.body.trim() : '';
  if (body.length < BODY_MIN || body.length > BODY_MAX) {
    return NextResponse.json(
      { error: `Please give us at least ${BODY_MIN} characters of detail` },
      { status: 400 },
    );
  }

  const context: TicketContext = {
    ...sanitizeContext(raw.context),
    tier: caller.tier,
    subscriptionStatus: caller.status,
    userAgent: (request.headers.get('user-agent') ?? '').slice(0, 500),
  };

  const { data: ticket, error } = await supabaseAdmin
    .from('support_tickets')
    .insert({
      user_id: caller.userId,
      category,
      subject,
      body,
      context,
    })
    .select(TICKET_SELECT)
    .single();

  if (error || !ticket) {
    console.error('support_tickets insert failed:', error);
    return NextResponse.json(
      { error: 'Could not file your ticket. Please try again.' },
      { status: 500 },
    );
  }

  // Notification leg. Never fails the request — the ticket is already durable.
  let emailed = false;
  try {
    const params = {
      ticketRef: ticket.ticket_ref,
      category,
      categoryLabel: TICKET_CATEGORY_LABELS[category],
      subject,
      body,
      userEmail: caller.email,
      userId: caller.userId,
      tier: caller.tier,
      status: caller.status,
      createdAt: ticket.created_at,
      context,
    };

    const triage = buildSupportTriageEmail(params);
    const results = await Promise.all([
      sendEmail({
        to: SUPPORT_EMAIL,
        subject: triage.subject,
        html: triage.html,
        // Replies from the inbox go straight to the member.
        from: `ReelCaster Port <noreply@reelcaster.com>`,
      }),
      caller.email
        ? (() => {
            const ack = buildSupportAckEmail(params);
            return sendEmail({
              to: caller.email,
              subject: ack.subject,
              html: ack.html,
            });
          })()
        : Promise.resolve({ success: false }),
    ]);
    emailed = results.every((r) => r.success);
    if (!emailed) {
      console.error(
        `Ticket ${ticket.ticket_ref} saved but notification failed`,
        results,
      );
    }
  } catch (err) {
    console.error(
      `Ticket ${ticket.ticket_ref} saved but notification threw`,
      err,
    );
  }

  return NextResponse.json({ ticket, emailed }, { status: 201 });
}

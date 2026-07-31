'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Loader2 } from 'lucide-react';

import { useSubscription } from '@/hooks/use-subscription';
import { supabase } from '@/lib/supabase';
import PortSection from './port-section';

const TIER_LABELS: Record<string, string> = {
  free: 'Free',
  pro_monthly: 'Pro · Monthly',
  pro_annual: 'Pro · Annual',
};

const STATUS_LABELS: Record<string, string> = {
  none: 'No subscription',
  active: 'Active',
  trialing: 'Free trial',
  past_due: 'Past due',
  canceled: 'Canceled',
  incomplete: 'Incomplete',
  incomplete_expired: 'Expired',
  unpaid: 'Unpaid',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Billing self-serve.
 *
 * Everything mutating is Stripe's job — we open the portal and get out of the
 * way rather than reimplementing plan changes and card updates against the
 * Stripe API. This section's only real work is reading current state and
 * handling the comped-account case, where a portal button would 404 because
 * there is no Stripe customer behind the subscription.
 */
export default function BillingSection() {
  const { tier, status, isPaid, loading, periodEnd, stripeCustomerId } =
    useSubscription();
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isComped = isPaid && !stripeCustomerId;

  const openPortal = async () => {
    setOpening(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Not signed in');
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = await res.json();
      if (!res.ok || !body.url) {
        throw new Error(body.error ?? 'Could not open the billing portal');
      }
      window.location.href = body.url;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not open the billing portal',
      );
      setOpening(false);
    }
  };

  return (
    <PortSection
      eyebrow="Billing"
      title="Your plan"
      intro="Cards, plan switches, invoices and cancellation all live in the Stripe portal. Everything else about billing, we can answer by ticket."
    >
      <div className="bg-rc-panel border border-rc-rule rounded-xl p-5 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Plan" value={loading ? '—' : TIER_LABELS[tier] ?? tier} />
          <Stat
            label="Status"
            value={loading ? '—' : STATUS_LABELS[status] ?? status}
            tone={
              status === 'past_due' || status === 'unpaid' ? 'warn' : 'default'
            }
          />
          <Stat
            label={
              status === 'canceled' || isComped ? 'Access until' : 'Next renewal'
            }
            value={loading ? '—' : formatDate(periodEnd)}
          />
        </div>

        {error && (
          <div className="mt-4 bg-rc-poor-bg border border-rc-poor/40 rounded-md p-3 text-sm text-rc-poor-ink">
            {error}
          </div>
        )}

        <div className="mt-5">
          {isComped ? (
            <div className="bg-rc-good-bg border border-rc-good-border rounded-md p-4 text-sm text-rc-good-ink leading-relaxed">
              Pro is complimentary on this account, so there is no card on file
              and nothing to manage. You keep full access, including The Port,
              until the date above. Nothing renews and nothing is charged.
            </div>
          ) : (
            <button
              type="button"
              onClick={openPortal}
              disabled={opening || loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-rc-brand hover:bg-rc-brand-hover text-white text-sm font-semibold transition-colors disabled:opacity-60"
            >
              {opening ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                  Opening portal…
                </>
              ) : (
                <>
                  Manage billing in Stripe
                  <ExternalLink className="w-4 h-4" aria-hidden />
                </>
              )}
            </button>
          )}
        </div>

        <p className="mt-4 text-xs text-rc-ink-mute leading-relaxed">
          {isComped
            ? 'If you want to continue past that date, you can subscribe any time from the pricing page.'
            : 'Update your card, switch between monthly and annual, download invoices, or cancel. Cancelling keeps your access until the end of the period you have already paid for.'}
        </p>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <HelpCard
          title="Charged unexpectedly?"
          body="Send us the date and amount from your statement and we will trace it to the invoice. If it is our mistake we refund it, and we do not make you argue for that."
        />
        <HelpCard
          title="Need an invoice for expenses?"
          body="Every invoice is downloadable as a PDF from the Stripe portal. If you need one reissued with a business name or number on it, file a billing ticket."
        />
      </div>

      <p className="mt-5 text-xs text-rc-ink-mute">
        Full plan and pricing details live on the{' '}
        <Link
          href="/pricing"
          className="text-rc-brand hover:text-rc-brand-hover underline underline-offset-2"
        >
          pricing page
        </Link>
        .
      </p>
    </PortSection>
  );
}

function Stat({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'warn';
}) {
  return (
    <div className="bg-rc-surface rounded-lg p-3.5">
      <p className="font-rc-mono text-[10px] tracking-[0.1em] uppercase text-rc-ink-mute">
        {label}
      </p>
      <p
        className={`mt-1 font-semibold ${
          tone === 'warn' ? 'text-rc-poor-ink' : 'text-rc-ink'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function HelpCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-rc-panel border border-rc-rule rounded-xl p-5">
      <h3 className="text-sm font-semibold text-rc-ink">{title}</h3>
      <p className="mt-1.5 text-sm text-rc-ink-soft leading-relaxed">{body}</p>
    </div>
  );
}

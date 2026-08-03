'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ANNUAL_PRICE_CENTS,
  MONTHLY_PRICE_CENTS,
  TRIAL_DAYS,
  annualDiscount,
  type PricingPlan,
} from '@/lib/pricing';
import { useAnalytics } from '@/hooks/use-analytics';
import { useStartCheckout } from '@/hooks/use-start-checkout';

// $5, $33 — drop the cents when they're zero (same rule as the pricing card).
function dollars(cents: number): string {
  const v = cents / 100;
  return Number.isInteger(v) ? `$${v}` : `$${v.toFixed(2)}`;
}

const DEFAULT_BULLETS = [
  '14-day forecast',
  '5 species scoring',
  'Bathymetry layer',
  'Up to 10 alerts',
  'Unlimited favorites',
];

export interface UnlockWithProCardProps {
  /** Headline above the bullets. */
  headline?: string;
  /** Bullet list of unlocked features. */
  bullets?: string[];
  /**
   * Escape hatch: renders a plain link to this href instead of starting
   * checkout. Leave unset — the CTA's job is to open Stripe, not /pricing.
   */
  ctaHref?: string;
  /** CTA label override. Only used by the `ctaHref` link variant. */
  ctaLabel?: string;
  /** Feature id used for analytics + default ctaHref query. */
  feature?: string;
  /** Compact variant (smaller, no headline) for inline placement. */
  compact?: boolean;
  /**
   * Color scheme. 'auto' detects from CSS context (works inside both rc-bg-*
   * dark surfaces and the light marketing pages). 'light' / 'dark' force.
   */
  theme?: 'auto' | 'light' | 'dark';
  className?: string;
}

export function UnlockWithProCard({
  headline = 'Unlock with Pro',
  bullets = DEFAULT_BULLETS,
  ctaHref,
  ctaLabel = `Try Pro free for ${TRIAL_DAYS} days`,
  feature,
  compact = false,
  theme = 'auto',
  className,
}: UnlockWithProCardProps) {
  const { trackEvent } = useAnalytics();
  const { startCheckout, submitting, error } = useStartCheckout();
  // Which button was pressed — the hook has one `submitting` flag, but only the
  // button the user actually clicked should say "Starting…".
  const [pending, setPending] = useState<PricingPlan | null>(null);

  const { pct } = annualDiscount();

  // Signed-out visitors can't have a Checkout Session (there's no Supabase user
  // to attach the subscription to), and this card renders on public /explore
  // surfaces — so they still get /pricing, which sells before it asks. The
  // cadence they picked here rides along.
  const pricingHref = (plan: PricingPlan) =>
    `/pricing?from=paywall${
      feature ? `&feature=${encodeURIComponent(feature)}` : ''
    }&plan=${plan}`;

  function buy(plan: PricingPlan) {
    trackEvent('Paywall CTA Clicked', { feature, plan, destination: 'stripe' });
    setPending(plan);
    startCheckout({ plan, from: 'paywall', signedOutHref: pricingHref(plan) });
  }

  const themeClasses =
    theme === 'light'
      ? 'bg-stone-50 border-stone-200 text-stone-900'
      : theme === 'dark'
      ? 'bg-rc-bg-dark border-rc-bg-light text-rc-text'
      : // auto: rc-* tokens with light fallback if surrounding context is light
        'bg-rc-bg-dark border-rc-bg-light text-rc-text dark:bg-rc-bg-dark';

  const subtleText =
    theme === 'light' ? 'text-stone-600' : 'text-rc-text-muted';

  return (
    <div
      data-testid="unlock-with-pro-card"
      data-feature={feature}
      className={cn(
        'rounded-xl border p-5 sm:p-6',
        themeClasses,
        compact && 'p-4',
        className,
      )}
    >
      {!compact && (
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-amber-400" />
          <h3 className="text-lg font-semibold">{headline}</h3>
        </div>
      )}

      <ul className={cn('space-y-1.5 text-sm mb-4', subtleText)}>
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2">
            <span className="mt-1 inline-block w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      {ctaHref ? (
        <Link
          href={ctaHref}
          onClick={() =>
            trackEvent('Paywall CTA Clicked', { feature, href: ctaHref })
          }
          data-testid="upgrade-cta"
          className="inline-flex items-center justify-center rounded-full bg-green-600 hover:bg-green-500 px-5 py-2 text-sm font-medium text-white transition-colors"
        >
          {ctaLabel}
        </Link>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          {/* Yearly leads — it's the better deal — but both go straight to
              Stripe, so the cadence is chosen here and nowhere else. */}
          <button
            type="button"
            disabled={submitting}
            onClick={() => buy('annual')}
            data-testid="upgrade-cta"
            data-plan="annual"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-500 disabled:opacity-60"
          >
            {pending === 'annual' && submitting ? (
              'Starting…'
            ) : (
              <>
                <span>Yearly · {dollars(ANNUAL_PRICE_CENTS)}</span>
                <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-bold leading-none">
                  −{pct}%
                </span>
              </>
            )}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => buy('monthly')}
            data-testid="upgrade-cta-monthly"
            data-plan="monthly"
            className={cn(
              'inline-flex flex-1 items-center justify-center rounded-full border px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60',
              theme === 'light'
                ? 'border-stone-300 text-stone-900 hover:bg-stone-100'
                : 'border-rc-bg-light text-rc-text hover:bg-rc-bg-light',
            )}
          >
            {pending === 'monthly' && submitting
              ? 'Starting…'
              : `Monthly · ${dollars(MONTHLY_PRICE_CENTS)}`}
          </button>
        </div>
      )}

      {!ctaHref && (
        <p className={cn('mt-2.5 text-xs', subtleText)}>
          {TRIAL_DAYS} days free on either plan — nothing is charged until the
          trial ends, and you can cancel before then.
        </p>
      )}

      {error && (
        <p
          role="alert"
          className={cn(
            'mt-3 rounded-md p-3 text-xs',
            theme === 'light'
              ? 'border border-red-200 bg-red-50 text-red-700'
              : 'border border-red-500/30 bg-red-500/10 text-red-300',
          )}
        >
          {error}
        </p>
      )}
    </div>
  );
}

export default UnlockWithProCard;

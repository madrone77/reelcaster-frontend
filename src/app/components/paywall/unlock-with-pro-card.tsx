'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { TRIAL_DAYS } from '@/lib/pricing';
import { useAnalytics } from '@/hooks/use-analytics';
import { useAuth } from '@/contexts/auth-context';
import { useSubscription } from '@/hooks/use-subscription';
import { usePricing } from '@/app/components/split-test/use-pricing';
import { captureWall } from '@/lib/attribution';
import { reportPaywall } from '@/lib/paywall-counter';
import type { NagFeatureId, PlanTierId } from '@/lib/plan-features';
import TrialCta from './trial-cta';

/**
 * The in-app paywall card, styled to match /plans.
 *
 * It used to run its own palette — amber bullet dots, an amber sparkle, and a
 * green pill CTA — which read as a different product from the sales page it
 * links to. Now it uses the rc-* tokens and the brand blue, and the bullets
 * are brand checkmarks, so the modal and /plans tell one story.
 *
 * Still renders on two very different surfaces: the light `UpgradeRequiredModal`
 * and the dark Explore drawer/card. That's what `theme` is for — don't collapse
 * it to a single palette.
 */

/**
 * Matches the /plans comparison table, deliberately.
 *
 * The old defaults advertised "Bathymetry layer" and "5 species scoring" —
 * neither is on the table, because the table lists only what's actually gated
 * today. A paywall shouldn't promise more than the page you're sending people
 * to; that gap is what turns an upgrade into a refund.
 */
const DEFAULT_BULLETS = [
  'Plan the full two weeks',
  'Read the water with no ads in the way',
  'Save every spot you fish',
  'Score a spot we don’t cover: your pin, our full model',
  'Alerts when it’s on, by text or email',
];

export interface UnlockWithProCardProps {
  /** Headline above the bullets. */
  headline?: string;
  /** Bullet list of unlocked features. */
  bullets?: string[];
  /**
   * Escape hatch: renders a plain link here instead of the cadence choice +
   * Stripe handoff. Signed-out visitors get this href either way.
   */
  ctaHref?: string;
  /** CTA label override. */
  ctaLabel?: string;
  /**
   * What the visitor is being denied. Drives analytics, the counter, and the
   * default `?feature=` on the CTA. Typed against the live enum because the
   * counter validates against that same enum server side: a wall whose feature
   * is not a member is silently counted nowhere, which is the bug this card
   * used to have.
   */
  feature?: NagFeatureId;
  /**
   * Where this card sits, as it should read on the admin's list of surfaces:
   * "support-portal", "alerts-page". Only used for reporting.
   */
  surface?: string;
  /** Overrides the auto-detected tier. Only for surfaces that already know. */
  viewerTier?: PlanTierId;
  /** Compact variant (smaller, no headline) for inline placement. */
  compact?: boolean;
  /**
   * Color scheme. 'auto' detects from CSS context (works inside both rc-bg-*
   * dark surfaces and the light marketing pages). 'light' / 'dark' force.
   */
  theme?: 'auto' | 'light' | 'dark';
  className?: string;
}

function Check({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className={cn('mt-0.5 h-4 w-4 flex-shrink-0', className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 8.5l3.5 3.5 7.5-8" />
    </svg>
  );
}

export function UnlockWithProCard({
  headline = 'Unlock with Pro',
  bullets = DEFAULT_BULLETS,
  ctaHref,
  ctaLabel = `Try Pro free for ${TRIAL_DAYS} days`,
  feature,
  surface = 'unlock-card',
  viewerTier: viewerTierProp,
  compact = false,
  theme = 'auto',
  className,
}: UnlockWithProCardProps) {
  const { trackEvent } = useAnalytics();
  const { user } = useAuth();
  const { isPaid, loading: tierLoading } = useSubscription();
  const viewerTier: PlanTierId =
    viewerTierProp ?? (isPaid ? 'pro' : user ? 'free' : 'anon');

  /**
   * Count the wall, and remember it for whatever the visitor converts into.
   *
   * Held until the tier has settled. `useSubscription` reports free while it
   * loads, and firing on the first render would file some of these views under
   * the wrong column on /admin/reelcaster/paywalls. The wait is one request,
   * and none of it moves the day bucket the count lands in.
   *
   * Nothing is reported without a feature: the counter validates the id
   * against NAG_FEATURES and drops what it does not recognise, so an unnamed
   * wall would post and count nothing.
   */
  useEffect(() => {
    if (!feature || tierLoading) return;
    reportPaywall('impression', { feature, surface, viewerTier });
    // The cookie that carries this wall across the navigation to /signup or
    // out to Stripe, so the account that comes out the far end knows which
    // wall sent them. Last touch wins, and it expires in 30 minutes.
    captureWall(feature, surface);
  }, [feature, surface, viewerTier, tierLoading]);

  const reportCtaClick = () => {
    if (!feature) return;
    reportPaywall('cta_click', { feature, surface, viewerTier });
  };

  const href =
    ctaHref ??
    `/plans?from=paywall${feature ? `&feature=${encodeURIComponent(feature)}` : ''}`;

  // Derived from pricing.ts rather than hardcoded, so the button can't keep
  // advertising $33 after the Price changes.
  // The card's own button quotes the reader's price, not the build's.
  const pricing = usePricing();
  const label = ctaLabel ?? `Upgrade to Pro · ${pricing.amount}/yr`;

  const isLight = theme === 'light';

  const themeClasses = isLight
    ? 'bg-rc-panel border-rc-rule text-rc-ink shadow-rc-panel'
    : 'bg-rc-bg-dark border-rc-bg-light text-rc-text';

  const subtleText = isLight ? 'text-rc-ink-soft' : 'text-rc-text-muted';
  const eyebrowText = isLight ? 'text-rc-ink-mute' : 'text-rc-text-muted';
  // Brand blue reads on the light panel; on the dark Explore surface it goes
  // muddy, so the checks lift to white there.
  const checkColor = isLight ? 'text-rc-brand' : 'text-white';

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
        <div className="mb-4">
          <p
            className={cn(
              'font-rc-mono text-[10px] uppercase tracking-[0.14em]',
              eyebrowText,
            )}
          >
            ReelCaster Pro
          </p>
          <h3 className="mt-1.5 text-xl font-black tracking-[-0.02em]">
            {headline}
          </h3>
        </div>
      )}

      <ul className={cn('mb-5 space-y-2 text-sm', subtleText)}>
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2.5">
            <Check className={checkColor} />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      {ctaHref ? (
        <Link
          href={href}
          onClick={() => {
            trackEvent('Paywall CTA Clicked', { feature, viewerTier, href });
            reportCtaClick();
          }}
          data-testid="upgrade-cta"
          className="inline-flex items-center justify-center rounded-md bg-rc-brand px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-rc-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-2"
        >
          {label}
        </Link>
      ) : (
        // Cadence + terms + payment handoff (Stripe when signed in,
        // /plans/checkout when not).
        <TrialCta
          from={feature ? `paywall:${feature}` : 'paywall'}
          theme={isLight ? 'light' : 'dark'}
          onActivate={(plan) => {
            trackEvent('Paywall CTA Clicked', {
              feature,
              viewerTier,
              plan: plan ?? 'anon',
              destination: 'checkout',
            });
            reportCtaClick();
          }}
        />
      )}
    </div>
  );
}

export default UnlockWithProCard;

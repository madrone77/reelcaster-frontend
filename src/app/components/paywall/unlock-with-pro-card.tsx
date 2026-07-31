'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { TRIAL_DAYS } from '@/lib/pricing';
import { useAnalytics } from '@/hooks/use-analytics';
import { ANNUAL_PRICE_CENTS } from '@/lib/pricing';

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
  'Save every spot you fish',
  'Score a spot we don’t cover: your pin, our full model',
  'Alerts when it’s on, by text or email',
];

function dollars(cents: number): string {
  const v = cents / 100;
  return Number.isInteger(v) ? `$${v}` : `$${v.toFixed(2)}`;
}

export interface UnlockWithProCardProps {
  /** Headline above the bullets. */
  headline?: string;
  /** Bullet list of unlocked features. */
  bullets?: string[];
  /** CTA destination. Defaults to /plans with paywall context query. */
  ctaHref?: string;
  /** CTA label override. */
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
  compact = false,
  theme = 'auto',
  className,
}: UnlockWithProCardProps) {
  const { trackEvent } = useAnalytics();
  const href =
    ctaHref ??
    `/plans?from=paywall${feature ? `&feature=${encodeURIComponent(feature)}` : ''}`;

  // Derived from pricing.ts rather than hardcoded, so the button can't keep
  // advertising $33 after the Price changes.
  const label = ctaLabel ?? `Upgrade to Pro · ${dollars(ANNUAL_PRICE_CENTS)}/yr`;

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

      <Link
        href={href}
        onClick={() => trackEvent('Paywall CTA Clicked', { feature, href })}
        data-testid="upgrade-cta"
        className="inline-flex items-center justify-center rounded-md bg-rc-brand px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-rc-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-2"
      >
        {label}
      </Link>
    </div>
  );
}

export default UnlockWithProCard;

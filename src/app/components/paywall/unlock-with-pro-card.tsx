'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TRIAL_DAYS } from '@/lib/pricing';
import { useAnalytics } from '@/hooks/use-analytics';

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
  /** CTA destination. Defaults to /pricing with paywall context query. */
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
    `/pricing?from=paywall${feature ? `&feature=${encodeURIComponent(feature)}` : ''}`;

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

      <Link
        href={href}
        onClick={() => trackEvent('Paywall CTA Clicked', { feature, href })}
        data-testid="upgrade-cta"
        className="inline-flex items-center justify-center rounded-full bg-green-600 hover:bg-green-500 px-5 py-2 text-sm font-medium text-white transition-colors"
      >
        {ctaLabel}
      </Link>
    </div>
  );
}

export default UnlockWithProCard;

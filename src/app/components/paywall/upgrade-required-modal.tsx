'use client'

import { X } from 'lucide-react'
import UnlockWithProCard from './unlock-with-pro-card'
import type { NagFeatureId } from '@/lib/plan-features'

interface Props {
  open: boolean
  onClose: () => void
  /**
   * What the visitor was denied. Feeds analytics, the paywall counter, and the
   * ?feature= query on /plans, so it has to be a live NAG_FEATURES key.
   */
  feature: NagFeatureId
  /**
   * Where this wall was hit, as it should read on the admin's surface list.
   * Defaults to naming the feature, which is better than an empty column but
   * worse than the page saying where it stands.
   */
  surface?: string
  headline?: string
  bullets?: string[]
  /** Optional override for the CTA target. */
  ctaHref?: string
  /** Optional override for the CTA label. */
  ctaLabel?: string
}

/**
 * Modal that wraps `<UnlockWithProCard>` for places where an action triggered
 * an `upgrade_required` response (e.g. trying to add a 2nd alert as a free
 * user). Caller controls open state.
 *
 * The card does the counting, not this shell. Both are the same wall, and one
 * reporter means the view cannot be counted twice. Because this returns null
 * while closed, the card mounting is exactly the wall being shown.
 */
export default function UpgradeRequiredModal({
  open,
  onClose,
  feature,
  surface,
  headline,
  bullets,
  ctaHref,
  ctaLabel,
}: Props) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-rc-ink/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      data-testid="upgrade-required-modal"
      data-feature={feature}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg"
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 rounded-full border border-rc-rule bg-rc-panel p-1.5 text-rc-ink-mute transition-colors hover:text-rc-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-2"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
        <UnlockWithProCard
          headline={headline}
          bullets={bullets}
          ctaLabel={ctaLabel}
          feature={feature}
          surface={surface ?? `upgrade-required-${feature}`}
          ctaHref={ctaHref ?? `/plans?from=paywall&feature=${encodeURIComponent(feature)}`}
          theme="light"
        />
      </div>
    </div>
  )
}

'use client'

import { X } from 'lucide-react'
import UnlockWithProCard from './unlock-with-pro-card'

interface Props {
  open: boolean
  onClose: () => void
  /** Feature id used for analytics + ?feature= query on /plans. */
  feature: string
  headline?: string
  bullets?: string[]
  /** Optional override for the CTA target. */
  ctaHref?: string
}

/**
 * Modal that wraps `<UnlockWithProCard>` for places where an action triggered
 * an `upgrade_required` response (e.g. trying to add a 2nd alert as a free
 * user). Caller controls open state.
 */
export default function UpgradeRequiredModal({
  open,
  onClose,
  feature,
  headline,
  bullets,
  ctaHref,
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
          ctaHref={ctaHref ?? `/plans?from=paywall&feature=${encodeURIComponent(feature)}`}
          theme="light"
        />
      </div>
    </div>
  )
}

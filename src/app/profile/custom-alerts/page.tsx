'use client'

import { Suspense, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import ExploreTopBar from '@/app/explore/components/explore-top-bar'
import { PAGE_MEASURE, READING_MEASURE } from '@/app/components/layout/page-measure'
import {
  CustomAlertForm,
  type AlertSpotContext,
  type AlertSubmitPayload,
} from '@/app/components/alerts/custom-alert-form'

/**
 * Advanced alert builder — the "condition set" override reached from the
 * create-alert modal's "Advanced setup" link. Alerts are always anchored to a
 * spot (passed via query params), so there's no map pin-drop here. Bare visits
 * (no spot context) redirect to /notifications, which is the manage view.
 */
function AdvancedAlertBuilder() {
  const { user, session, loading: authLoading } = useAuth()
  const router = useRouter()
  const params = useSearchParams()

  const slug = params.get('slug')

  const spotContext: AlertSpotContext | null = useMemo(() => {
    if (!slug) return null
    const lat = Number(params.get('lat'))
    const lng = Number(params.get('lng'))
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    const threshold = Number(params.get('threshold'))
    return {
      slug,
      name: params.get('name') || slug,
      lat,
      lng,
      city: params.get('city') || undefined,
      areaCode: params.get('area') || undefined,
      speciesSlug: params.get('species') || undefined,
      threshold: Number.isFinite(threshold) ? threshold : undefined,
    }
  }, [slug, params])

  // Auth gate, and redirect bare visits to the manage view — you can only build
  // an alert from a spot, so there's nothing to do here without spot context.
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/login?next=/notifications')
      return
    }
    if (!spotContext) router.replace('/notifications')
  }, [authLoading, user, spotContext, router])

  const submit = async (payload: AlertSubmitPayload) => {
    if (!session?.access_token) return
    const res = await fetch('/api/alerts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(
        body.upgrade_required
          ? "You've hit your alert limit. Upgrade for more."
          : (body.error ?? 'Failed to save alert'),
      )
    }
    router.push('/notifications')
  }

  if (authLoading || !user || !spotContext) {
    return (
      <div className="mt-24 flex items-center justify-center gap-2 text-rc-ink-mute">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading…
      </div>
    )
  }

  return (
    <div className={`${PAGE_MEASURE} py-8`}>
      <div className={`${READING_MEASURE} space-y-6`}>
        <div>
          <Link
            href={`/explore/spot/${spotContext.slug}`}
            className="inline-flex items-center gap-1.5 font-rc-mono text-[11px] font-semibold text-rc-ink-mute hover:text-rc-brand transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> BACK TO SPOT
          </Link>
          <h1 className="mt-3 text-3xl font-bold tracking-[-0.02em] text-rc-ink">
            Advanced alert
          </h1>
          <p className="mt-1.5 font-rc-mono text-[12px] text-rc-ink-mute">
            Fine-tune the exact conditions that trigger this alert. Start from a
            score, then layer on wind, tide, pressure, temperature, or solunar.
          </p>
        </div>
        <CustomAlertForm
          spotContext={spotContext}
          onSubmit={submit}
          onCancel={() => router.push(`/explore/spot/${spotContext.slug}`)}
        />
      </div>
    </div>
  )
}

export default function CustomAlertsAdvancedPage() {
  return (
    <div className="min-h-dvh bg-rc-page">
      <ExploreTopBar />
      <main className="pt-16">
        <Suspense fallback={null}>
          <AdvancedAlertBuilder />
        </Suspense>
      </main>
    </div>
  )
}

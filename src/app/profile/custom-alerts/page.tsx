'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import ExploreTopBar from '@/app/explore/components/explore-top-bar'
import {
  CreateAlertContent,
  type AlertSpot,
  type AlertSpeciesOption,
} from '@/app/explore/spot/components/create-alert-dialog'
import { fetchSpotLive } from '@/lib/bluecaster-client'

/**
 * Standalone score-alert surface — the full-page twin of the create-alert
 * modal, reached from a spot deep-link (`?slug=…`) or the modal's own path.
 * Loads the spot live to populate the species pills, then renders the shared
 * {@link CreateAlertContent}. Bare visits (no spot) redirect to /notifications,
 * the manage view; the condition-set override lives at ./advanced.
 */
function ScoreAlertPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const params = useSearchParams()

  const slug = params.get('slug')
  const wantedSpecies = params.get('species')

  const [loading, setLoading] = useState(true)
  const [spot, setSpot] = useState<AlertSpot | null>(null)
  const [speciesOptions, setSpeciesOptions] = useState<AlertSpeciesOption[]>([])
  const [initialSpeciesId, setInitialSpeciesId] = useState<string | null>(null)

  // Auth gate + bare-visit redirect (you can only build an alert from a spot).
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/login?next=/notifications')
      return
    }
    if (!slug) router.replace('/notifications')
  }, [authLoading, user, slug, router])

  // Load the spot to fill species pills + identity.
  useEffect(() => {
    if (!slug) return
    let cancelled = false
    ;(async () => {
      const payload = await fetchSpotLive(slug)
      if (cancelled) return
      if (!payload) {
        router.replace('/notifications')
        return
      }
      const sp = payload.spot
      setSpot({
        name: sp.name,
        slug: sp.slug,
        lat: sp.lat,
        lng: sp.lng,
        city: sp.city,
        regAreaCode: payload.regAreaCode,
      })
      const opts = payload.species.map((s) => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
      }))
      setSpeciesOptions(opts)
      // Preselect ?species= (by slug) → else the spot's top-scoring species today.
      let chosen = wantedSpecies
        ? (opts.find((o) => o.slug === wantedSpecies)?.id ?? null)
        : null
      if (!chosen) {
        let max = -Infinity
        for (const [id, v] of Object.entries(payload.topScoreTodayBySpecies)) {
          if (v > max) {
            max = v
            chosen = id
          }
        }
      }
      setInitialSpeciesId(chosen ?? opts[0]?.id ?? null)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  if (authLoading || !user || !slug || loading || !spot) {
    return (
      <div className="mt-24 flex items-center justify-center gap-2 text-rc-ink-mute">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading…
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-8 space-y-4">
      <Link
        href={`/explore/spot/${spot.slug}`}
        className="inline-flex items-center gap-1.5 font-rc-mono text-[11px] font-semibold text-rc-ink-mute hover:text-rc-brand transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> BACK TO SPOT
      </Link>
      <div className="rounded-2xl border border-rc-rule bg-rc-panel p-6 shadow-rc-panel">
        <CreateAlertContent
          active
          variant="page"
          spot={spot}
          speciesOptions={speciesOptions}
          initialSpeciesId={initialSpeciesId}
          onCreated={() => router.push('/notifications')}
          onCancel={() => router.push(`/explore/spot/${spot.slug}`)}
        />
      </div>
    </div>
  )
}

export default function CustomAlertsPage() {
  return (
    <div className="min-h-dvh bg-rc-page">
      <ExploreTopBar />
      <main className="pt-16">
        <Suspense fallback={null}>
          <ScoreAlertPage />
        </Suspense>
      </main>
    </div>
  )
}

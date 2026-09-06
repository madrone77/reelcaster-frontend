'use client'

import { Suspense, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { apiFetch } from '@/lib/api-client'
import { trackEvent } from '@/lib/analytics'
import { useSubscription } from '@/hooks/use-subscription'
import { useAuth } from '@/contexts/auth-context'
import MetaStartTrial from '@/app/components/analytics/meta-start-trial'
import GoogleStartTrial from '@/app/components/analytics/google-start-trial'
import PlausibleStartTrial from '@/app/components/analytics/plausible-start-trial'
import { useTrialConversion } from '@/app/components/analytics/use-trial-conversion'

interface CheckoutStatus {
  tier: string
  status: string
  is_active: boolean
  period_end: string | null
}

function BillingSuccessInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const subscription = useSubscription()
  const { user, loading: authLoading } = useAuth()
  const [status, setStatus] = useState<CheckoutStatus | null>(null)
  const [polling, setPolling] = useState(true)
  // Resolved once and handed to all three tags. Asked separately, it was three
  // requests racing the bounce below, and the tag that lost reported nothing.
  const conversion = useTrialConversion(sessionId)
  // Set when the subscription goes active. The redirect waits on this AND on
  // the conversion answer, so the tags always get their moment to fire.
  const [activated, setActivated] = useState(false)
  // Pay-first purchases land here with no session at all: the account was
  // created from the email Stripe billed, and this is where it gets claimed.
  const [claimState, setClaimState] = useState<
    'idle' | 'working' | 'created' | 'emailed'
  >('idle')
  // The address the account is being made under, as Stripe reports it. The
  // phone sheet never asked for one, so this is the first time the buyer sees
  // it, and a typo here is a paid account nobody can sign in to. Shown while
  // the account is set up and for a moment after, with a way to correct it.
  const [claimEmail, setClaimEmail] = useState<string | null>(null)
  const [editingEmail, setEditingEmail] = useState(false)
  // The sign-in link, once the claim has produced one. Followed a moment
  // later unless the buyer is mid-correction, in which case it waits.
  const [signInUrl, setSignInUrl] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading || user || !sessionId) return

    let cancelled = false
    let attempts = 0
    setClaimState('working')

    const claim = async () => {
      try {
        const res = await fetch('/api/stripe/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId }),
        })
        const body = await res.json().catch(() => ({}))

        if (cancelled) return
        if (typeof body?.email === 'string' && body.email) {
          setClaimEmail(body.email)
        }

        // 202 = the webhook hasn't provisioned the account yet. Keep waiting.
        if (res.status === 202) {
          attempts += 1
          if (attempts < 15) setTimeout(claim, 2000)
          else setClaimState('emailed')
          return
        }

        if (body?.status === 'signed_in' && body.url) {
          trackEvent('Account Claimed')
          // The magic link signs them in and returns to /explore. Followed by
          // the effect below, after the buyer has had a moment to read the
          // address it was made under.
          setSignInUrl(body.url)
          setClaimState('created')
          return
        }
        setClaimState('emailed')
      } catch {
        if (!cancelled) setClaimState('emailed')
      }
    }

    claim()
    return () => {
      cancelled = true
    }
  }, [authLoading, user, sessionId])

  // Follow the sign-in link, unless the buyer has opened the address to fix
  // it; then this waits until they save or cancel, and goes.
  useEffect(() => {
    if (!signInUrl || editingEmail) return
    const t = setTimeout(() => {
      window.location.href = signInUrl
    }, 3000)
    return () => clearTimeout(t)
  }, [signInUrl, editingEmail])

  // Poll the checkout status endpoint until the webhook flips
  // user_settings.subscription_status to active. Bail out after ~30s.
  useEffect(() => {
    // Signed-out buyer: nothing to poll with. The claim effect above owns
    // that path until the magic link lands them back here signed in.
    if (!sessionId || (!authLoading && !user)) {
      setPolling(false)
      return
    }
    let cancelled = false
    let attempts = 0
    const poll = async () => {
      try {
        const data = await apiFetch<CheckoutStatus>(
          `/api/stripe/checkout?session_id=${encodeURIComponent(sessionId)}`,
        )
        if (cancelled) return
        setStatus(data)
        if (data.is_active) {
          setPolling(false)
          subscription.refresh()
          setActivated(true)
          return
        }
      } catch {
        // Soft-fail; we'll retry until the timeout below.
      }
      attempts += 1
      if (attempts < 15) {
        setTimeout(poll, 2000)
      } else if (!cancelled) {
        setPolling(false)
      }
    }
    poll()
    return () => {
      cancelled = true
    }
    // subscription.refresh / router are stable refs; we want this to fire once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  // Same gate and once-per-session guard as the Meta and Plausible tags, and
  // for the same reason: Mixpanel does not dedupe, so a refresh here would
  // count a second trial.
  useEffect(() => {
    if (!activated || !conversion.settled || !status || !sessionId) return
    const key = `rc_mixpanel_fired:${sessionId}`
    try {
      if (window.sessionStorage.getItem(key)) return
      window.sessionStorage.setItem(key, '1')
    } catch {
      // Storage unavailable. Fire rather than go quiet; see plausible-start-trial.
    }
    trackEvent('Trial Started', {
      tier: status.tier,
      status: status.status,
      claimed: claimState,
    })
    // status and claimState are settled by the time `activated` flips.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activated, conversion.settled, sessionId])

  // The bounce to /explore, held until the conversion question is answered.
  //
  // It used to fire two seconds after activation regardless, which cut off
  // whichever tag was still waiting on its own request. `settled` is guaranteed
  // to arrive within the hook's hard cap even if Stripe hangs or an ad blocker
  // eats the call, so this can delay the redirect but never prevent it.
  useEffect(() => {
    if (!activated || !conversion.settled) return
    // Still a moment to read the success state before leaving.
    const t = setTimeout(() => router.replace('/explore'), 2000)
    return () => clearTimeout(t)
    // router is a stable ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activated, conversion.settled])

  return (
    <div className="mx-auto flex max-w-lg flex-col px-6 py-12 md:py-16">
      {/* All render null. They share one resolved answer (useTrialConversion)
          and fire independently off it, so one network's config or failure
          cannot take another's reporting down. */}
      <MetaStartTrial conversion={conversion} />
      <GoogleStartTrial conversion={conversion} />
      <PlausibleStartTrial conversion={conversion} />
      <p className="font-rc-mono text-[10px] uppercase tracking-[0.14em] text-rc-ink-mute">
        ReelCaster Pro
      </p>

      <div
        className="mt-6 rounded-xl border border-rc-rule bg-rc-panel p-6 text-center shadow-rc-panel md:p-8"
        data-testid="billing-success"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-rc-good-border bg-rc-good-bg">
          <CheckCircle2 className="h-7 w-7 text-rc-good" />
        </div>
        <h1 className="mt-4 text-2xl font-black tracking-[-0.02em] text-rc-ink md:text-3xl">
          Welcome to ReelCaster Pro
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-rc-ink-soft">
          Your 14-day forecast, multi-species scoring, bathymetry layer, and expanded alerts are
          unlocking now.
        </p>

        {claimState === 'working' || claimState === 'created' ? (
          <div className="mt-6">
            {claimState === 'working' ? (
              <div className="inline-flex items-center gap-2 text-sm text-rc-ink-mute">
                <Loader2 className="h-4 w-4 animate-spin" />
                Setting up your account…
              </div>
            ) : (
              <div className="text-sm font-semibold text-rc-good-ink">
                All set. Taking you to Explore.
              </div>
            )}
            {claimEmail && sessionId ? (
              <AccountEmail
                email={claimEmail}
                sessionId={sessionId}
                editing={editingEmail}
                onEdit={() => setEditingEmail(true)}
                onDone={(next) => {
                  if (next) setClaimEmail(next)
                  setEditingEmail(false)
                }}
              />
            ) : null}
          </div>
        ) : claimState === 'emailed' ? (
          // Either the email already had an account (paying isn't proof of
          // owning an inbox) or the one-time handoff was already used.
          <div className="mt-6 text-sm leading-relaxed text-rc-ink-soft">
            Your subscription is active. We&apos;ve emailed{' '}
            {claimEmail ? (
              <>
                <span className="font-semibold text-rc-ink">{claimEmail}</span>{' '}
              </>
            ) : (
              'you '
            )}
            a sign-in link. Open it and you&apos;re in. No password needed.
          </div>
        ) : polling ? (
          <div className="mt-6 inline-flex items-center gap-2 text-sm text-rc-ink-mute">
            <Loader2 className="h-4 w-4 animate-spin" />
            Activating your account…
          </div>
        ) : status?.is_active ? (
          <div className="mt-6 text-sm font-semibold text-rc-good-ink">
            All set. Taking you to Explore.
          </div>
        ) : (
          <div className="mt-6 text-sm leading-relaxed text-rc-ink-soft">
            Stripe is still finalizing your subscription. You can{' '}
            <Link
              href="/explore"
              className="font-semibold text-rc-brand underline underline-offset-2 hover:text-rc-brand-hover"
            >
              head to Explore
            </Link>
            . Pro features unlock as soon as the webhook lands.
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * "Creating your account with <email>", with a way to change it.
 *
 * The buyer typed this address on Stripe's page, or their wallet supplied it,
 * and this is the account it becomes. The correction goes through the claim
 * route's PATCH, which moves the address on Stripe and on the account if the
 * webhook has already made one, so whichever order things land in the sign-in
 * link reaches the corrected inbox.
 */
function AccountEmail({
  email,
  sessionId,
  editing,
  onEdit,
  onDone,
}: {
  email: string
  sessionId: string
  editing: boolean
  onEdit: () => void
  /** Called with the saved address, or null on cancel. */
  onDone: (next: string | null) => void
}) {
  const [draft, setDraft] = useState(email)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(e: FormEvent) {
    e.preventDefault()
    const next = draft.trim().toLowerCase()
    if (!next || next === email.toLowerCase()) {
      onDone(null)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/stripe/claim', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, email: next }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(
          body?.error === 'email_taken' || body?.error === 'account_exists'
            ? 'That address already has an account. Sign in with it instead.'
            : body?.error === 'email_invalid'
              ? 'That does not look like an email address.'
              : 'Could not change the address. You can fix it in Settings after signing in.',
        )
        return
      }
      trackEvent('Checkout Email Corrected')
      onDone(body?.email ?? next)
    } catch {
      setError('Could not change the address. You can fix it in Settings after signing in.')
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <p className="mt-3 text-sm leading-relaxed text-rc-ink-soft">
        Creating your account with{' '}
        <span className="font-semibold text-rc-ink">{email}</span>.{' '}
        <button
          type="button"
          onClick={() => {
            setDraft(email)
            setError(null)
            onEdit()
          }}
          className="font-semibold text-rc-brand underline underline-offset-2 hover:text-rc-brand-hover"
        >
          Wrong email? Change it
        </button>
      </p>
    )
  }

  return (
    <form onSubmit={save} className="mt-3 text-left">
      <label
        htmlFor="claim-email"
        className="block text-sm font-semibold text-rc-ink"
      >
        Email for your account
      </label>
      <input
        id="claim-email"
        type="email"
        required
        autoComplete="email"
        inputMode="email"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        disabled={saving}
        className="mt-1.5 w-full rounded-lg border border-rc-rule bg-rc-surface px-3 py-2.5 text-base text-rc-ink placeholder:text-rc-ink-mute focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-2 disabled:opacity-60"
      />
      {error ? (
        <p role="alert" className="mt-2 text-xs text-rc-poor-ink">
          {error}
        </p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-10 flex-1 items-center justify-center rounded-md bg-rc-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-rc-brand-hover disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Use this email'}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => onDone(null)}
          className="inline-flex h-10 items-center justify-center rounded-md border border-rc-rule px-4 text-sm font-semibold text-rc-ink transition-colors hover:bg-rc-surface disabled:opacity-60"
        >
          Keep it
        </button>
      </div>
    </form>
  )
}

export default function BillingSuccessPage() {
  return (
    <Suspense fallback={null}>
      <BillingSuccessInner />
    </Suspense>
  )
}

'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { AuthForm } from '../components/auth/auth-form'
import { readNextParam } from '@/lib/next-param'
import LoginStandings from './login-standings'
import Link from 'next/link'
import Image from 'next/image'
import TrialModalButton from '@/app/components/paywall/trial-modal-button'

export default function LoginPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  // Track if user was already signed in when page loaded (not from form submit)
  const wasAlreadyAuthed = useRef(false)
  const initialLoadDone = useRef(false)

  useEffect(() => {
    if (!loading && !initialLoadDone.current) {
      initialLoadDone.current = true
      if (user) {
        wasAlreadyAuthed.current = true
      }
    }
  }, [loading, user])

  useEffect(() => {
    // Only redirect if user was already authenticated before page rendered
    // (e.g. navigated to /login while logged in). If they just signed in
    // via the form, the onSuccess callback handles navigation.
    if (!loading && user && wasAlreadyAuthed.current) {
      router.replace(readNextParam('/dashboard'))
    }
  }, [user, loading, router])

  if (loading || (user && wasAlreadyAuthed.current)) {
    return (
      <div className="fixed inset-0 bg-rc-page flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="flex gap-1">
            <span className="w-2 h-2 rounded-full bg-rc-brand animate-pulse" />
            <span className="w-2 h-2 rounded-full bg-rc-brand/70 animate-pulse [animation-delay:150ms]" />
            <span className="w-2 h-2 rounded-full bg-rc-brand/40 animate-pulse [animation-delay:300ms]" />
          </div>
          <p className="text-sm text-rc-ink-mute">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 flex bg-rc-panel">
      {/* LEFT — the sign-in form. Same AuthForm, no floating card / shadow. */}
      <div className="flex w-full flex-col justify-center overflow-y-auto px-6 py-10 sm:px-10 lg:w-1/2 xl:px-20">
        <div className="mx-auto w-full max-w-md">
          <div className="text-center">
            <Link href="/" aria-label="ReelCaster home" className="mx-auto flex w-fit">
              <Image
                src="/reelcaster-mark.svg"
                alt="ReelCaster"
                width={120}
                height={56}
                priority
              />
            </Link>

            <h1 className="mt-10 text-balance text-3xl font-black tracking-[-0.02em] text-rc-ink">
              Welcome back
            </h1>
            <p className="mt-2 text-pretty text-sm text-rc-ink-mute">
              Sign in to pick up right where you left off.
            </p>
          </div>

          <div className="mt-8">
            <AuthForm
              defaultMode="signin"
              source="login-page"
              onSuccess={() => router.push(readNextParam('/dashboard'))}
            />
          </div>

          <p className="mt-6 text-center text-sm text-rc-ink-mute">
            New to ReelCaster?{' '}
            {/* Same modal as every other signup entry. Someone who only
                wants a Member account gets it from the link at its foot, one
                click away, having seen what the tiers actually differ on. */}
            <TrialModalButton
              from="login-page"
              className="font-semibold text-rc-brand hover:text-rc-brand-hover transition-colors"
            >
              Create an account
            </TrialModalButton>
          </p>
        </div>
      </div>

      {/* RIGHT — "The Standings" (wide only). A sibling to the signup panel
          (same light rc-band ground, same hairline vocabulary, 4px corners) but
          deliberately left-aligned, not centered: a ranked ledger of the
          returning angler's saved spots. Rank 1 is "live now" (full card +
          window chart); the pack (rows 2–5) is compact and "waiting". The wide
          seam after rank 1 is the authored composition move. */}
      <div className="hidden w-1/2 flex-col justify-center border-l border-rc-rule bg-rc-band px-12 py-20 lg:flex xl:px-16">
        <div className="mx-auto w-full max-w-md">
          {/* Quiet header — subordinate to the standings below. */}
          <div className="text-center">
            <p className="font-rc-mono text-[11px] uppercase tracking-wider text-rc-ink-soft">
              Your spots, ranked
            </p>
            <h2 className="mt-3 text-2xl font-black tracking-[-0.02em] text-rc-ink">
              The water&apos;s waiting.
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-pretty text-sm leading-relaxed text-rc-ink-soft">
              Your spots, live scores, and the next great window are right where
              you left them.
            </p>
          </div>

          <div className="mt-6 border-t border-rc-rule" />

          {/* THE STANDINGS — live top-scored spots (graceful sample fallback). */}
          <LoginStandings />
        </div>
      </div>
    </div>
  )
}

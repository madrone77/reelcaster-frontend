'use client'

import { useEffect, useRef, useState } from 'react'
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
  /**
   * Sign-in and sign-up are one screen, switched in place rather than by
   * navigation. The door marked "Sign in" is where someone without an account
   * arrives, so it has to be able to make them one — for free, without being
   * handed the Pro plan matrix first. AuthForm already does both; it just took
   * its mode as a fixed prop, so the `key` below remounts it on the switch and
   * `defaultMode` lands as the new mode.
   */
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const signingUp = mode === 'signup'

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
              {signingUp ? 'Create your free account' : 'Welcome back'}
            </h1>
            <p className="mt-2 text-pretty text-sm text-rc-ink-mute">
              {signingUp
                ? 'No card. Join as a Member and see today\u2019s ReelCaster Score in under a minute.'
                : 'Sign in to pick up right where you left off.'}
            </p>
          </div>

          <div className="mt-8">
            <AuthForm
              key={mode}
              defaultMode={mode}
              source="login-page"
              onSuccess={() =>
                router.push(readNextParam(signingUp ? '/explore' : '/dashboard'))
              }
            />
          </div>

          {/* The free account is the offer on this line now. It used to open
              the trial modal, which puts a plan matrix in front of someone who
              only wanted to make an account; Pro keeps its own line below. */}
          <p className="mt-6 text-center text-sm text-rc-ink-mute">
            {signingUp ? (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('signin')}
                  className="font-semibold text-rc-brand hover:text-rc-brand-hover transition-colors"
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                New to ReelCaster?{' '}
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className="font-semibold text-rc-brand hover:text-rc-brand-hover transition-colors"
                >
                  Create a free account
                </button>
              </>
            )}
          </p>

          {/* This page is full-screen with no header, so without this line it
              would offer no route to Pro at all. Same `from` key as before, so
              the attribution on a trial opened from here is unchanged. */}
          <p className="mt-2 text-center text-xs text-rc-ink-mute">
            Want the full 14-day forecast?{' '}
            <TrialModalButton
              from="login-page"
              className="font-semibold text-rc-brand hover:text-rc-brand-hover transition-colors"
            >
              Start a free Pro trial
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
              {signingUp ? 'Scoring right now' : 'Your spots, ranked'}
            </p>
            <h2 className="mt-3 text-2xl font-black tracking-[-0.02em] text-rc-ink">
              The water&apos;s waiting.
            </h2>
            {/* A brand-new account has no spots yet, so the returning-angler
                line would be a promise about something they have never seen. */}
            <p className="mx-auto mt-2 max-w-sm text-pretty text-sm leading-relaxed text-rc-ink-soft">
              {signingUp
                ? 'Live scores on the water we cover. Save the ones you fish and they show up here.'
                : 'Your spots, live scores, and the next great window are right where you left them.'}
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

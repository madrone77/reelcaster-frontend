'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/auth-context'
import { useAnalytics } from '@/hooks/use-analytics'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Mail, CheckCircle, User } from 'lucide-react'

interface AuthFormProps {
  defaultMode?: 'signin' | 'signup'
  onSuccess?: () => void
  source?: string
  className?: string
}

export function AuthForm({ defaultMode = 'signin', onSuccess, source = 'auth-form', className }: AuthFormProps) {
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot' | 'magic'>(defaultMode)
  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const {
    signIn,
    signUp,
    signInWithGoogle,
    signInWithMagicLink,
    resetPasswordForEmail,
    resendConfirmation,
  } = useAuth()
  const { trackEvent } = useAnalytics()
  const [googleLoading, setGoogleLoading] = useState(false)
  /**
   * Set when sign-in fails with `email_not_confirmed`: the account exists and
   * the password was right, so this is not a credentials error and must not be
   * shown as one. It is an angler standing at a locked door holding the key.
   */
  const [unconfirmedEmail, setUnconfirmedEmail] = useState('')
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const [resendError, setResendError] = useState('')
  /** Seconds until another send is allowed. Supabase rate-limits per address. */
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown(seconds => seconds - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const handleGoogle = async () => {
    setError('')
    setGoogleLoading(true)
    try {
      const { error } = await signInWithGoogle()
      if (error) {
        setError(error.message)
        setGoogleLoading(false)
        return
      }
      trackEvent('Sign In', {
        method: 'google',
        source,
        timestamp: new Date().toISOString(),
      })
      // Browser is redirecting to Google — keep button in loading state.
    } catch {
      setError('Could not start Google sign-in')
      setGoogleLoading(false)
    }
  }

  /**
   * Wraps the context call with copy a person can act on. `otp_disabled` comes
   * back when no account matches the address, which on a sign-in screen means
   * a typo far more often than it means anything else.
   */
  const sendMagicLink = async (target: string): Promise<{ error: string | null }> => {
    const { error } = await signInWithMagicLink(target)
    if (!error) return { error: null }
    return {
      error:
        error.code === 'otp_disabled'
          ? 'No ReelCaster account uses that address. Check the spelling, or create an account.'
          : error.message,
    }
  }

  /**
   * The escape hatch on the locked-out panel. A magic link confirms the address
   * on the way through, so this both unlocks the account and signs them in,
   * without them ever finding the original confirmation email.
   */
  const handleMagicUnlock = async () => {
    if (!unconfirmedEmail || resending) return
    setResending(true)
    setResendError('')
    const { error } = await sendMagicLink(unconfirmedEmail)
    setResending(false)
    if (error) {
      setResendError(error)
      return
    }
    trackEvent('Magic Link Requested', {
      source,
      timestamp: new Date().toISOString(),
    })
    // Reuse the check-your-email screen, in its magic-link wording.
    setMode('magic')
    setSuccess(true)
  }

  const handleResend = async () => {
    // The signup screen keeps the address in `email`; the locked-out screen
    // parks it in `unconfirmedEmail` so a stray edit to the field cannot send
    // the link somewhere else.
    const target = unconfirmedEmail || email
    if (!target || resending || cooldown > 0) return

    setResending(true)
    setResendError('')
    try {
      const { error } = await resendConfirmation(target)
      if (error) {
        setResendError(
          error.code === 'over_email_send_rate_limit'
            ? 'We just sent one. Give it a minute, then try again.'
            : error.message,
        )
      } else {
        setResent(true)
        trackEvent('Confirmation Resent', {
          source,
          timestamp: new Date().toISOString(),
        })
      }
    } catch {
      setResendError('Could not send the email. Try again in a moment.')
    } finally {
      // Cooldown runs either way. A failed send still cost an attempt against
      // the server-side limit, and hammering the button cannot help.
      setCooldown(60)
      setResending(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setUnconfirmedEmail('')
    setSuccess(false)
    setLoading(true)

    try {
      if (mode === 'forgot') {
        const { error } = await resetPasswordForEmail(email)
        if (error) {
          setError(error.message)
        } else {
          setSuccess(true)
          trackEvent('Password Reset Requested', {
            source,
            timestamp: new Date().toISOString(),
          })
        }
      } else if (mode === 'magic') {
        const { error } = await sendMagicLink(email)
        if (error) {
          setError(error)
        } else {
          setSuccess(true)
          trackEvent('Magic Link Requested', {
            source,
            timestamp: new Date().toISOString(),
          })
        }
      } else if (mode === 'signup') {
        const { error, session } = await signUp(email, password, firstName)

        if (error) {
          setError(error.message)
        } else {
          trackEvent('Sign Up', {
            method: 'email',
            source,
            timestamp: new Date().toISOString(),
          })
          if (session) {
            // Email confirmation is off — the account is live and logged in,
            // so drop the user straight into the app instead of the
            // (misleading) check-your-email screen.
            onSuccess?.()
            setFirstName('')
            setEmail('')
            setPassword('')
          } else {
            // Confirmation required — a link was emailed.
            setSuccess(true)
          }
        }
      } else {
        const { error } = await signIn(email, password)

        if (error?.code === 'email_not_confirmed') {
          // Not a bad password. The account was never activated, so offer the
          // one thing that fixes it instead of a dead-end error string.
          setUnconfirmedEmail(email)
          setResent(false)
          setResendError('')
        } else if (error) {
          setError(error.message)
        } else {
          trackEvent('Sign In', {
            method: 'email',
            source,
            timestamp: new Date().toISOString(),
          })
          onSuccess?.()
          setEmail('')
          setPassword('')
        }
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  /** Screens that ask for an address and nothing else. */
  const emailOnly = mode === 'forgot' || mode === 'magic'

  const resetForm = () => {
    setEmail('')
    setPassword('')
    setError('')
    setSuccess(false)
    setUnconfirmedEmail('')
    setResent(false)
    setResendError('')
  }

  if (success) {
    return (
      <div className={className}>
        <div className="flex flex-col items-center text-center space-y-3 py-4">
          <CheckCircle className="h-12 w-12 text-rc-good" />
          <h3 className="font-semibold text-rc-ink text-lg">Check Your Email!</h3>
          <p className="text-sm text-rc-ink-soft">
            We&apos;ve sent a{' '}
            {mode === 'forgot' ? 'password reset' : mode === 'magic' ? 'sign-in' : 'confirmation'}{' '}
            link to <span className="font-medium text-rc-ink">{email}</span>
          </p>
          <p className="text-xs text-rc-ink-mute">
            {mode === 'forgot'
              ? 'Click the link in the email to reset your password'
              : mode === 'magic'
                ? 'Click the link in the email and you are straight in, no password needed'
                : 'Click the link in the email to activate your account'}
          </p>
          {mode === 'signup' && (
            <ResendConfirmation
              onResend={handleResend}
              resending={resending}
              resent={resent}
              error={resendError}
              cooldown={cooldown}
              prompt="No email after a few minutes? Check your spam folder, or"
            />
          )}
          {(mode === 'forgot' || mode === 'magic') && (
            <button
              type="button"
              onClick={() => {
                setMode('signin')
                resetForm()
              }}
              className="text-sm text-rc-brand hover:text-rc-brand-hover transition-colors mt-2"
            >
              Back to Sign In
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert variant="destructive" className="border-rc-poor/30 bg-rc-poor-bg text-sm">
            <AlertDescription className="text-rc-poor-ink">{error}</AlertDescription>
          </Alert>
        )}

        {unconfirmedEmail && (
          <div className="rounded-md border border-rc-rule bg-rc-surface p-3 space-y-2">
            <p className="text-sm font-medium text-rc-ink">Confirm your email first</p>
            <p className="text-xs text-rc-ink-soft">
              Your account is set up, but the link we sent to{' '}
              <span className="font-medium text-rc-ink">{unconfirmedEmail}</span> was never opened.
              Click it and you are in, with the password you already chose.
            </p>
            <ResendConfirmation
              onResend={handleResend}
              resending={resending}
              resent={resent}
              error={resendError}
              cooldown={cooldown}
              prompt="Cannot find it? Check your spam folder, or"
            />
            <p className="text-xs text-rc-ink-mute">
              Still nothing?{' '}
              <button
                type="button"
                onClick={handleMagicUnlock}
                disabled={resending}
                className="text-rc-brand hover:text-rc-brand-hover transition-colors underline underline-offset-2 disabled:text-rc-ink-mute disabled:no-underline"
              >
                Email me a sign-in link instead
              </button>
              , which gets you in without the confirmation.
            </p>
          </div>
        )}

        {!emailOnly && (
          <>
            <button
              type="button"
              onClick={handleGoogle}
              disabled={loading || googleLoading}
              className="w-full h-11 rounded-md text-sm font-medium bg-rc-panel border border-rc-rule text-rc-ink hover:bg-rc-surface transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {googleLoading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-rc-ink border-t-transparent" />
              ) : (
                <GoogleGlyph />
              )}
              <span>{mode === 'signin' ? 'Sign in with Google' : 'Sign up with Google'}</span>
            </button>

            {/* Facebook sign-in is hidden until the Facebook provider is enabled
                in the Supabase dashboard. Until then /auth/v1/authorize?provider=facebook
                400s and the click just dumps the angler on a JSON error page.
                Re-add this button (and the handler in auth-context) once it's on. */}

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-rc-rule" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-rc-panel px-2 text-rc-ink-mute">Or</span>
              </div>
            </div>
          </>
        )}

        {mode === 'signup' && (
          <div className="space-y-2">
            <Label htmlFor={`${source}-first-name`} className="text-sm font-medium text-rc-ink">
              First name
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-rc-ink-mute" />
              <Input
                id={`${source}-first-name`}
                type="text"
                autoComplete="given-name"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="Your first name"
                required
                disabled={loading}
                className="pl-10 bg-rc-panel border-rc-rule text-rc-ink placeholder:text-rc-ink-mute focus-visible:border-rc-brand focus-visible:ring-rc-brand/25"
              />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor={`${source}-email`} className="text-sm font-medium text-rc-ink">
            Email address
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-rc-ink-mute" />
            <Input
              id={`${source}-email`}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="angler@example.com"
              required
              disabled={loading}
              className="pl-10 bg-rc-panel border-rc-rule text-rc-ink placeholder:text-rc-ink-mute focus-visible:border-rc-brand focus-visible:ring-rc-brand/25"
            />
          </div>
        </div>

        {!emailOnly && (
          <div className="space-y-2">
            <Label htmlFor={`${source}-password`} className="text-sm font-medium text-rc-ink">
              Password
            </Label>
            <Input
              id={`${source}-password`}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={loading}
              minLength={6}
              className="bg-rc-panel border-rc-rule text-rc-ink placeholder:text-rc-ink-mute focus-visible:border-rc-brand focus-visible:ring-rc-brand/25"
            />
            <div className="flex items-center justify-between">
              {mode === 'signup' && <p className="text-xs text-rc-ink-mute">Minimum 6 characters</p>}
              {mode === 'signin' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot')
                      resetForm()
                    }}
                    className="mr-auto text-xs text-rc-brand hover:text-rc-brand-hover transition-colors"
                  >
                    Forgot password?
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const carried = email
                      setMode('magic')
                      resetForm()
                      // Keep whatever they already typed. Making someone retype
                      // their address to try the other door is a small insult.
                      setEmail(carried)
                    }}
                    className="text-xs text-rc-brand hover:text-rc-brand-hover transition-colors"
                  >
                    Email me a link instead
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        <Button
          type="submit"
          className="w-full h-11 font-bold bg-rc-brand hover:bg-rc-brand-hover text-white"
          disabled={loading}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Processing...
            </span>
          ) : mode === 'forgot' ? (
            'Send Reset Link'
          ) : mode === 'magic' ? (
            'Send Sign-In Link'
          ) : mode === 'signin' ? (
            'Sign In'
          ) : (
            'Create Account'
          )}
        </Button>

        {/* Mode switching for sign-in ⇄ sign-up is handled by the page-level
            "Already have an account? / Create an account" link, so no switch
            button here. Forgot-password still needs a way back, so keep it. */}
        {emailOnly && (
          <>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-rc-rule" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-rc-panel px-2 text-rc-ink-mute">
                  {mode === 'magic' ? 'Rather use your password?' : 'Remember your password?'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setMode('signin')
                resetForm()
              }}
              disabled={loading}
              className="w-full h-11 rounded-md text-sm font-medium bg-rc-panel border border-rc-rule text-rc-ink hover:bg-rc-surface transition-colors disabled:opacity-50"
            >
              Back to Sign In
            </button>
          </>
        )}
      </form>
    </div>
  )
}

/**
 * "Send it again" for a confirmation link, used both right after signup and
 * on the locked-out sign-in. Stateless: the parent owns the send and the
 * cooldown, so both call sites share one rate limit rather than each keeping
 * their own count of what the server has already been asked to do.
 */
function ResendConfirmation({
  onResend,
  resending,
  resent,
  error,
  cooldown,
  prompt,
}: {
  onResend: () => void
  resending: boolean
  resent: boolean
  error: string
  cooldown: number
  prompt: string
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-rc-ink-mute">
        {prompt}{' '}
        <button
          type="button"
          onClick={onResend}
          disabled={resending || cooldown > 0}
          className="text-rc-brand hover:text-rc-brand-hover transition-colors underline underline-offset-2 disabled:text-rc-ink-mute disabled:no-underline"
        >
          {resending
            ? 'sending...'
            : cooldown > 0
              ? `send it again in ${cooldown}s`
              : 'send it again'}
        </button>
      </p>
      {resent && !error && (
        <p className="text-xs text-rc-good">Sent. It should land within a minute.</p>
      )}
      {error && <p className="text-xs text-rc-poor-ink">{error}</p>}
    </div>
  )
}

function GoogleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M9 3.48c1.69 0 2.83.73 3.48 1.34l2.54-2.48C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l2.91 2.26C4.6 5.05 6.62 3.48 9 3.48z"
      />
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.74-.06-1.28-.19-1.84H9v3.34h4.96c-.1.83-.64 2.08-1.84 2.92l2.84 2.2c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#FBBC05"
        d="M3.88 10.78A5.54 5.54 0 0 1 3.58 9c0-.62.11-1.22.29-1.78L.96 4.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l2.92-2.26z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.84-2.2c-.76.53-1.78.9-3.12.9-2.38 0-4.4-1.57-5.12-3.74L.97 13.04C2.45 15.98 5.48 18 9 18z"
      />
    </svg>
  )
}

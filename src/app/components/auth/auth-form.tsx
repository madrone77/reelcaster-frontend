'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/auth-context'
import { useAnalytics } from '@/hooks/use-analytics'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Mail, CheckCircle } from 'lucide-react'

interface AuthFormProps {
  defaultMode?: 'signin' | 'signup'
  onSuccess?: () => void
  source?: string
  className?: string
}

export function AuthForm({ defaultMode = 'signin', onSuccess, source = 'auth-form', className }: AuthFormProps) {
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>(defaultMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const { signIn, signUp, signInWithGoogle, signInWithFacebook, resetPasswordForEmail } = useAuth()
  const { trackEvent } = useAnalytics()
  const [googleLoading, setGoogleLoading] = useState(false)
  const [facebookLoading, setFacebookLoading] = useState(false)

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

  const handleFacebook = async () => {
    setError('')
    setFacebookLoading(true)
    try {
      const { error } = await signInWithFacebook()
      if (error) {
        setError(error.message)
        setFacebookLoading(false)
        return
      }
      trackEvent('Sign In', {
        method: 'facebook',
        source,
        timestamp: new Date().toISOString(),
      })
      // Browser is redirecting to Facebook — keep button in loading state.
    } catch {
      setError('Could not start Facebook sign-in')
      setFacebookLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
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
      } else if (mode === 'signup') {
        const { error, session } = await signUp(email, password)

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
            setEmail('')
            setPassword('')
          } else {
            // Confirmation required — a link was emailed.
            setSuccess(true)
          }
        }
      } else {
        const { error } = await signIn(email, password)

        if (error) {
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

  const resetForm = () => {
    setEmail('')
    setPassword('')
    setError('')
    setSuccess(false)
  }

  if (success) {
    return (
      <div className={className}>
        <div className="flex flex-col items-center text-center space-y-3 py-4">
          <CheckCircle className="h-12 w-12 text-rc-good" />
          <h3 className="font-semibold text-rc-ink text-lg">Check Your Email!</h3>
          <p className="text-sm text-rc-ink-soft">
            We&apos;ve sent a {mode === 'forgot' ? 'password reset' : 'confirmation'} link to <span className="font-medium text-rc-ink">{email}</span>
          </p>
          <p className="text-xs text-rc-ink-mute">
            {mode === 'forgot'
              ? 'Click the link in the email to reset your password'
              : 'Click the link in the email to activate your account'}
          </p>
          {mode === 'forgot' && (
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

        {mode !== 'forgot' && (
          <>
            <button
              type="button"
              onClick={handleGoogle}
              disabled={loading || googleLoading || facebookLoading}
              className="w-full h-11 rounded-md text-sm font-medium bg-rc-panel border border-rc-rule text-rc-ink hover:bg-rc-surface transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {googleLoading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-rc-ink border-t-transparent" />
              ) : (
                <GoogleGlyph />
              )}
              <span>{mode === 'signin' ? 'Sign in with Google' : 'Sign up with Google'}</span>
            </button>

            <button
              type="button"
              onClick={handleFacebook}
              disabled={loading || googleLoading || facebookLoading}
              className="w-full h-11 rounded-md text-sm font-medium bg-rc-panel border border-rc-rule text-rc-ink hover:bg-rc-surface transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {facebookLoading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-rc-ink border-t-transparent" />
              ) : (
                <FacebookGlyph />
              )}
              <span>{mode === 'signin' ? 'Sign in with Facebook' : 'Sign up with Facebook'}</span>
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-rc-rule" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-rc-panel px-2 text-rc-ink-mute">or continue with email</span>
              </div>
            </div>
          </>
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

        {mode !== 'forgot' && (
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
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot')
                    resetForm()
                  }}
                  className="ml-auto text-xs text-rc-brand hover:text-rc-brand-hover transition-colors"
                >
                  Forgot password?
                </button>
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
          ) : mode === 'signin' ? (
            'Sign In'
          ) : (
            'Create Account'
          )}
        </Button>

        {/* Mode switching for sign-in ⇄ sign-up is handled by the page-level
            "Already have an account? / Create an account" link, so no switch
            button here. Forgot-password still needs a way back, so keep it. */}
        {mode === 'forgot' && (
          <>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-rc-rule" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-rc-panel px-2 text-rc-ink-mute">Remember your password?</span>
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

function FacebookGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#1877F2"
        d="M18 9a9 9 0 1 0-10.41 8.89v-6.29H5.31V9h2.28V7.02c0-2.25 1.34-3.5 3.4-3.5.98 0 2.01.18 2.01.18v2.22h-1.13c-1.12 0-1.47.69-1.47 1.4V9h2.5l-.4 2.6h-2.1v6.29A9 9 0 0 0 18 9z"
      />
    </svg>
  )
}

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
  const { signIn, signUp, signInWithGoogle, resetPasswordForEmail } = useAuth()
  const { trackEvent } = useAnalytics()
  const [googleLoading, setGoogleLoading] = useState(false)

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
      } else {
        const { error } = mode === 'signin' ? await signIn(email, password) : await signUp(email, password)

        if (error) {
          setError(error.message)
        } else {
          if (mode === 'signup') {
            setSuccess(true)
            trackEvent('Sign Up', {
              method: 'email',
              source,
              timestamp: new Date().toISOString(),
            })
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

  const switchMode = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin')
    resetForm()
  }

  if (success) {
    return (
      <div className={className}>
        <div className="flex flex-col items-center text-center space-y-3 py-4">
          <CheckCircle className="h-12 w-12 text-emerald-400" />
          <h3 className="font-semibold text-rc-text text-lg">Check Your Email!</h3>
          <p className="text-sm text-rc-text-light">
            We&apos;ve sent a {mode === 'forgot' ? 'password reset' : 'confirmation'} link to <span className="font-medium text-rc-text">{email}</span>
          </p>
          <p className="text-xs text-rc-text-muted">
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
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors mt-2"
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
          <Alert variant="destructive" className="border-red-500/50 bg-red-500/10 text-sm">
            <AlertDescription className="text-red-400">{error}</AlertDescription>
          </Alert>
        )}

        {mode !== 'forgot' && (
          <>
            <button
              type="button"
              onClick={handleGoogle}
              disabled={loading || googleLoading}
              className="w-full h-11 rounded-md text-sm font-medium bg-rc-bg-light border border-rc-bg-light text-rc-text hover:bg-rc-bg-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {googleLoading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-rc-text border-t-transparent" />
              ) : (
                <GoogleGlyph />
              )}
              <span>{mode === 'signin' ? 'Sign in with Google' : 'Sign up with Google'}</span>
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-rc-bg-light" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-rc-bg-dark px-2 text-rc-text-muted">or continue with email</span>
              </div>
            </div>
          </>
        )}

        <div className="space-y-2">
          <Label htmlFor={`${source}-email`} className="text-sm font-medium text-rc-text">
            Email address
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-rc-text-muted" />
            <Input
              id={`${source}-email`}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="angler@example.com"
              required
              disabled={loading}
              className="pl-10"
            />
          </div>
        </div>

        {mode !== 'forgot' && (
          <div className="space-y-2">
            <Label htmlFor={`${source}-password`} className="text-sm font-medium text-rc-text">
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
            />
            <div className="flex items-center justify-between">
              {mode === 'signup' && <p className="text-xs text-rc-text-muted">Minimum 6 characters</p>}
              {mode === 'signin' && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot')
                    resetForm()
                  }}
                  className="ml-auto text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Forgot password?
                </button>
              )}
            </div>
          </div>
        )}

        <Button
          type="submit"
          className="w-full h-11 font-medium bg-blue-600 hover:bg-blue-700 text-rc-text"
          disabled={loading}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-rc-text border-t-transparent" />
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

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-rc-bg-light" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-rc-bg-dark px-2 text-rc-text-muted">
              {mode === 'forgot' ? 'Remember your password?' : mode === 'signin' ? 'New to ReelCaster?' : 'Already have an account?'}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            if (mode === 'forgot') {
              setMode('signin')
              resetForm()
            } else {
              switchMode()
            }
          }}
          disabled={loading}
          className="w-full h-11 rounded-md text-sm font-medium bg-rc-bg-light border border-rc-bg-light text-rc-text hover:bg-rc-bg-dark transition-colors disabled:opacity-50"
        >
          {mode === 'forgot' ? 'Back to Sign In' : mode === 'signin' ? 'Create an Account' : 'Sign In Instead'}
        </button>
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

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
  const [mode, setMode] = useState<'signin' | 'signup'>(defaultMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const { signIn, signUp } = useAuth()
  const { trackEvent } = useAnalytics()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)
    setLoading(true)

    try {
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
            We&apos;ve sent a confirmation link to <span className="font-medium text-rc-text">{email}</span>
          </p>
          <p className="text-xs text-rc-text-muted">
            Click the link in the email to activate your account
          </p>
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
          {mode === 'signup' && <p className="text-xs text-rc-text-muted">Minimum 6 characters</p>}
        </div>

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
              {mode === 'signin' ? 'New to ReelCaster?' : 'Already have an account?'}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={switchMode}
          disabled={loading}
          className="w-full h-11 rounded-md text-sm font-medium bg-rc-bg-light border border-rc-bg-light text-rc-text hover:bg-rc-bg-dark transition-colors disabled:opacity-50"
        >
          {mode === 'signin' ? 'Create an Account' : 'Sign In Instead'}
        </button>
      </form>
    </div>
  )
}

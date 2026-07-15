'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { useAnalytics } from '@/hooks/use-analytics'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Fish, CheckCircle, Lock } from 'lucide-react'

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const { user, updatePassword } = useAuth()
  const { trackEvent } = useAnalytics()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const { error } = await updatePassword(newPassword)
      if (error) {
        setError(error.message)
      } else {
        setSuccess(true)
        trackEvent('Password Reset Completed', {
          timestamp: new Date().toISOString(),
        })
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="fixed inset-0 bg-rc-bg-darkest flex items-center justify-center overflow-y-auto">
        <div className="w-full max-w-md mx-auto px-4 py-8 sm:py-12">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-3">
              <div className="p-2 rounded-xl bg-blue-600/20">
                <Fish className="h-6 w-6 text-blue-400" />
              </div>
              <h1 className="text-2xl font-bold text-rc-text">ReelCaster</h1>
            </div>
          </div>

          <div className="bg-rc-bg-dark border border-rc-bg-light rounded-2xl p-6">
            <div className="flex flex-col items-center text-center space-y-3 py-4">
              <CheckCircle className="h-12 w-12 text-emerald-400" />
              <h3 className="font-semibold text-rc-text text-lg">Password Updated!</h3>
              <p className="text-sm text-rc-text-light">
                Your password has been successfully reset.
              </p>
              <Button
                onClick={() => router.replace('/')}
                className="w-full h-11 font-medium bg-blue-600 hover:bg-blue-700 text-rc-text mt-4"
              >
                Continue to ReelCaster
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="fixed inset-0 bg-rc-bg-darkest flex items-center justify-center overflow-y-auto">
        <div className="w-full max-w-md mx-auto px-4 py-8 sm:py-12">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-3">
              <div className="p-2 rounded-xl bg-blue-600/20">
                <Fish className="h-6 w-6 text-blue-400" />
              </div>
              <h1 className="text-2xl font-bold text-rc-text">ReelCaster</h1>
            </div>
          </div>

          <div className="bg-rc-bg-dark border border-rc-bg-light rounded-2xl p-6">
            <div className="flex flex-col items-center text-center space-y-3 py-4">
              <Lock className="h-12 w-12 text-rc-text-muted" />
              <h3 className="font-semibold text-rc-text text-lg">Invalid or Expired Link</h3>
              <p className="text-sm text-rc-text-light">
                This password reset link is no longer valid. Please request a new one.
              </p>
              <Button
                onClick={() => router.replace('/login')}
                className="w-full h-11 font-medium bg-blue-600 hover:bg-blue-700 text-rc-text mt-4"
              >
                Request New Link
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-rc-bg-darkest flex items-center justify-center overflow-y-auto">
      <div className="w-full max-w-md mx-auto px-4 py-8 sm:py-12">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="p-2 rounded-xl bg-blue-600/20">
              <Fish className="h-6 w-6 text-blue-400" />
            </div>
            <h1 className="text-2xl font-bold text-rc-text">ReelCaster</h1>
          </div>
          <p className="text-sm text-rc-text-muted">Set your new password</p>
        </div>

        <div className="bg-rc-bg-dark border border-rc-bg-light rounded-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive" className="border-red-500/50 bg-red-500/10 text-sm">
                <AlertDescription className="text-red-400">{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="new-password" className="text-sm font-medium text-rc-text">
                New Password
              </Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
                minLength={6}
              />
              <p className="text-xs text-rc-text-muted">Minimum 6 characters</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-sm font-medium text-rc-text">
                Confirm Password
              </Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
                minLength={6}
              />
            </div>

            <Button
              type="submit"
              className="w-full h-11 font-medium bg-blue-600 hover:bg-blue-700 text-rc-text"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-rc-text border-t-transparent" />
                  Updating...
                </span>
              ) : (
                'Reset Password'
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

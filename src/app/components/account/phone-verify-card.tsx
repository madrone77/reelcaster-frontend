'use client'

import { useState, useEffect } from 'react'
import { Phone, CheckCircle2, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useSubscription } from '@/hooks/use-subscription'
import { supabase } from '@/lib/supabase'

const E164_RE = /^\+[1-9]\d{7,14}$/

export default function PhoneVerifyCard() {
  const { phoneE164, phoneVerified, loading, refresh } = useSubscription()

  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'enter-phone' | 'enter-code'>('enter-phone')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [smsAvailable, setSmsAvailable] = useState<boolean | null>(null)

  useEffect(() => {
    if (phoneE164) setPhone(phoneE164)
  }, [phoneE164])

  // Probe verify configuration once
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/alerts/verify-phone')
        const body = await res.json()
        if (!cancelled) setSmsAvailable(!!body.configured)
      } catch {
        if (!cancelled) setSmsAvailable(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleSendCode = async () => {
    setError(null)
    setInfo(null)
    if (!E164_RE.test(phone)) {
      setError('Enter a phone number in E.164 format (e.g. +15551234567)')
      return
    }
    setBusy(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not signed in')
      const res = await fetch('/api/alerts/verify-phone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ phone }),
      })
      const body = await res.json()
      if (!res.ok) {
        if (res.status === 503) {
          setSmsAvailable(false)
          throw new Error(
            "We can't send verification texts at the moment. Try again shortly.",
          )
        }
        throw new Error(body.error ?? 'Failed to send code')
      }
      setStep('enter-code')
      setInfo(`We sent a code to ${phone}. It may take a minute to arrive.`)
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send code')
    } finally {
      setBusy(false)
    }
  }

  const handleConfirmCode = async () => {
    setError(null)
    setInfo(null)
    if (!code || code.length < 4) {
      setError('Enter the verification code')
      return
    }
    setBusy(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not signed in')
      const res = await fetch('/api/alerts/verify-phone', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ phone, code }),
      })
      const body = await res.json()
      if (!res.ok || !body.approved) {
        throw new Error(body.error ?? 'Invalid or expired code')
      }
      setInfo('Phone number verified. SMS alerts are ready when delivery launches.')
      setCode('')
      setStep('enter-phone')
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not verify code')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="border-rc-rule shadow-none">
      <CardHeader className="pb-6">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-rc-brand-soft rounded-full flex items-center justify-center">
            <Phone className="h-5 w-5 text-rc-brand" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-rc-ink text-xl">SMS Alerts</CardTitle>
            <CardDescription className="text-rc-ink-mute mt-1">
              Verify your phone to receive Score Alerts via text
            </CardDescription>
          </div>
          {!loading && phoneVerified && (
            <Badge variant="secondary" className="bg-rc-good-bg text-rc-good-ink border-rc-good-border">
              <CheckCircle2 className="h-3 w-3 mr-1" /> Verified
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {smsAvailable === false && (
          <div className="bg-rc-fair-bg border border-rc-fair-border rounded-md p-3 text-sm text-rc-fair-ink">
            SMS delivery launches with Pro. You can save your phone now and we&apos;ll
            switch it on the moment it&apos;s ready.
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="phone-input" className="text-rc-ink">
            Phone number
          </Label>
          <Input
            id="phone-input"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+15551234567"
            disabled={busy || step === 'enter-code'}
          />
          <p className="text-xs text-rc-ink-mute">
            E.164 format with country code (e.g. <code>+15551234567</code>).
          </p>
        </div>

        {step === 'enter-code' && (
          <div className="space-y-2">
            <Label htmlFor="phone-code" className="text-rc-ink">
              Verification code
            </Label>
            <Input
              id="phone-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="123456"
            />
          </div>
        )}

        {error && (
          <div className="bg-rc-poor-bg border border-rc-poor/40 rounded-md p-3 text-sm text-rc-poor-ink">
            {error}
          </div>
        )}
        {info && (
          <div className="bg-rc-brand-soft border border-rc-brand-soft2 rounded-md p-3 text-sm text-rc-brand">
            {info}
          </div>
        )}

        <div className="flex gap-2">
          {step === 'enter-phone' ? (
            <Button
              onClick={handleSendCode}
              disabled={busy || !phone || smsAvailable === false}
              className="flex-1 bg-rc-brand hover:bg-rc-brand-hover text-white"
            >
              {busy ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending…
                </>
              ) : phoneVerified ? (
                'Update phone'
              ) : (
                'Send verification code'
              )}
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setStep('enter-phone')
                  setCode('')
                  setError(null)
                }}
                disabled={busy}
                className="border-rc-rule text-rc-ink-soft hover:bg-rc-surface"
              >
                Back
              </Button>
              <Button
                onClick={handleConfirmCode}
                disabled={busy || code.length < 4}
                className="flex-1 bg-rc-brand hover:bg-rc-brand-hover text-white"
              >
                {busy ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying…
                  </>
                ) : (
                  'Confirm code'
                )}
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

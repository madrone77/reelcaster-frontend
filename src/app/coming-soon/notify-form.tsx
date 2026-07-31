'use client'

import { useState } from 'react'

type Status = 'idle' | 'submitting' | 'done' | 'error'

export default function NotifyForm() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (status === 'submitting') return
    setStatus('submitting')
    try {
      const res = await fetch('/api/launch-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      setStatus(res.ok ? 'done' : 'error')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'done') {
    return (
      <p className="text-sm sm:text-base text-white/90 tracking-wide">
        You&rsquo;re on the list. We&rsquo;ll be in touch at launch.
      </p>
    )
  }

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-2">
      <form
        onSubmit={handleSubmit}
        className="flex w-full flex-col items-center gap-3 sm:flex-row"
      >
        <input
          type="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (status === 'error') setStatus('idle')
          }}
          placeholder="you@email.com"
          aria-label="Email address"
          className="w-full flex-1 rounded-md border border-white/40 bg-white/10 px-4 py-2.5 text-white placeholder-white/50 outline-none transition-colors focus:border-white focus:bg-white/15"
        />
        <button
          type="submit"
          disabled={status === 'submitting'}
          className="w-full rounded-md bg-white px-5 py-2.5 font-semibold text-[#1F40E0] transition-opacity hover:opacity-90 disabled:opacity-60 sm:w-auto"
          style={{ fontFamily: 'var(--font-geist-sans), sans-serif' }}
        >
          {status === 'submitting' ? 'Joining…' : 'Notify me'}
        </button>
      </form>
      {status === 'error' && (
        <p className="text-sm text-white/90">Something went wrong. Try again.</p>
      )}
    </div>
  )
}

'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'

const PUBLIC_PREFIXES = ['/login', '/signup', '/auth/', '/fishing', '/pricing', '/explore']

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  const isPublicRoute = PUBLIC_PREFIXES.some(p => pathname.startsWith(p))

  useEffect(() => {
    if (!loading && !user && !isPublicRoute) {
      router.replace('/login')
    }
  }, [loading, user, isPublicRoute, router])

  if (loading) {
    return (
      <div className="fixed inset-0 bg-rc-bg-darkest flex items-center justify-center z-[9998]">
        <div className="flex flex-col items-center gap-3">
          <div className="flex gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse [animation-delay:150ms]" />
            <span className="w-2 h-2 rounded-full bg-blue-300 animate-pulse [animation-delay:300ms]" />
          </div>
          <p className="text-sm text-rc-text-muted">Loading...</p>
        </div>
      </div>
    )
  }

  if (isPublicRoute) {
    return <>{children}</>
  }

  if (!user) {
    // Redirecting to /login — show spinner
    return (
      <div className="fixed inset-0 bg-rc-bg-darkest flex items-center justify-center z-[9998]">
        <div className="flex flex-col items-center gap-3">
          <div className="flex gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse [animation-delay:150ms]" />
            <span className="w-2 h-2 rounded-full bg-blue-300 animate-pulse [animation-delay:300ms]" />
          </div>
          <p className="text-sm text-rc-text-muted">Redirecting...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

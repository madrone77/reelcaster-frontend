'use client'

import Link from 'next/link'
import { User, SlidersHorizontal, Ruler, ChevronRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { storedFirstName } from '@/lib/display-name'
import ExploreTopBar from '@/app/explore/components/explore-top-bar'

// The profile page is now a hub: the settings it used to hold in one long
// scroll are split into three focused routes. Each row states what lives there.
const SETTINGS: Array<{
  href: string
  label: string
  description: string
  Icon: LucideIcon
}> = [
  {
    href: '/settings/account',
    label: 'Account',
    description: 'Your name, email, plan, support, and account controls',
    Icon: User,
  },
  {
    href: '/settings/preferences',
    label: 'Preferences',
    description: 'Default fishing location, target species, and notifications',
    Icon: SlidersHorizontal,
  },
  {
    href: '/settings/units',
    label: 'Units',
    description: 'How tide, depth, wind, and temperature read across the app',
    Icon: Ruler,
  },
]

export default function ProfilePage() {
  const { user } = useAuth()
  // AuthGate already blocks anonymous access; render nothing until the session
  // resolves so we don't flash a greeting to a signed-out visitor.
  if (!user) return null

  const firstName = storedFirstName(user)

  return (
    <div className="min-h-dvh bg-rc-page">
      <ExploreTopBar />
      <main className="pt-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold tracking-[-0.02em] text-rc-ink">
              {firstName ? `${firstName}’s profile` : 'Profile'}
            </h1>
            <div className="mt-1.5 font-rc-mono text-[12px] text-rc-ink-mute">{user.email}</div>
          </div>

          <nav aria-label="Settings" className="rounded border border-rc-rule bg-rc-panel divide-y divide-rc-rule">
            {SETTINGS.map(({ href, label, description, Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-4 p-4 group hover:bg-rc-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-inset"
              >
                <div className="w-10 h-10 shrink-0 bg-rc-brand-soft rounded-full flex items-center justify-center">
                  <Icon className="h-5 w-5 text-rc-brand" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-rc-ink">{label}</div>
                  <div className="text-[13px] text-rc-ink-soft">{description}</div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-rc-ink-mute group-hover:text-rc-ink transition-colors" />
              </Link>
            ))}
          </nav>
        </div>
      </main>
    </div>
  )
}

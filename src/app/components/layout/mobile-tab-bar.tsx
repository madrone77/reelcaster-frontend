'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { MAIN_NAV_ITEMS, isRouteActive } from '@/app/config/navigation'

export default function MobileTabBar() {
  const pathname = usePathname()

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-rc-bg-darkest border-t border-rc-bg-light z-50 safe-area-bottom">
      <nav className="h-full" aria-label="Mobile navigation">
        <ul className="h-full flex items-center overflow-x-auto scrollbar-hide px-1 gap-1">
          {MAIN_NAV_ITEMS.map(item => {
            const Icon = item.icon
            const isActive = isRouteActive(item.href, pathname)
            const label = item.mobileLabel || item.label

            if (item.disabled) {
              return (
                <li key={item.id} className="shrink-0">
                  <div
                    className="flex flex-col items-center justify-center h-full py-1 px-2 min-w-[3rem] opacity-40 cursor-not-allowed"
                    title="Coming soon"
                  >
                    <div className="p-1.5 rounded-lg">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] mt-0.5 font-medium text-rc-text-muted whitespace-nowrap">{label}</span>
                  </div>
                </li>
              )
            }

            return (
              <li key={item.id} className="shrink-0">
                <Link
                  href={item.href}
                  className={`flex flex-col items-center justify-center h-full py-1 px-2 min-w-[3rem] transition-colors ${
                    isActive
                      ? 'text-blue-500'
                      : 'text-rc-text-muted active:text-rc-text-light'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <div className={`p-1.5 rounded-lg ${isActive ? 'bg-blue-500/20' : ''}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] mt-0.5 font-medium whitespace-nowrap">{label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}

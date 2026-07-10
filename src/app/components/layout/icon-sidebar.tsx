'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react'
import {
  MAIN_NAV_ITEMS,
  isRouteActive,
  type NavItem,
} from '@/app/config/navigation'

/** Blue color for active/selected state */
const ACTIVE_ICON_COLOR = 'text-[#3F8AE2]'

interface IconSidebarProps {
  isLocationPanelCollapsed?: boolean
  onToggleLocationPanel?: () => void
}

interface NavItemCardProps {
  item: NavItem
  isActive: boolean
}

function NavItemCard({ item, isActive }: NavItemCardProps) {
  const Icon = item.icon

  if (item.disabled) {
    return (
      <li>
        <div
          className="flex flex-col items-center justify-center p-3 rounded-xl cursor-not-allowed opacity-40"
          title="Coming soon"
        >
          <Icon className="w-6 h-6 mb-2" />
          <span className="text-xs font-medium text-center leading-tight text-rc-text-muted">
            {item.label}
          </span>
        </div>
      </li>
    )
  }

  return (
    <li>
      <Link
        href={item.href}
        data-testid={`nav-${item.id}`}
        className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200 ${
          isActive
            ? 'bg-rc-bg-dark text-rc-text shadow-lg shadow-black/30'
            : 'text-rc-text-muted hover:text-rc-text-light'
        }`}
        aria-current={isActive ? 'page' : undefined}
      >
        <Icon className={`w-6 h-6 mb-2 ${isActive ? ACTIVE_ICON_COLOR : ''}`} />
        <span className="text-xs font-medium text-center leading-tight">
          {item.label}
        </span>
      </Link>
    </li>
  )
}

export default function IconSidebar({
  isLocationPanelCollapsed = false,
  onToggleLocationPanel,
}: IconSidebarProps) {
  const pathname = usePathname()

  return (
    <div className="hidden lg:flex w-[100px] h-screen bg-rc-bg-darkest border-r border-rc-bg-light flex-col fixed left-0 top-0 z-50">
      {/* Header: Collapse button */}
      <div className="h-20 flex items-center justify-center border-b border-rc-bg-light">
        {onToggleLocationPanel && (
          <button
            onClick={onToggleLocationPanel}
            className="p-2 rounded-lg text-rc-text-muted hover:text-rc-text hover:bg-rc-bg-light transition-colors"
            title={isLocationPanelCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isLocationPanelCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isLocationPanelCollapsed ? (
              <PanelLeftOpen className="w-5 h-5" />
            ) : (
              <PanelLeftClose className="w-5 h-5" />
            )}
          </button>
        )}
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto" aria-label="Main navigation">
        <ul className="space-y-2 px-2">
          <li>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('openGlobalSearch'))}
              className="w-full flex flex-col items-center justify-center p-3 rounded-xl text-rc-text-muted hover:text-rc-text-light transition-colors"
              title="Search (⌘K)"
              aria-label="Open search"
            >
              <Search className="w-6 h-6 mb-2" />
              <span className="text-xs font-medium text-center leading-tight">Search</span>
            </button>
          </li>
          {MAIN_NAV_ITEMS.map(item => (
            <NavItemCard
              key={item.id}
              item={item}
              isActive={isRouteActive(item.href, pathname)}
            />
          ))}
        </ul>
      </nav>
    </div>
  )
}

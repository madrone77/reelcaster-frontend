import {
  Bell,
  Anchor,
  User,
  LucideIcon,
} from 'lucide-react'
import { ComponentType, SVGProps } from 'react'

/** Icon type that accepts both Lucide icons and custom SVG components */
type IconComponent = LucideIcon | ComponentType<SVGProps<SVGSVGElement>>

export interface NavItem {
  id: string
  label: string
  /** Short label for mobile (optional, defaults to label) */
  mobileLabel?: string
  href: string
  icon: IconComponent
  /** Whether the item is disabled (coming soon) */
  disabled?: boolean
}

/**
 * Main navigation items shown to all users
 */
export const MAIN_NAV_ITEMS: NavItem[] = [
  {
    id: 'alerts',
    label: 'Alerts',
    mobileLabel: 'Alerts',
    href: '/alerts',
    icon: Bell,
  },
  {
    id: 'catch-log',
    label: 'Catch Log',
    mobileLabel: 'Catches',
    href: '/catches',
    icon: Anchor,
  },
  {
    id: 'profile',
    label: 'Profile',
    href: '/profile',
    icon: User,
  },
]

/**
 * Check if a route is active based on current pathname.
 * `/` and `/profile` use exact-match because more specific routes
 * live underneath and own their own nav entry.
 */
const EXACT_MATCH_ROUTES = new Set(['/', '/profile'])

export function isRouteActive(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/' || pathname === ''
  if (EXACT_MATCH_ROUTES.has(href)) return pathname === href
  return pathname.startsWith(href)
}

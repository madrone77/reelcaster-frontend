'use client';

import {
  Activity,
  BookOpen,
  Compass,
  CreditCard,
  LifeBuoy,
  MessageSquare,
  type LucideIcon,
} from 'lucide-react';
import type { SectionId } from '../content';

interface Item {
  id: SectionId;
  label: string;
  hint: string;
  icon: LucideIcon;
}

const ITEMS: Item[] = [
  { id: 'start', label: 'Start here', hint: 'Overview', icon: Compass },
  { id: 'guides', label: 'Guides', hint: 'Learn the app', icon: BookOpen },
  { id: 'answers', label: 'Answers', hint: 'Knowledge base', icon: MessageSquare },
  { id: 'billing', label: 'Billing', hint: 'Plan & invoices', icon: CreditCard },
  { id: 'status', label: 'Status', hint: 'Issues & updates', icon: Activity },
  { id: 'tickets', label: 'Contact us', hint: 'File a ticket', icon: LifeBuoy },
];

interface Props {
  active: SectionId;
  onSelect: (section: SectionId) => void;
}

/**
 * Section switcher. A sticky rail on desktop; a horizontally scrolling chip
 * row on mobile, where a 6-item vertical list would push the content itself
 * below the fold.
 */
export default function PortNav({ active, onSelect }: Props) {
  return (
    <nav aria-label="The Port sections" className="lg:w-56 lg:shrink-0">
      {/* Mobile: scrolling chips */}
      <ul className="flex lg:hidden gap-2 overflow-x-auto pb-1 -mx-4 px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {ITEMS.map((item) => {
          const isActive = item.id === active;
          return (
            <li key={item.id} className="shrink-0">
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`px-3.5 py-2 rounded-full text-sm font-medium whitespace-nowrap border transition-colors ${
                  isActive
                    ? 'bg-rc-brand border-rc-brand text-white'
                    : 'bg-rc-panel border-rc-rule text-rc-ink-soft hover:text-rc-ink'
                }`}
              >
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>

      {/* Desktop: sticky rail. top-20 clears the fixed 64px bar plus a gutter. */}
      <ul className="hidden lg:block lg:sticky lg:top-20 space-y-1">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === active;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                  isActive
                    ? 'bg-rc-brand-soft text-rc-ink'
                    : 'text-rc-ink-soft hover:bg-rc-surface hover:text-rc-ink'
                }`}
              >
                <Icon
                  className={`w-4 h-4 mt-0.5 shrink-0 ${
                    isActive ? 'text-rc-brand' : 'text-rc-ink-mute'
                  }`}
                  aria-hidden
                />
                <span className="min-w-0">
                  <span
                    className={`block text-sm ${
                      isActive ? 'font-semibold' : 'font-medium'
                    }`}
                  >
                    {item.label}
                  </span>
                  <span className="block font-rc-mono text-[10px] text-rc-ink-mute mt-0.5">
                    {item.hint}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

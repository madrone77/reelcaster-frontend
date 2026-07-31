'use client';

import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  BookOpen,
  Clock,
  CreditCard,
  LifeBuoy,
  MessageSquare,
  type LucideIcon,
} from 'lucide-react';

import { ARTICLES, CHANGELOG, GUIDES, KNOWN_ISSUES, type SectionId } from '../content';
import PortSection from './port-section';

interface Props {
  onNavigate: (section: SectionId, id?: string) => void;
}

interface Tile {
  section: SectionId;
  icon: LucideIcon;
  title: string;
  blurb: string;
  count: string;
}

/** Landing view: what is here, what is new, and where to go. */
export default function StartSection({ onNavigate }: Props) {
  const tiles: Tile[] = [
    {
      section: 'guides',
      icon: BookOpen,
      title: 'Guides',
      blurb:
        'Walkthroughs for the parts of the app that reward knowing them properly: scores, the map, alerts, catch logging.',
      count: `${GUIDES.length} guides`,
    },
    {
      section: 'answers',
      icon: MessageSquare,
      title: 'Answers',
      blurb:
        'The questions we actually get, answered plainly. Searchable, and honest about what is not built yet.',
      count: `${ARTICLES.length} answers`,
    },
    {
      section: 'billing',
      icon: CreditCard,
      title: 'Billing',
      blurb:
        'Your plan, renewal date, and a direct route into the Stripe portal to change card, switch plan or cancel.',
      count: 'Self-serve',
    },
    {
      section: 'status',
      icon: Activity,
      title: 'Status',
      blurb:
        'What is currently broken and what we shipped recently. Check here before reporting a bug.',
      count: `${KNOWN_ISSUES.length} known issues`,
    },
  ];

  const latest = CHANGELOG[0];

  return (
    <PortSection
      eyebrow="Start here"
      title="Welcome to The Port"
      intro="Four places to look, and one place to ask. If you are in a hurry, search at the top; it covers everything below at once."
    >
      {/* Priority-support promise. The single most useful thing to state up
          front, because it is the reason this page is Pro-only. */}
      <div className="bg-rc-brand-soft border border-rc-brand-soft2 rounded-xl p-5 flex items-start gap-3">
        <Clock className="w-5 h-5 text-rc-brand shrink-0 mt-0.5" aria-hidden />
        <div>
          <p className="text-rc-ink font-semibold text-sm">
            Pro tickets get a reply within one business day
          </p>
          <p className="mt-1 text-sm text-rc-ink-soft leading-relaxed">
            Usually much sooner. We are a small team in Victoria, BC, so
            weekends and BC statutory holidays do not count toward that. But a
            real person reads every ticket, and you can always point back at
            your history.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('tickets')}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-rc-brand hover:text-rc-brand-hover"
          >
            <LifeBuoy className="w-4 h-4" aria-hidden />
            File a ticket
            <ArrowRight className="w-3.5 h-3.5" aria-hidden />
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <button
              key={tile.section}
              type="button"
              onClick={() => onNavigate(tile.section)}
              className="text-left bg-rc-panel border border-rc-rule rounded-xl p-5 hover:border-rc-brand transition-colors group"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 text-rc-brand" aria-hidden />
                  <span className="font-semibold text-rc-ink">{tile.title}</span>
                </div>
                <span className="font-rc-mono text-[10px] text-rc-ink-mute">
                  {tile.count}
                </span>
              </div>
              <p className="mt-2.5 text-sm leading-relaxed text-rc-ink-soft">
                {tile.blurb}
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-rc-brand group-hover:text-rc-brand-hover">
                Open
                <ArrowRight className="w-3.5 h-3.5" aria-hidden />
              </span>
            </button>
          );
        })}
      </div>

      {latest && (
        <div className="mt-6 bg-rc-panel border border-rc-rule rounded-xl p-5">
          <div className="flex items-center gap-2">
            <span className="font-rc-mono text-[9px] tracking-[0.1em] uppercase px-1.5 py-0.5 rounded bg-rc-good-bg text-rc-good-ink">
              Latest
            </span>
            <span className="font-rc-mono text-[10px] text-rc-ink-mute">
              {latest.date}
            </span>
          </div>
          <p className="mt-2 font-semibold text-rc-ink text-sm">
            {latest.title}
          </p>
          <p className="mt-1 text-sm text-rc-ink-soft leading-relaxed">
            {latest.detail}
          </p>
          <button
            type="button"
            onClick={() => onNavigate('status')}
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-rc-brand hover:text-rc-brand-hover"
          >
            All updates
            <ArrowRight className="w-3.5 h-3.5" aria-hidden />
          </button>
        </div>
      )}

      <p className="mt-6 text-xs text-rc-ink-mute leading-relaxed">
        Looking for the public pages? The{' '}
        <Link
          href="/faq"
          className="text-rc-brand hover:text-rc-brand-hover underline underline-offset-2"
        >
          FAQ
        </Link>{' '}
        and{' '}
        <Link
          href="/contact"
          className="text-rc-brand hover:text-rc-brand-hover underline underline-offset-2"
        >
          Contact
        </Link>{' '}
        are still there, and are what your non-Pro friends will see.
      </p>
    </PortSection>
  );
}

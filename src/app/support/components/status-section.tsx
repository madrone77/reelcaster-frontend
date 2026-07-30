'use client';

import { useEffect, useRef } from 'react';
import { AlertTriangle, Wrench, Search as SearchIcon } from 'lucide-react';

import {
  CHANGELOG,
  KNOWN_ISSUES,
  type ChangeTag,
  type IssueState,
} from '../content';
import PortSection from './port-section';

interface Props {
  /** Issue or changelog id arrived at from a search hit. */
  focusId: string | null;
}

const STATE_META: Record<
  IssueState,
  { label: string; className: string; Icon: typeof AlertTriangle }
> = {
  investigating: {
    label: 'Investigating',
    className: 'bg-rc-fair-bg text-rc-fair-ink',
    Icon: SearchIcon,
  },
  in_progress: {
    label: 'Fix in progress',
    className: 'bg-rc-brand-soft text-rc-brand',
    Icon: Wrench,
  },
  workaround: {
    label: 'Workaround only',
    className: 'bg-rc-poor-bg text-rc-poor-ink',
    Icon: AlertTriangle,
  },
};

const TAG_CLASS: Record<ChangeTag, string> = {
  New: 'bg-rc-good-bg text-rc-good-ink',
  Improved: 'bg-rc-brand-soft text-rc-brand',
  Fixed: 'bg-rc-fair-bg text-rc-fair-ink',
};

export default function StatusSection({ focusId }: Props) {
  const refs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    if (!focusId) return;
    const t = window.setTimeout(() => {
      refs.current[focusId]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 60);
    return () => window.clearTimeout(t);
  }, [focusId]);

  return (
    <PortSection
      eyebrow="Status"
      title="Known issues & recent updates"
      intro="What is currently broken, stated plainly. Check here before filing a bug — if it is listed, we already know, and there is nothing you need to send us."
    >
      <h3 className="font-rc-mono text-[10px] tracking-[0.14em] uppercase text-rc-ink-mute">
        Known issues
      </h3>
      <ul className="mt-3 space-y-3">
        {KNOWN_ISSUES.map((issue) => {
          const meta = STATE_META[issue.state];
          const Icon = meta.Icon;
          return (
            <li
              key={issue.id}
              ref={(el) => {
                refs.current[issue.id] = el;
              }}
              className="bg-rc-panel border border-rc-rule rounded-xl p-5"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <h4 className="font-semibold text-rc-ink text-sm min-w-0">
                  {issue.title}
                </h4>
                <span
                  className={`inline-flex items-center gap-1.5 shrink-0 font-rc-mono text-[9px] tracking-[0.1em] uppercase px-2 py-1 rounded ${meta.className}`}
                >
                  <Icon className="w-3 h-3" aria-hidden />
                  {meta.label}
                </span>
              </div>
              <p className="mt-2 text-sm text-rc-ink-soft leading-relaxed">
                {issue.detail}
              </p>
              {issue.workaround && (
                <div className="mt-3 bg-rc-surface rounded-lg px-4 py-3">
                  <p className="font-rc-mono text-[9px] tracking-[0.12em] uppercase text-rc-ink-mute">
                    In the meantime
                  </p>
                  <p className="mt-1 text-sm text-rc-ink-soft leading-relaxed">
                    {issue.workaround}
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <h3 className="mt-10 font-rc-mono text-[10px] tracking-[0.14em] uppercase text-rc-ink-mute">
        Recently shipped
      </h3>
      <ol className="mt-3 relative border-l border-rc-rule ml-1.5 space-y-6 pt-1">
        {CHANGELOG.map((entry) => (
          <li
            key={`${entry.date}-${entry.title}`}
            ref={(el) => {
              refs.current[`${entry.date}-${entry.title}`] = el;
            }}
            className="relative pl-5"
          >
            <span
              className="absolute -left-[4.5px] top-1.5 w-2 h-2 rounded-full bg-rc-brand"
              aria-hidden
            />
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`font-rc-mono text-[9px] tracking-[0.1em] uppercase px-1.5 py-0.5 rounded ${TAG_CLASS[entry.tag]}`}
              >
                {entry.tag}
              </span>
              <time
                dateTime={entry.date}
                className="font-rc-mono text-[10px] text-rc-ink-mute"
              >
                {entry.date}
              </time>
            </div>
            <p className="mt-1.5 font-semibold text-rc-ink text-sm">
              {entry.title}
            </p>
            <p className="mt-1 text-sm text-rc-ink-soft leading-relaxed">
              {entry.detail}
            </p>
          </li>
        ))}
      </ol>
    </PortSection>
  );
}

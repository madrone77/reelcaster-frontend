'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronDown } from 'lucide-react';

import { GUIDES } from '../content';
import PortSection from './port-section';

interface Props {
  /** Guide id arrived at from a search hit — opens and scrolls to it. */
  focusId: string | null;
}

export default function GuidesSection({ focusId }: Props) {
  const [openId, setOpenId] = useState<string | null>(focusId);
  const refs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!focusId) return;
    setOpenId(focusId);
    // Defer past the open-state paint so the element has its final position.
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
      eyebrow="Guides"
      title="Learn the app properly"
      intro="Short walkthroughs of the features that reward knowing them well. Written against what actually ships today, not what is planned."
    >
      <div className="space-y-3">
        {GUIDES.map((guide) => {
          const isOpen = openId === guide.id;
          return (
            <div
              key={guide.id}
              ref={(el) => {
                refs.current[guide.id] = el;
              }}
              className={`bg-rc-panel border rounded-xl overflow-hidden transition-colors ${
                isOpen ? 'border-rc-brand' : 'border-rc-rule'
              }`}
            >
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : guide.id)}
                aria-expanded={isOpen}
                className="w-full text-left px-5 py-4 flex items-start gap-4 hover:bg-rc-surface transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="font-semibold text-rc-ink">{guide.title}</h3>
                    <span className="font-rc-mono text-[10px] text-rc-ink-mute px-1.5 py-0.5 bg-rc-surface rounded">
                      {guide.minutes} min
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-rc-ink-soft leading-relaxed">
                    {guide.summary}
                  </p>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-rc-ink-mute shrink-0 mt-1 transition-transform ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                  aria-hidden
                />
              </button>

              {isOpen && (
                <ol className="px-5 pb-5 pt-1 space-y-4 border-t border-rc-rule-soft">
                  {guide.steps.map((step, i) => (
                    <li key={step.title} className="flex gap-3.5 pt-4 first:pt-4">
                      <span
                        className="shrink-0 w-6 h-6 rounded-full bg-rc-brand-soft text-rc-brand font-rc-mono text-[11px] font-bold flex items-center justify-center"
                        aria-hidden
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-rc-ink text-sm">
                          {step.title}
                        </p>
                        <p className="mt-1 text-sm text-rc-ink-soft leading-relaxed">
                          {step.detail}
                        </p>
                        {step.href && (
                          <Link
                            href={step.href}
                            className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-rc-brand hover:text-rc-brand-hover"
                          >
                            {step.hrefLabel ?? 'Open'}
                            <ArrowRight className="w-3.5 h-3.5" aria-hidden />
                          </Link>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          );
        })}
      </div>
    </PortSection>
  );
}

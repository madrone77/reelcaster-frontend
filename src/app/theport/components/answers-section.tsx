'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { ARTICLES, ARTICLE_TOPICS, type ArticleTopic } from '../content';
import PortSection from './port-section';

interface Props {
  /** Article id arrived at from a search hit — opens and scrolls to it. */
  focusId: string | null;
}

type Filter = ArticleTopic | 'All';

export default function AnswersSection({ focusId }: Props) {
  const [topic, setTopic] = useState<Filter>('All');
  const [openId, setOpenId] = useState<string | null>(focusId);
  const refs = useRef<Record<string, HTMLLIElement | null>>({});

  useEffect(() => {
    if (!focusId) return;
    // A search hit can land on an article the active topic filter hides, which
    // would look like the click did nothing. Reset to All before opening it.
    setTopic('All');
    setOpenId(focusId);
    const t = window.setTimeout(() => {
      refs.current[focusId]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 60);
    return () => window.clearTimeout(t);
  }, [focusId]);

  const visible = useMemo(
    () => (topic === 'All' ? ARTICLES : ARTICLES.filter((a) => a.topic === topic)),
    [topic],
  );

  const filters: Filter[] = ['All', ...ARTICLE_TOPICS];

  return (
    <PortSection
      eyebrow="Answers"
      title="Knowledge base"
      intro="The questions we actually get. Where something is not built yet, this says so rather than describing the roadmap as if it shipped."
    >
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => {
          const active = f === topic;
          const count =
            f === 'All'
              ? ARTICLES.length
              : ARTICLES.filter((a) => a.topic === f).length;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setTopic(f)}
              aria-pressed={active}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                active
                  ? 'bg-rc-brand border-rc-brand text-white'
                  : 'bg-rc-panel border-rc-rule text-rc-ink-soft hover:text-rc-ink'
              }`}
            >
              {f}
              <span
                className={`ml-1.5 font-rc-mono ${
                  active ? 'text-white/70' : 'text-rc-ink-mute'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <ul className="mt-5 bg-rc-panel border border-rc-rule rounded-xl overflow-hidden">
        {visible.map((article) => {
          const isOpen = openId === article.id;
          return (
            <li
              key={article.id}
              ref={(el) => {
                refs.current[article.id] = el;
              }}
              className="border-b border-rc-rule-soft last:border-b-0"
            >
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : article.id)}
                aria-expanded={isOpen}
                className="w-full flex items-start justify-between gap-4 px-5 py-4 text-left hover:bg-rc-surface transition-colors"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-rc-ink">
                    {article.question}
                  </span>
                  {topic === 'All' && (
                    <span className="mt-1 block font-rc-mono text-[10px] uppercase tracking-[0.08em] text-rc-ink-mute">
                      {article.topic}
                    </span>
                  )}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-rc-ink-mute shrink-0 mt-0.5 transition-transform ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                  aria-hidden
                />
              </button>
              {isOpen && (
                <div className="px-5 pb-5 -mt-1 text-sm text-rc-ink-soft leading-relaxed">
                  {article.answer}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </PortSection>
  );
}

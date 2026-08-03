'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { searchContent, type SearchHit } from '../content';

interface Props {
  onSelect: (hit: SearchHit) => void;
}

const KIND_STYLES: Record<SearchHit['kind'], string> = {
  Guide: 'bg-rc-brand-soft text-rc-brand',
  Answer: 'bg-rc-surface text-rc-ink-mute',
  Status: 'bg-rc-fair-bg text-rc-fair-ink',
  Update: 'bg-rc-good-bg text-rc-good-ink',
};

/**
 * One search box across guides, answers, known issues and changelog.
 *
 * Searching happens synchronously against a module-scope index of a few dozen
 * entries — no debounce, no request, no loading state. Keyboard support is
 * deliberate: this is the fastest path to an answer, and reaching for the
 * mouse to pick result one defeats that.
 */
export default function PortSearch({ onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const hits = useMemo(() => searchContent(query), [query]);

  // Reset the highlight whenever the result set changes, or Enter fires on
  // whatever happened to sit at the old index.
  useEffect(() => setCursor(0), [query]);

  // Click-away close. Blur alone would fire before a result's click lands.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const choose = (hit: SearchHit) => {
    onSelect(hit);
    setQuery('');
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!hits.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => (c + 1) % hits.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => (c - 1 + hits.length) % hits.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(hits[cursor]);
    }
  };

  const showPanel = open && query.trim().length > 0;

  return (
    <div ref={wrapRef} className="relative max-w-2xl">
      <div className="relative">
        <Search
          className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-rc-ink-mute pointer-events-none"
          aria-hidden
        />
        <input
          type="search"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls="port-search-results"
          aria-autocomplete="list"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search guides, answers and known issues…"
          className="w-full bg-rc-panel border border-rc-rule rounded-lg pl-10 pr-10 py-3 text-sm text-rc-ink placeholder:text-rc-ink-mute focus:outline-none focus:border-rc-brand focus:ring-[3px] focus:ring-rc-brand-soft2 transition-colors"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-rc-ink-mute hover:text-rc-ink"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {showPanel && (
        <div
          id="port-search-results"
          role="listbox"
          className="absolute z-20 mt-2 w-full bg-rc-panel border border-rc-rule rounded-lg shadow-lg overflow-hidden"
        >
          {hits.length === 0 ? (
            <div className="px-4 py-5 text-sm text-rc-ink-mute">
              Nothing matched{' '}
              <span className="text-rc-ink font-medium">
                &ldquo;{query.trim()}&rdquo;
              </span>
              . Try fewer words, or file a ticket and ask us directly.
            </div>
          ) : (
            <ul className="max-h-80 overflow-y-auto divide-y divide-rc-rule-soft">
              {hits.map((hit, i) => (
                <li key={`${hit.kind}-${hit.id}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === cursor}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => choose(hit)}
                    className={`w-full text-left px-4 py-3 transition-colors ${
                      i === cursor ? 'bg-rc-surface' : 'bg-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-rc-mono text-[9px] tracking-[0.1em] uppercase px-1.5 py-0.5 rounded ${KIND_STYLES[hit.kind]}`}
                      >
                        {hit.kind}
                      </span>
                      <span className="text-sm font-medium text-rc-ink truncate">
                        {hit.title}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-rc-ink-mute line-clamp-2">
                      {hit.snippet}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

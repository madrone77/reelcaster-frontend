'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Search, MapPin, Building2, Map, Target, Loader2, X } from 'lucide-react';
import { btn } from '@/app/components/ui/button';
import { COVERED_PROVINCES } from '@/lib/regions';
import type { SearchResult } from '@/lib/search-results';

const WaitlistPinModal = dynamic(
  () => import('@/app/components/waitlist/waitlist-pin-modal'),
  { ssr: false },
);

interface Props {
  open: boolean;
  onClose: () => void;
}

const TYPE_ICON = {
  spot: MapPin,
  city: Building2,
  region: Map,
  species: Target,
} as const;

// Where a result leads is resolved server-side and arrives as `path` — the
// city segment and a spot's owning city both live in the hierarchy, which this
// component has no way to read. A null `path` renders inert rather than as a
// dead link: species and areas are worth showing, because they say the
// coverage is there, but they have no standalone page.

export default function GlobalSearch({ open, onClose }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [waitlistOpen, setWaitlistOpen] = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQ('');
      setResults([]);
      setHighlight(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // ESC closes
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    if (q.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
        const data = await res.json();
        setResults(data.results ?? []);
        setHighlight(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => clearTimeout(handle);
  }, [q, open]);

  const navigate = useCallback(
    (r: SearchResult) => {
      if (r.path) {
        router.push(r.path);
        onClose();
      }
    },
    [router, onClose],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = results[highlight];
      if (target) navigate(target);
    }
  };

  if (!open) return null;

  const hasQuery = q.trim().length >= 2;
  const empty = hasQuery && !loading && results.length === 0;

  // Portalled to <body>. Both bars that open this are `position: sticky` or
  // `fixed` and one of them carries a transform for its roll-away — a
  // transformed ancestor becomes the containing block for `position: fixed`
  // children, which would trap this full-screen overlay inside a 64px bar and
  // slide it away on scroll. Escaping to the body means no caller has to know
  // that, and a third bar can mount the trigger without rediscovering it.
  return createPortal(
    <>
      <div
        className="fixed inset-0 z-50 flex items-start justify-center bg-rc-ink/60 backdrop-blur-sm p-4 pt-[10vh]"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="bg-rc-panel border border-rc-rule rounded-xl shadow-rc-panel w-full max-w-xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-rc-rule">
            <Search className="w-5 h-5 text-rc-ink-mute" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search spots, cities, species…"
              className="flex-1 bg-transparent text-rc-ink placeholder:text-rc-ink-mute text-base focus:outline-none"
            />
            {loading && <Loader2 className="w-4 h-4 animate-spin text-rc-ink-mute" />}
            <button
              onClick={onClose}
              className="text-rc-ink-mute hover:text-rc-ink"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {!hasQuery && (
              <div className="px-4 py-8 text-center text-sm text-rc-ink-mute">
                Start typing to search
              </div>
            )}

            {empty && (
              <div className="px-4 py-8 text-center space-y-3">
                <p className="text-sm text-rc-ink">
                  No spots found in &quot;<span className="font-semibold">{q}</span>&quot;.
                </p>
                <p className="text-xs text-rc-ink-mute">
                  {/* Derived, because this line named Oregon for months after
                      it was pulled from the covered set. */}
                  ReelCaster is live in {COVERED_PROVINCES.join(', ')}.
                </p>
                <button
                  onClick={() => setWaitlistOpen(true)}
                  className={btn.nav}
                >
                  Request coverage →
                </button>
              </div>
            )}

            {results.length > 0 && (
              <ul className="py-1">
                {results.map((r, i) => {
                  const Icon = TYPE_ICON[r.kind];
                  const active = i === highlight;
                  const href = r.path;
                  return (
                    <li key={`${r.kind}-${r.id}`}>
                      <button
                        onClick={() => navigate(r)}
                        onMouseEnter={() => setHighlight(i)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          active ? 'bg-rc-page' : ''
                        } ${href ? 'hover:bg-rc-page cursor-pointer' : 'cursor-default opacity-60'}`}
                      >
                        <Icon className="w-4 h-4 text-rc-ink-mute flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-rc-ink truncate">{r.name}</p>
                          {r.label && (
                            <p className="text-xs text-rc-ink-mute truncate">{r.label}</p>
                          )}
                        </div>
                        <span className="text-[10px] uppercase tracking-wide text-rc-ink-mute">
                          {r.kind}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      <WaitlistPinModal
        open={waitlistOpen}
        onClose={() => {
          setWaitlistOpen(false);
          onClose();
        }}
        source="anon_pin"
        initialSpecies={q}
        title={`We're not yet live in "${q}"`}
        description="Drop a pin where you'd like ReelCaster coverage and we'll let you know."
      />
    </>,
    document.body,
  );
}

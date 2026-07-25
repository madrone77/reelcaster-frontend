'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Search, MapPin, Building2, Target, Loader2, X } from 'lucide-react';
import type { BlueCasterSearchResult } from '@/lib/bluecaster';

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
  species: Target,
} as const;

export default function GlobalSearch({ open, onClose }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [q, setQ] = useState('');
  const [results, setResults] = useState<BlueCasterSearchResult[]>([]);
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
    (r: BlueCasterSearchResult) => {
      if (r.href) {
        router.push(r.href);
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

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 pt-[10vh]"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="bg-rc-bg-dark border border-rc-bg-light rounded-xl shadow-2xl w-full max-w-xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-rc-bg-light">
            <Search className="w-5 h-5 text-rc-text-muted" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search spots, cities, species…"
              className="flex-1 bg-transparent text-rc-text placeholder:text-rc-text-muted text-base focus:outline-none"
            />
            {loading && <Loader2 className="w-4 h-4 animate-spin text-rc-text-muted" />}
            <button
              onClick={onClose}
              className="text-rc-text-muted hover:text-rc-text"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {!hasQuery && (
              <div className="px-4 py-8 text-center text-sm text-rc-text-muted">
                Start typing to search
              </div>
            )}

            {empty && (
              <div className="px-4 py-8 text-center space-y-3">
                <p className="text-sm text-rc-text">
                  No spots found in &quot;<span className="font-semibold">{q}</span>&quot;.
                </p>
                <p className="text-xs text-rc-text-muted">
                  ReelCaster is live in BC, WA, OR.
                </p>
                <button
                  onClick={() => setWaitlistOpen(true)}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-semibold text-white transition-colors"
                >
                  Request coverage →
                </button>
              </div>
            )}

            {results.length > 0 && (
              <ul className="py-1">
                {results.map((r, i) => {
                  const Icon = TYPE_ICON[r.type];
                  const active = i === highlight;
                  return (
                    <li key={`${r.type}-${r.id}`}>
                      <button
                        onClick={() => navigate(r)}
                        onMouseEnter={() => setHighlight(i)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          active ? 'bg-rc-bg-light' : ''
                        } ${r.href ? 'hover:bg-rc-bg-light cursor-pointer' : 'cursor-default opacity-60'}`}
                      >
                        <Icon className="w-4 h-4 text-rc-text-muted flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-rc-text truncate">{r.name}</p>
                          {r.subtitle && (
                            <p className="text-xs text-rc-text-muted truncate">{r.subtitle}</p>
                          )}
                        </div>
                        <span className="text-[10px] uppercase tracking-wide text-rc-text-muted">
                          {r.type}
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
    </>
  );
}

"use client";

/**
 * "Fishing in Seattle?" — the one question that makes the rest of the product
 * about somebody's own water.
 *
 * The home city drives the daily report, Explore's opening frame, and which
 * spots get ranked for them. All of that used to be derived from a pinned home
 * SPOT, which nobody can choose sensibly on their first day. A city we can
 * guess: from the URL they arrived on, or failing that their IP. So this asks
 * a yes/no question instead of presenting a list.
 *
 * The shape follows from that. A confirmation is one tap. Being wrong has to
 * cost almost as little, or a wrong guess is worse than no guess, so the two
 * or three nearest cities sit right underneath as buttons, and a typeahead
 * sits behind those for anyone none of them fit.
 *
 * It asks once. `markHomeCityAsked` runs on dismiss as well as on answer,
 * because closing this is itself an answer.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Search, X } from "lucide-react";
import type {
  HomeCitySuggestResponse,
  HomeCitySuggestion,
} from "@/app/api/home-city/suggest/suggestion";
import { readArrival, clearArrival } from "./arrival-city";
import { markHomeCityAsked, saveHomeCity } from "@/app/explore/lib/use-home-city";

export default function HomeCityModal({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<HomeCitySuggestResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    const arrival = readArrival();
    const url = arrival
      ? `/api/home-city/suggest?from=${encodeURIComponent(arrival)}`
      : "/api/home-city/suggest";
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((body: HomeCitySuggestResponse | null) => {
        if (cancelled) return;
        // No cities at all means something upstream is wrong. Say nothing
        // rather than showing an empty question.
        if (!body || (!body.suggested && !body.all.length)) {
          setFailed(true);
          return;
        }
        setData(body);
        // No guess to confirm, so the only useful state is the search.
        if (!body.suggested) setSearching(true);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  // Nothing to ask. Retire the question rather than leaving a dead backdrop.
  useEffect(() => {
    if (failed) onClose();
  }, [failed, onClose]);

  const dismiss = useCallback(() => {
    void markHomeCityAsked();
    clearArrival();
    onClose();
  }, [onClose]);

  const choose = useCallback(
    (city: HomeCitySuggestion) => {
      void saveHomeCity(city.slug);
      clearArrival();
      onClose();
    },
    [onClose],
  );

  const matches = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data.all.slice(0, 8);
    return data.all.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [data, query]);

  // Focus the search only when the angler asked for it. Never on open: on a
  // phone an autofocus throws the keyboard up over the very buttons most
  // people are going to press. See [[reference-mobile-keyboard-sheets]].
  useEffect(() => {
    if (searching && data?.suggested) searchRef.current?.focus();
  }, [searching, data?.suggested]);

  if (!data) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="home-city-title"
      data-testid="home-city-modal"
      onClick={dismiss}
    >
      <div
        className="relative max-h-full w-full overflow-y-auto rounded-2xl border border-rc-rule bg-white shadow-xl sm:max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-full p-2 text-rc-ink-mute transition-colors hover:bg-rc-surface hover:text-rc-ink"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="px-6 pb-6 pt-8">
          {data.suggested && !searching ? (
            <>
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-rc-brand-soft">
                <MapPin className="h-5 w-5 text-rc-brand" aria-hidden />
              </div>
              <h2 id="home-city-title" className="rc-title-lg text-2xl">
                Fishing in {data.suggested.name}?
              </h2>
              <p className="mt-2 text-sm text-rc-ink-soft">
                {/* One string, not a wrapped one: JSX turns the line break
                    before a leading &rsquo; into a space, which is how this
                    first read "what &rsquo;s open". */}
                We&rsquo;ll lead with your water. Today&rsquo;s report,
                what&rsquo;s open, and the spots worth the run.
              </p>

              <button
                type="button"
                onClick={() => choose(data.suggested!)}
                className="mt-5 min-h-11 w-full rounded-lg bg-rc-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-rc-brand/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand"
              >
                Yes, that&rsquo;s my water
              </button>

              {data.alternates.length > 0 && (
                <>
                  <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-rc-ink-mute">
                    Or somewhere else
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {data.alternates.map((c) => (
                      <button
                        key={c.slug}
                        type="button"
                        onClick={() => choose(c)}
                        className="min-h-11 rounded-lg border border-rc-rule px-3 text-sm text-rc-ink transition-colors hover:border-rc-brand/40 hover:bg-rc-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand"
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <button
                type="button"
                onClick={() => setSearching(true)}
                className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-rc-brand hover:underline"
              >
                <Search className="h-3.5 w-3.5" aria-hidden />
                Search all cities
              </button>
            </>
          ) : (
            <>
              <h2 id="home-city-title" className="rc-title-lg text-2xl">
                Where do you fish?
              </h2>
              <p className="mt-2 text-sm text-rc-ink-soft">
                Pick your home water. You can change it any time.
              </p>

              <div className="relative mt-4">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-rc-ink-mute"
                  aria-hidden
                />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search cities"
                  aria-label="Search cities"
                  className="min-h-11 w-full rounded-lg border border-rc-rule bg-white pl-9 pr-3 text-sm text-rc-ink placeholder:text-rc-ink-mute focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand"
                />
              </div>

              <div className="mt-3 max-h-64 overflow-y-auto">
                {matches.length === 0 ? (
                  <p className="px-1 py-6 text-center text-sm text-rc-ink-mute">
                    No covered city matches that yet.
                  </p>
                ) : (
                  <ul className="divide-y divide-rc-rule">
                    {matches.map((c) => (
                      <li key={c.slug}>
                        <button
                          type="button"
                          onClick={() => choose(c)}
                          className="min-h-11 w-full px-1 py-2.5 text-left text-sm text-rc-ink transition-colors hover:text-rc-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand"
                        >
                          {c.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

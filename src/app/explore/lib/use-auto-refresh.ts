"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Re-runs `refresh` on an interval, and hands back the one entry point every
 * other caller should use to refresh the same data.
 *
 * The spot page has advertised "LIVE · AUTO-REFRESH 5 MIN" since it shipped,
 * but nothing was on a timer: the clock ticked and the numbers under it did
 * not, so a tab left open through a tide change kept showing the scores it
 * loaded with under a label promising otherwise.
 *
 * Three rules, all of them about not wasting a request:
 *
 * - **Hidden tabs do not refresh.** A phone in a pocket and a tab behind
 *   twenty others are the common case for a page left open for hours, and
 *   nobody is reading the numbers a refresh would fetch. The elapsed time is
 *   not reset by the skip, so the tab refreshes the moment it comes back if it
 *   is due — which is exactly when someone is about to read it.
 * - **One refresh at a time.** A caller arriving mid-flight gets the promise
 *   that is already running rather than a second round of the same fetches.
 * - **Any refresh resets the clock.** A pull-to-refresh is a refresh, so
 *   pulling at 4:58 does not get you an automatic one at 5:00.
 */
export function useAutoRefresh(
  /** Does the actual refetching. Its identity may change every render. */
  refresh: () => Promise<unknown>,
  intervalMs: number,
): {
  /** Runs a refresh now, or joins the one in flight. */
  run: () => Promise<unknown>;
  /** When the last refresh finished, or null before the first one. */
  at: Date | null;
} {
  const [at, setAt] = useState<Date | null>(null);

  // `refresh` closes over the selected species, the selected day and the rest
  // of the page's state, so it is a new function most renders. Held in a ref so
  // the interval below is not torn down and restarted every time the reader
  // taps a day — which, with a 5 minute period and a curious reader, would mean
  // it never fires at all.
  const latest = useRef(refresh);
  latest.current = refresh;

  const inflight = useRef<Promise<unknown> | null>(null);
  // Mount counts as a refresh: the page has just loaded its data.
  const last = useRef(Date.now());

  const run = useCallback(() => {
    if (inflight.current) return inflight.current;
    const p = (async () => {
      try {
        await latest.current();
      } finally {
        last.current = Date.now();
        setAt(new Date(last.current));
        inflight.current = null;
      }
    })();
    inflight.current = p;
    return p;
  }, []);

  useEffect(() => {
    const due = () => Date.now() - last.current >= intervalMs;
    const maybeRun = () => {
      if (document.hidden || !due()) return;
      void run();
    };
    // The interval only asks whether a refresh is DUE, rather than assuming a
    // tick means one is. Browsers throttle timers in background tabs and stop
    // them outright when a phone sleeps, so ticks are not a reliable clock —
    // elapsed wall time is.
    const id = setInterval(maybeRun, intervalMs);
    document.addEventListener("visibilitychange", maybeRun);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", maybeRun);
    };
  }, [run, intervalMs]);

  return { run, at };
}

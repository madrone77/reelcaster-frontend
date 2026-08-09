"use client";

import { useEffect, useState } from "react";
import { currentLocalHour } from "./explore-data";

/** What the spot's clock reads. */
export type SpotClock = {
  /** Local hour 0–23 in the spot's timezone. */
  hour: number;
  /** The instant this reading was taken. */
  at: Date;
};

/**
 * The spot's local clock, safe to render on a cached page.
 *
 * The spot page is prerendered and served from the ISR cache, so its HTML is
 * generated once and then handed to visitors for as long as the cache holds it.
 * Reading the clock during render therefore produced two different answers: the
 * server's was frozen at generation time, the client's was live. Every value
 * derived from it — the "NOW · HH:00" label, the headline score, the highlighted
 * hour in the charts, "synced today" under the regulations — disagreed, and
 * React aborted hydration with error #418. The page painted, then blanked.
 *
 * The failure scaled with cache age, which is why it looked like a device bug:
 * a warm edge served HTML seconds old and hydrated fine, while a quieter edge
 * served HTML hours old and blew up every time.
 *
 * So the first render uses `serverNowMs`, the instant the server baked into
 * this HTML. Server and client render identical strings and hydration matches
 * by construction. The real time is adopted immediately after mount, inside an
 * effect, where a difference is an ordinary state update rather than a
 * hydration mismatch.
 *
 * Everything time-dependent on the page derives from this one instant, so there
 * is a single thing to get right rather than one per label.
 *
 * It then re-ticks every minute, which the page already promised: the header
 * advertises "LIVE · AUTO-REFRESH 5 MIN", but the hour used to be read once at
 * load and never again, so an open tab silently went stale.
 */
export function useSpotClock(tz: string, serverNowMs: number): SpotClock {
  const [clock, setClock] = useState<SpotClock>(() => {
    // `serverNowMs` can be absent even though the type says otherwise: a client
    // bundle can hydrate an HTML payload that a *previous* build produced, and
    // that payload predates the prop. `new Date(undefined)` is an Invalid Date,
    // and every Intl call on one throws RangeError, which blanked the page —
    // the deploy that introduced this prop could take out anyone still holding
    // a cached copy of the page from before it.
    //
    // Falling back to the real clock can cost a hydration mismatch, but a
    // mismatch is recoverable and a throw is not. Any prop that reaches a date
    // constructor has to survive being missing.
    const at = new Date(
      typeof serverNowMs === "number" && Number.isFinite(serverNowMs)
        ? serverNowMs
        : Date.now(),
    );
    return { hour: currentLocalHour(tz, at), at };
  });

  useEffect(() => {
    // Correct the seed straight away — it may be arbitrarily old.
    const tick = () => {
      const at = new Date();
      setClock({ hour: currentLocalHour(tz, at), at });
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [tz]);

  return clock;
}

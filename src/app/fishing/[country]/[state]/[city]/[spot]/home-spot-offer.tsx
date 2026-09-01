"use client";

/**
 * "Make this your home spot?" — offered on the spot page, once the angler has
 * earned it.
 *
 * The pin is the difference between a dashboard of links and a daily report
 * about one piece of water, and until this shipped the only way to set one was
 * an unlabelled house icon two elements up. This bar says what that icon does,
 * at the moment the angler is looking at a spot they evidently care about.
 *
 * WHO SEES IT — signed-in accounts with no pin, and nobody else:
 *
 *   * Signed out, there is no dashboard for the pin to pay off on, and a cold
 *     visitor already has a sign-up ask on this page. Two asks is none.
 *   * With a pin already set, there is nothing to offer. This is the case that
 *     needs `ready` rather than `slug !== null`: the pin is read back from the
 *     profile asynchronously, so a null slug means "not looked yet" for the
 *     first moments of every page load, and drawing off it would tell an
 *     angler who has a home spot that they don't — see use-home-spot.
 *   * On an ad landing (`ad`), every account action on this page is suppressed
 *     in favour of the single ask at the wall. This is an account action.
 *
 * WHEN — @/app/explore/lib/home-spot-prompt owns that decision. Both of its
 * signals need a clock, so both are read in effects; nothing here reads the
 * time during render (see [[incident-spot-page-hydration-clock]]).
 */

import { useCallback, useEffect, useState } from "react";
import { Home } from "lucide-react";
import { saveHomeSpot } from "@/app/explore/lib/use-home-spot";
import {
  DWELL_MS,
  promptEarned,
  readDismissState,
  recordDismissal,
  recordSpotView,
} from "@/app/explore/lib/home-spot-prompt";

export default function HomeSpotOffer({
  slug,
  name,
  /** True once the pin has been read back from the profile, not merely locally. */
  homeReady,
  /** The current pin, or null. Any pin at all suppresses the offer. */
  homeSlug,
  /** Is anyone signed in? */
  signedIn,
}: {
  slug: string;
  name: string;
  homeReady: boolean;
  homeSlug: string | null;
  signedIn: boolean;
}) {
  // Both halves of "earned", resolved in effects. `views` starts at 0, which
  // reads as not-yet-earned, so the first render is always quiet — exactly
  // what we want on a server-rendered page whose HTML has no localStorage.
  const [views, setViews] = useState(0);
  const [dwellMet, setDwellMet] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [pinned, setPinned] = useState(false);

  // Count the view once per spot. Keyed on the slug so an in-page navigation
  // between spots counts both, and not on `signedIn` — a view is a view, and
  // re-running this when auth settles would count the same visit twice.
  useEffect(() => {
    setViews(recordSpotView(slug));
    setDwellMet(false);
    setDismissed(false);
    setPinned(false);
  }, [slug]);

  // The dwell half. Cleared and restarted per spot, so time spent reading one
  // spot never earns the offer on the next.
  useEffect(() => {
    const t = window.setTimeout(() => setDwellMet(true), DWELL_MS);
    return () => window.clearTimeout(t);
  }, [slug]);

  // The confirmation retires itself. The filled house in the header above is
  // the standing record of the pin, so the bar has nothing left to say, and
  // leaving it up would hold a band of chrome across the spot for the rest of
  // the visit.
  useEffect(() => {
    if (!pinned) return;
    const t = window.setTimeout(() => setPinned(false), 7000);
    return () => window.clearTimeout(t);
  }, [pinned]);

  const handlePin = useCallback(() => {
    setPinned(true);
    void saveHomeSpot(slug);
  }, [slug]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    recordDismissal(Date.now());
  }, []);

  // Everything above runs regardless — the view still counts for an angler who
  // never sees the bar, which is what makes "opened it before" mean anything.
  if (!signedIn || !homeReady || dismissed) return null;

  // `pinned` is checked BEFORE `homeSlug`, and the order is the whole point:
  // saveHomeSpot writes localStorage and notifies subscribers synchronously,
  // so `homeSlug` is already this spot by the time this line runs. Testing it
  // first made the bar vanish on click with nothing said, which reads like a
  // dropped tap rather than a pin.
  if (pinned) {
    return (
      <div
        role="status"
        className="flex items-center gap-2.5 rounded border border-rc-brand/30 bg-rc-brand-soft px-4 py-3 text-sm text-rc-brand"
      >
        <Home className="h-4 w-4 shrink-0 fill-rc-brand/15" strokeWidth={2.4} aria-hidden />
        <span>
          <span className="font-semibold">{name}</span> is your home spot. Its
          conditions lead your dashboard from now on.
        </span>
      </div>
    );
  }

  if (homeSlug) return null;

  if (
    !promptEarned({
      views,
      dwellMet,
      dismissals: readDismissState(),
      now: Date.now(),
    })
  ) {
    return null;
  }

  // Stacks below `sm`, sits on one line above it. Squeezing the sentence into
  // the column left over beside the buttons turned it into a five-line ribbon
  // on a phone, which is where this page is actually read.
  return (
    <div className="flex flex-col gap-3 rounded border border-rc-rule bg-rc-panel px-4 py-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
        <Home className="mt-0.5 h-4 w-4 shrink-0 text-rc-brand sm:mt-0" aria-hidden />
        <p className="min-w-0 text-sm text-rc-ink">
          Make <span className="font-semibold">{name}</span> your home spot?
          <span className="text-rc-ink-soft">
            {" "}
            Its conditions and today&rsquo;s report lead your dashboard every
            morning.
          </span>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
        <button
          type="button"
          onClick={handlePin}
          className="min-h-11 rounded bg-rc-brand px-4 text-[13px] font-semibold text-white transition-colors hover:bg-rc-brand/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand sm:min-h-9 sm:px-3"
        >
          Make it home
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="min-h-11 rounded px-3 text-[13px] text-rc-ink-mute transition-colors hover:bg-rc-surface hover:text-rc-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand sm:min-h-9 sm:px-2"
        >
          Not now
        </button>
      </div>
    </div>
  );
}

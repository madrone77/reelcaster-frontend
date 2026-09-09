"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import type { AdWall } from "@/lib/ad-mode";

/**
 * Three lines of orientation for a visitor who just landed on the live map
 * from an ad. Says what the dots are and what to do with one, then gets out
 * of the way.
 *
 * Every `?ad=day2` visitor sees this. It ran as arm b of `ad_intro_v1`
 * against nothing from 2026-09-07 and the split settled on the card
 * (2026-09-09), so there is no arm left to read; the Mixpanel pair below is
 * the only counting it does now.
 *
 * NOT AN OFFER. No trial, no Pro, no price, no second button. The frame's
 * paywall flow (the free spot opens, then the trial modal) runs exactly as
 * it would without this, and nothing here counts toward or restarts it.
 * That is why it is not `ProTrialModal`, and why it does not go through the
 * paywall reporter: it sells nothing and has no feature id to report under.
 *
 * TRANSPARENT. The map stays visible behind it, because the card is about
 * the map: "every dot" means the dots they can see right now. So no scrim,
 * and not the shared <Dialog> either, whose overlay is `bg-black/50` and
 * whose focus trap would hold the map hostage. Tapping anywhere outside the
 * card dismisses it; so does the button and Esc. The tap that dismisses it
 * is spent on the dismissal and does not reach the map underneath, which is
 * deliberate: a first tap that both closed the card and opened a spot would
 * spend one of the wall's free opens on an accident.
 *
 * ONCE PER TAB, in sessionStorage keyed by wall, the same way the wall's
 * spot-open allowance is kept: the round trip through a spot page and its
 * "Back to map" link must not show it twice, and a fresh tab from the same
 * ad click starts over. If storage throws (iOS blocked site data) it shows
 * once per mount, which on this surface is once per page load.
 *
 * THE CITY is the one the shell labels the viewport with, so the card drops
 * the city phrase when the camera has not settled rather than name the
 * wrong one.
 */

const KEY = "rc_ad_intro";

function alreadyShown(wall: AdWall): boolean {
  try {
    return window.sessionStorage.getItem(`${KEY}:${wall}`) === "1";
  } catch {
    return false;
  }
}

function markShown(wall: AdWall): void {
  try {
    window.sessionStorage.setItem(`${KEY}:${wall}`, "1");
  } catch {
    // Once per mount, then.
  }
}

export default function AdIntroCard({
  wall,
  cityName,
}: {
  wall: AdWall;
  /** The city under the camera, or undefined before it settles. */
  cityName?: string;
}) {
  // Decided in an effect, not the initial state: this component server
  // renders with the shell, and reading storage during render would put a
  // per-browser answer into HTML that has to match the server's.
  const [open, setOpen] = useState(false);
  const openedAt = useRef<number | null>(null);

  useEffect(() => {
    if (alreadyShown(wall)) return;
    markShown(wall);
    openedAt.current = Date.now();
    setOpen(true);
    trackEvent("Ad Intro Shown", { ad_wall: wall, city: cityName });
    // Once, on mount. The city is read at that moment for the event only;
    // the card itself follows the live label below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wall]);

  const dismiss = useCallback(
    (via: "button" | "outside" | "esc") => {
      setOpen(false);
      trackEvent("Ad Intro Dismissed", {
        ad_wall: wall,
        via,
        dwell_ms: openedAt.current ? Date.now() - openedAt.current : undefined,
      });
    },
    [wall],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss("esc");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismiss]);

  if (!open) return null;

  const near = cityName ? ` near ${cityName}` : "";

  return (
    <div
      // Above the phone sheet (z-60/61) and the top bar, below the shared
      // dialogs (z-70) so a trial modal opened later still wins.
      className="fixed inset-0 z-[65] flex items-center justify-center p-6 lg:pl-[420px]"
      onPointerDown={() => dismiss("outside")}
      data-testid="ad-intro-overlay"
    >
      <div
        role="dialog"
        aria-labelledby="ad-intro-title"
        aria-describedby="ad-intro-body"
        onPointerDown={(e) => e.stopPropagation()}
        className="animate-in fade-in-0 zoom-in-95 w-full max-w-[340px] rounded-2xl bg-white/95 px-5 pt-5 pb-4 text-left shadow-rc-panel backdrop-blur"
        data-testid="ad-intro-card"
        data-ad-intro-city={cityName ?? ""}
      >
        <h2
          id="ad-intro-title"
          className="text-[19px] font-semibold leading-tight tracking-tight text-rc-ink"
        >
          You&rsquo;re on the live map
        </h2>
        <p
          id="ad-intro-body"
          className="mt-2 text-[14.5px] leading-relaxed text-rc-ink-soft"
        >
          Every dot is a fishing spot{near}. The number is today&rsquo;s top
          score at that spot.
        </p>
        <p className="mt-1.5 text-[14.5px] leading-relaxed text-rc-ink-soft">
          Tap a dot to see when to go.
        </p>
        <button
          type="button"
          onClick={() => dismiss("button")}
          autoFocus
          data-testid="ad-intro-dismiss"
          className="mt-4 flex w-full items-center justify-center rounded-xl bg-rc-brand px-4 py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-rc-brand-hover"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

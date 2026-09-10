"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { trackEvent } from "@/lib/analytics";
import { reportPaywall } from "@/lib/paywall-counter";
import {
  dismissSpotViewsCta,
  readSpotViews,
  serverSpotViews,
  spotViewsEarned,
  subscribeSpotViews,
} from "@/lib/spot-views";

/** Where this ask stands on the admin's surface list. */
const SURFACE = "spot-views-cta";

/** The reading surfaces: the map, its spot sheet and pages, the directory. */
const SURFACES = ["/explore", "/fishing"];

/**
 * Log in / Sign up for free, after three spots.
 *
 * The card a logged-out ChatGPT tab shows at the bottom of the screen, worn
 * by ReelCaster once a signed-out visitor has read three spots (see
 * @/lib/spot-views for the count). It is not a wall: nothing is locked, the
 * page underneath keeps working, and the X closes it for the visit.
 *
 * It asks for a free account, not the Pro trial. Three spots in, the visitor
 * has shown they are reading; the low-friction next step is an account, and
 * Pro is still sold where the tier matrix sells it.
 *
 * Mounted once, in the root layout, so it follows the visitor between the map
 * and a spot page without each surface mounting its own copy. It only shows
 * on the reading surfaces (`SURFACES`); the auth pages, the home page and
 * the landing pages never see it. The ad frame hides it with the same CSS
 * rule that hides the tab bar (`body:has([data-ad-frame])`), because that
 * frame is built around one offer and this would be a second.
 *
 * `loading` is in the gate: `user` is null until auth resolves, and a member
 * on a cold load must not be asked to sign up for what they have.
 */
export default function FreeAccountCta() {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const views = useSyncExternalStore(
    subscribeSpotViews,
    readSpotViews,
    serverSpotViews,
  );

  const onSurface = SURFACES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  const show = onSurface && !loading && !user && spotViewsEarned(views);

  // One impression per appearance, not per render.
  const shown = useRef(false);
  useEffect(() => {
    if (!show) {
      shown.current = false;
      return;
    }
    if (shown.current) return;
    shown.current = true;
    reportPaywall("impression", {
      feature: "free-account",
      surface: SURFACE,
      viewerTier: "anon",
      context: { spots_viewed: views.slugs.length },
    });
    trackEvent("Free Account CTA Shown", {
      surface: SURFACE,
      spots_viewed: views.slugs.length,
    });
  }, [show, views.slugs.length]);

  if (!show) return null;

  const next = encodeURIComponent(pathname || "/explore");
  const take = (target: "login" | "signup") => {
    reportPaywall("cta_click", {
      feature: "free-account",
      surface: SURFACE,
      viewerTier: "anon",
      context: { target },
    });
    trackEvent("Free Account CTA Clicked", { surface: SURFACE, target });
  };
  const dismiss = () => {
    reportPaywall("dismiss", {
      feature: "free-account",
      surface: SURFACE,
      viewerTier: "anon",
    });
    trackEvent("Free Account CTA Dismissed", { surface: SURFACE });
    dismissSpotViewsCta();
  };

  return (
    // Above the phone's spot sheet (z-[61]) and the tab bar (z-50): the card
    // rides over whichever surface is open. On a page it sits above the
    // floating tab pill, the same shelf the More sheet uses, and bottom
    // right on desktop. The map is different: its bottom edge is where the
    // spot list, the preview card and the forecast strip live, so there the
    // card sits at the top of the map under the search row, and drops back
    // to the bottom once the phone's spot sheet is open over it. Those
    // moves are CSS, keyed off the attribute: see globals.css.
    <div
      data-free-account-cta={pathname === "/explore" ? "map" : "page"}
      role="complementary"
      aria-label="Sign up for free"
      className="pointer-events-none fixed inset-x-0 z-[70] px-4 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] lg:inset-x-auto lg:bottom-6 lg:right-6 lg:px-0"
    >
      <div className="pointer-events-auto relative mx-auto max-w-lg rounded-2xl border border-rc-rule bg-rc-panel/95 px-4 pb-4 pt-3.5 shadow-[0_6px_24px_rgba(15,23,42,0.18)] backdrop-blur-md lg:w-[360px]">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close"
          data-testid="free-account-cta-dismiss"
          className="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-full text-rc-ink-mute transition-colors hover:bg-rc-surface hover:text-rc-ink"
        >
          <X className="h-4 w-4" />
        </button>
        <p className="pr-8 text-[14px] leading-snug text-rc-ink">
          You&rsquo;ll get more forecast days, saved spots, and catch reports.
        </p>
        <div className="mt-3 flex gap-2">
          <Link
            href={`/login?next=${next}`}
            onClick={() => take("login")}
            data-testid="free-account-cta-login"
            className="flex h-10 items-center justify-center rounded-full bg-rc-ink px-5 text-[14px] font-semibold text-white transition-colors hover:bg-rc-ink/90"
          >
            Log in
          </Link>
          <Link
            href={`/signup?next=${next}`}
            onClick={() => take("signup")}
            data-testid="free-account-cta-signup"
            className="flex h-10 items-center justify-center rounded-full border border-rc-rule bg-rc-panel px-5 text-[14px] font-semibold text-rc-ink transition-colors hover:bg-rc-surface"
          >
            Sign up for free
          </Link>
        </div>
      </div>
    </div>
  );
}

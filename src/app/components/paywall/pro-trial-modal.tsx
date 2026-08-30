"use client";

import Link from "next/link";
import { useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/auth-context";
import { useSubscription } from "@/hooks/use-subscription";
import { useAnalytics } from "@/hooks/use-analytics";
import { captureWall } from "@/lib/attribution";
import { reportPaywall } from "@/lib/paywall-counter";
import { TrialBuy, TrialCtaProvider, TrialExpress } from "./trial-cta";
import PlanMatrix from "./plan-matrix";
import { TRIAL_DAYS } from "@/lib/pricing";
import { usePricing } from "@/app/components/split-test/use-pricing";
import { useSplitExposure } from "@/app/components/split-test/report";
import {
  FREE_FAVORITE_SPOTS,
  NAG_FEATURES,
  nagHeadline,
  nagSubhead,
  type NagFeatureId,
  type PlanTierId,
} from "@/lib/plan-features";

/**
 * The upgrade nag for /explore. Two jobs, in this order:
 *
 *   1. Answer the thing the angler just tried to do — "Start your 7-day Pro
 *      trial to create an alert". The headline names the action, so the modal
 *      never reads as a generic interruption.
 *   2. Show the whole plan matrix underneath, so the decision is made here
 *      instead of on a round trip to /plans.
 *
 * The viewer's current tier column is marked, and the row that blocked them is
 * highlighted, so "what I have" and "what I'd get" are both one glance. The
 * table is Free vs Pro for every viewer, signed out included — a signed-out
 * visitor is being asked whether to pay, and a third "Browsing" column made
 * that a three-way comparison. The free tier is still offered by name below.
 *
 * Copy + limits come from `@/lib/plan-features` — never hardcode them here.
 */
export default function ProTrialModal({
  open,
  onOpenChange,
  feature,
  /** Overrides the auto-detected tier. Only for surfaces that already know. */
  viewerTier: viewerTierProp,
  /** Where the CTA lands. Defaults to /plans carrying the feature context. */
  ctaHref,
  /** Analytics + deep-link context for where the nag fired. */
  from = "explore",
  /** Names the spot in the headline ("Set an alert for Oak Bay Flats"). */
  spotName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature: NagFeatureId;
  viewerTier?: PlanTierId;
  ctaHref?: string;
  from?: string;
  spotName?: string;
}) {
  const { user } = useAuth();
  const { isPaid } = useSubscription();
  const { trackEvent } = useAnalytics();

  const pathname = usePathname();
  const returnTo = pathname || "/explore";
  const nag = NAG_FEATURES[feature];
  const viewerTier: PlanTierId =
    viewerTierProp ?? (isPaid ? "pro" : user ? "free" : "anon");

  // Every wall sells the trial, including the ones a free account would also
  // open. The free tier isn't hidden — it's the link at the foot of the
  // modal, after the matrix has shown what the tiers actually differ on.
  const ctaLabel = `Start ${TRIAL_DAYS}-day free trial`;

  // The price this reader is quoted, and the exposure that quoting it counts
  // as. The modal is the highest-intent surface a price arm is shown on, so
  // its denominator is the one the report leans on hardest.
  const pricing = usePricing();
  useSplitExposure(pricing, "modal");

  /**
   * The server-side counter behind /admin/reelcaster/paywalls and the
   * conversion panels on /admin/reelcaster/analytics. Mixpanel already has
   * these as events; this is the copy the admin dashboard can actually query,
   * and it is a day-grain count rather than a log.
   *
   * The request itself lives in lib/paywall-counter.ts, shared with the walls
   * that do not open this modal, so all of them report the same way.
   */
  const bumpCounter = useCallback(
    (kind: "impression" | "cta_click") => {
      reportPaywall(kind, { feature, surface: from, viewerTier });
    },
    [feature, from, viewerTier],
  );

  /** Every CTA on this modal reports the same way. */
  const trackCta = useCallback(
    (extra: Record<string, unknown>) => {
      trackEvent("Paywall CTA Clicked", { feature, viewerTier, from, ...extra });
      bumpCounter("cta_click");
    },
    [trackEvent, feature, viewerTier, from, bumpCounter],
  );

  useEffect(() => {
    if (!open) return;
    trackEvent("Upgrade Prompt Shown", {
      feature,
      viewerTier,
      from,
      timestamp: new Date().toISOString(),
    });
    bumpCounter("impression");
    // The cookie that carries this wall across the navigation to /signup or
    // out to Stripe, so whatever the visitor converts into knows which wall
    // sent them. Last touch wins, and it expires in 30 minutes.
    captureWall(feature, from);
  }, [open, feature, viewerTier, from, trackEvent, bumpCounter]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* ONE scrolling box. This used to pin the headline and the buy button
          and scroll only the plan table between them — which on a phone left a
          narrow strip of moving content trapped between two frozen bands, and
          read as a broken page rather than a deliberate layout.

          So the shell stays put and everything inside it scrolls together. The
          close button is the one exception: it's absolutely positioned on the
          shell, OUTSIDE the scroller, so it can't be scrolled away from — which
          matters more here than it did before, now that the buy button can be. */}
      <DialogContent
        data-testid="pro-trial-modal"
        data-feature={feature}
        className="bg-rc-panel border-rc-rule text-rc-ink p-0 gap-0 sm:max-w-lg max-h-[88dvh] flex flex-col overflow-hidden [&>[data-slot=dialog-close]]:z-20"
      >
        {/* overscroll-contain so a flick past the end of the modal on a phone
            doesn't start scrolling the page underneath it. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {/* One provider around all three pieces: the wallet buttons and the
            buy form up top, the terms at the foot — sharing one resolution of
            trial eligibility rather than each asking again. */}
        <TrialCtaProvider
          from={from}
          theme="light"
          onActivate={(method) =>
            trackCta({
              plan: "annual",
              method,
              destination: method === "wallet" ? "wallet" : "checkout",
            })
          }
        >
          {/* pr-10 clears the dialog's own close button — which is also why
              there's no "Not now": two dismissals for one modal. */}
          <DialogHeader className="px-4 pr-10 pt-6 pb-5 sm:px-6 sm:pr-12 text-left">
            <p className="font-rc-mono text-[10px] font-semibold tracking-[0.14em] uppercase text-rc-brand">
              ReelCaster Pro
            </p>
            <DialogTitle className="mt-2 text-xl sm:text-2xl font-black tracking-[-0.02em] text-rc-ink text-balance">
              {nagHeadline(nag, viewerTier, spotName)}
            </DialogTitle>
          </DialogHeader>

          {/* Wallets first, then the card path. A buyer with Apple Pay set up
              is one tap from done and should never have to scroll past a form
              to find that out; a buyer without one sees the form exactly where
              it was, because <TrialExpress> renders nothing — not even its
              divider — when no wallet is available. */}
          <div className="px-4 sm:px-6 pb-4">
            {!ctaHref && <TrialExpress className="mb-4" />}
            {ctaHref ? (
              <Link
                href={ctaHref}
                data-testid="pro-trial-cta"
                onClick={() => trackCta({ href: ctaHref })}
                className="block text-center px-4 py-2.5 rounded-lg bg-rc-brand hover:bg-rc-brand-hover text-white text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-2"
              >
                {ctaLabel}
              </Link>
            ) : (
              <TrialBuy signupLabel={ctaLabel} />
            )}

            {/* The disclosure, directly under the button it belongs to. There
                is one button now, so this rides with it above the table rather
                than at the foot of the modal — the renewal amount and the
                charge date have to be readable before the click, not a table's
                worth of scrolling below it (see trial-cta.tsx). The Terms and
                Privacy links live here because this is the only place on the
                modal that carries them. */}
            <DialogDescription className="mt-3 text-sm leading-relaxed text-rc-ink-soft">
              {nagSubhead(pricing)}{" "}
              <Link
                href="/terms"
                className="text-rc-brand underline underline-offset-2 hover:text-rc-brand-hover"
              >
                Terms
              </Link>
              {" · "}
              <Link
                href="/privacy"
                className="text-rc-brand underline underline-offset-2 hover:text-rc-brand-hover"
              >
                Privacy
              </Link>
            </DialogDescription>
          </div>

          <PlanMatrix viewerTier={viewerTier} highlightRowId={nag.rowId} />

          {/* The free tier, offered last and on purpose: after the matrix has
              shown what an account gets you without paying. Only for visitors
              who don't have one — for everyone else the table is the last
              thing on the modal, and the buy button is back up at the top
              where the disclosure travels with it.

              There used to be a second copy of the buy button down here, on
              the argument that a reader who finished the table shouldn't have
              to scroll back up to act on it. It doubled the ask, and the
              disclosure attached to it was the only one on the modal — so the
              terms sat below the whole table. One button, up top, with its
              terms. */}
          {viewerTier === "anon" && (
            <div className="border-t border-rc-rule px-4 sm:px-6 py-4 text-center">
              <Link
                href={`/signup?next=${encodeURIComponent(returnTo)}`}
                data-testid="free-signup-cta"
                onClick={() => trackCta({ plan: "free", destination: "signup" })}
                className="text-sm font-semibold text-rc-brand hover:text-rc-brand-hover underline underline-offset-2"
              >
                Sign up today as a free user
              </Link>
              <p className="mt-1.5 text-[11px] leading-relaxed text-rc-ink-mute">
                No card. Keeps today&apos;s score, a week of forecast, and{" "}
                {FREE_FAVORITE_SPOTS === 1
                  ? "one saved spot"
                  : `${FREE_FAVORITE_SPOTS} saved spots`}
                .
              </p>
            </div>
          )}
        </TrialCtaProvider>
        </div>
      </DialogContent>
    </Dialog>
  );
}
